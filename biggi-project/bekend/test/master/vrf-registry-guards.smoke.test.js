const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: vrf + registry guards smoke", function () {
  it("prevents reusing VRF/public collection addresses but allows a shared central TicketHub", async () => {
    const [owner] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const vrfA = await deploy("MockMintShareReceiver");
    const publicA = await deploy("MockMintShareReceiver");
    const sharedTicketHub = await deploy("MockMintShareReceiver");
    const vrfB = await deploy("MockMintShareReceiver");
    const publicB = await deploy("MockMintShareReceiver");
    const otherTicketHub = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.createChapter(1)).wait();

    await (await registry.setChapterCollections(1, vrfA.address, publicA.address, sharedTicketHub.address)).wait();

    await expect(
      registry.setChapterCollections(2, vrfA.address, publicB.address, otherTicketHub.address)
    ).to.be.reverted;

    await expect(
      registry.setChapterCollections(2, vrfB.address, publicA.address, otherTicketHub.address)
    ).to.be.reverted;

    await (await registry.setChapterCollections(2, vrfB.address, publicB.address, sharedTicketHub.address)).wait();

    expect(await registry.chapterByCollection(vrfA.address)).to.equal(1);
    expect(await registry.chapterByCollection(publicA.address)).to.equal(1);
    expect(await registry.chapterByCollection(vrfB.address)).to.equal(2);
    expect(await registry.chapterByCollection(publicB.address)).to.equal(2);
    expect(await registry.chapterByCollection(sharedTicketHub.address)).to.equal(0);
    expect(await registry.isTicketHubForChapter(sharedTicketHub.address, 1)).to.equal(true);
    expect(await registry.isTicketHubForChapter(sharedTicketHub.address, 2)).to.equal(true);
  });

  it("routes request and coordinator callback through BiggiVRFRouter", async () => {
    const [owner, alice] = await ethers.getSigners();

    const coordinator = await deploy("MockVrfCoordinatorV2Plus");
    const keyHash = ethers.utils.hexZeroPad("0x1234", 32);
    const router = await deploy(
      "BiggiVRFRouter",
      coordinator.address,
      owner.address,
      keyHash,
      7
    );
    const main = await deploy("MockVrfMainConsumer");

    await (await main.setRouter(router.address)).wait();
    await (await router.setMain(main.address)).wait();

    await (await main.requestViaRouter(alice.address, 42)).wait();
    const requestId = await main.lastRequestId();

    expect(requestId).to.equal(1);
    expect(await coordinator.requester(requestId)).to.equal(router.address);
    expect(await router.reqMain(requestId)).to.equal(main.address);
    expect(await router.reqMinter(requestId)).to.equal(alice.address);
    expect(await router.reqTicket(requestId)).to.equal(42);

    await expect(
      router.rawFulfillRandomWords(requestId, [123456])
    ).to.be.reverted;

    await (await coordinator.fulfill(router.address, requestId, 987654321)).wait();

    expect(await main.fulfilledRequestId()).to.equal(requestId);
    expect(await main.fulfilledRandomWord()).to.equal(987654321);
  });

  it("requires NFT rewards consumer approval on VRF router before mystery request", async () => {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    const coordinator = await deploy("MockVrfCoordinatorV2Plus");
    const keyHash = ethers.utils.hexZeroPad("0x5678", 32);
    const router = await deploy(
      "BiggiVRFRouter",
      coordinator.address,
      owner.address,
      keyHash,
      9
    );
    const nftRewards = await deploy("BiggiNFTRewards", owner.address);

    await (await nftRewards.setVrfRouter(router.address)).wait();
    await (
      await nftRewards.createMysteryEvent(
        ["ipfs://reward-1", "ipfs://reward-2"],
        [alice.address, bob.address, carol.address]
      )
    ).wait();

    await expect(
      nftRewards.requestMysteryRandom(1)
    ).to.be.revertedWith("ONLY_REWARD_CONSUMER");

    await (await router.setRewardConsumerApproval(nftRewards.address, true)).wait();
    await (await nftRewards.requestMysteryRandom(1)).wait();

    const requestId = await nftRewards.vrfRequestToEvent(1);
    expect(requestId).to.equal(1);
    expect(await router.reqIsReward(1)).to.equal(true);
    expect(await router.reqMain(1)).to.equal(nftRewards.address);

    await (await coordinator.fulfill(router.address, 1, 123456789)).wait();

    const eventData = await nftRewards.events(1);
    const reward1 = await nftRewards.rewardInfo(1);
    const reward2 = await nftRewards.rewardInfo(2);

    expect(eventData.finished).to.equal(true);
    expect(reward1.assigned).to.not.equal(ethers.constants.AddressZero);
    expect(reward2.assigned).to.not.equal(ethers.constants.AddressZero);
    expect(reward1.assigned).to.not.equal(reward2.assigned);
  });

  it("allows retrying a stuck mystery VRF request after failed router forward", async () => {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    const coordinator = await deploy("MockVrfCoordinatorV2Plus");
    const keyHash = ethers.utils.hexZeroPad("0x9999", 32);
    const router = await deploy(
      "BiggiVRFRouter",
      coordinator.address,
      owner.address,
      keyHash,
      11
    );
    const nftRewards = await deploy("BiggiNFTRewards", owner.address);

    await (await nftRewards.setVrfRouter(router.address)).wait();
    await (await nftRewards.setMysteryRetryDelay(60)).wait();
    await (await router.setRewardConsumerApproval(nftRewards.address, true)).wait();
    await (
      await nftRewards.createMysteryEvent(
        ["ipfs://reward-1", "ipfs://reward-2"],
        [alice.address, bob.address, carol.address]
      )
    ).wait();

    await (await nftRewards.requestMysteryRandom(1)).wait();
    expect(await nftRewards.vrfRequestToEvent(1)).to.equal(1);

    // Break the callback authorization so router forwarding fails but the request remains pending.
    await (await nftRewards.setVrfRouter(owner.address)).wait();
    await (await coordinator.fulfill(router.address, 1, 123456789)).wait();

    let eventData = await nftRewards.events(1);
    expect(eventData.randomnessRequested).to.equal(true);
    expect(eventData.finished).to.equal(false);

    await expect(nftRewards.retryMysteryRandom(1)).to.be.reverted;

    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);

    await (await nftRewards.setVrfRouter(router.address)).wait();
    await (await nftRewards.retryMysteryRandom(1)).wait();

    eventData = await nftRewards.events(1);
    expect(eventData.vrfRequestId).to.equal(2);
    expect(await nftRewards.vrfRequestToEvent(1)).to.equal(0);
    expect(await nftRewards.vrfRequestToEvent(2)).to.equal(1);

    await (await coordinator.fulfill(router.address, 2, 987654321)).wait();

    eventData = await nftRewards.events(1);
    expect(eventData.randomnessRequested).to.equal(false);
    expect(eventData.finished).to.equal(true);
    expect(await nftRewards.vrfRequestToEvent(2)).to.equal(0);
    expect((await nftRewards.rewardInfo(1)).assigned).to.not.equal(ethers.constants.AddressZero);
    expect((await nftRewards.rewardInfo(2)).assigned).to.not.equal(ethers.constants.AddressZero);
  });

  it("allows owner emergency resolution of a stuck mystery event", async () => {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    const coordinator = await deploy("MockVrfCoordinatorV2Plus");
    const keyHash = ethers.utils.hexZeroPad("0xaaaa", 32);
    const router = await deploy(
      "BiggiVRFRouter",
      coordinator.address,
      owner.address,
      keyHash,
      12
    );
    const nftRewards = await deploy("BiggiNFTRewards", owner.address);

    await (await nftRewards.setVrfRouter(router.address)).wait();
    await (await router.setRewardConsumerApproval(nftRewards.address, true)).wait();
    await (
      await nftRewards.createMysteryEvent(
        ["ipfs://reward-1", "ipfs://reward-2"],
        [alice.address, bob.address, carol.address]
      )
    ).wait();

    await (await nftRewards.requestMysteryRandom(1)).wait();
    await (await nftRewards.emergencyResolveMystery(1, 555555)).wait();

    const eventData = await nftRewards.events(1);
    expect(eventData.randomnessRequested).to.equal(false);
    expect(eventData.finished).to.equal(true);
    expect(eventData.vrfRequestId).to.equal(0);
    expect(await nftRewards.vrfRequestToEvent(1)).to.equal(0);
    expect((await nftRewards.rewardInfo(1)).assigned).to.not.equal(ethers.constants.AddressZero);
    expect((await nftRewards.rewardInfo(2)).assigned).to.not.equal(ethers.constants.AddressZero);
  });
});
