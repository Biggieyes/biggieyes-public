const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployVrfStack(owner) {
  const coordinator = await deploy("MockVrfCoordinatorV2Plus");
  const router = await deploy(
    "BiggiVRFRouter",
    coordinator.address,
    owner.address,
    ethers.utils.hexZeroPad("0xbeef", 32),
    17,
  );
  const rewards = await deploy(
    "BiggiNFTRewardsV2",
    owner.address,
    router.address,
  );
  await (await router.setRewardConsumerApproval(rewards.address, true)).wait();
  return { coordinator, router, rewards };
}

describe("BIGGI_MASTER: NFT rewards V2 hardening", function () {
  it("creates a finished manual event and lets only the assignee claim it", async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    const mockRouter = await deploy("MockRewardVrfRouterV2");
    const rewards = await deploy(
      "BiggiNFTRewardsV2",
      owner.address,
      mockRouter.address,
    );

    await expect(
      rewards.connect(alice).createManualReward(alice.address, "ipfs://manual"),
    ).to.be.revertedWithCustomError(rewards, "OwnableUnauthorizedAccount");
    await expect(
      rewards.createManualReward(alice.address, ""),
    ).to.be.revertedWithCustomError(rewards, "EmptyTokenUri");

    await (await rewards.createManualReward(alice.address, "ipfs://manual")).wait();

    const eventData = await rewards.events(1);
    expect(eventData.kind).to.equal(2);
    expect(eventData.finished).to.equal(true);
    expect(eventData.randomnessRequested).to.equal(false);
    expect(eventData.rewardStartId).to.equal(1);
    expect((await rewards.rewardInfo(1)).assigned).to.equal(alice.address);

    await expect(rewards.connect(bob).claim(1)).to.be.revertedWithCustomError(
      rewards,
      "NotAssigned",
    );
    await (await rewards.connect(alice).claim(1)).wait();
    expect(await rewards.ownerOf(1)).to.equal(alice.address);
    expect(await rewards.tokenURI(1)).to.equal("ipfs://manual");
    expect((await rewards.rewardInfo(1)).isClaimed).to.equal(true);
    await expect(rewards.connect(alice).claim(1)).to.be.revertedWithCustomError(
      rewards,
      "AlreadyClaimedError",
    );
  });

  it("stays compatible with the immutable NFT rewards reader", async () => {
    const [owner] = await ethers.getSigners();
    const mockRouter = await deploy("MockRewardVrfRouterV2");
    const rewards = await deploy(
      "BiggiNFTRewardsV2",
      owner.address,
      mockRouter.address,
    );
    const reader = await deploy("BiggiNftRewardsReader", rewards.address);

    const status = await reader.getStatus();
    expect(status.nftRewards).to.equal(rewards.address);
    expect(status.main).to.equal(ethers.constants.AddressZero);
    expect(status.registry).to.equal(ethers.constants.AddressZero);
    expect(status.vrfRouter).to.equal(mockRouter.address);
    expect(status.owner).to.equal(owner.address);
    expect(status.nextEventId).to.equal(1);
    expect(status.nextRewardId).to.equal(1);
    expect(status.totalRewardsCreated).to.equal(0);
    expect(status.name).to.equal("Biggi Reward");
    expect(status.symbol).to.equal("BGR");
  });

  it("deduplicates eligibility and assigns unique winners through the real VRF router", async () => {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const { coordinator, router, rewards } = await deployVrfStack(owner);

    await expect(
      rewards.createMysteryEvent([], [alice.address]),
    ).to.be.revertedWithCustomError(rewards, "NoTokens");
    await expect(
      rewards.createMysteryEvent(["ipfs://one"], []),
    ).to.be.revertedWithCustomError(rewards, "NoEligible");
    await expect(
      rewards.createMysteryEvent([""], [alice.address]),
    ).to.be.revertedWithCustomError(rewards, "EmptyTokenUri");
    await expect(
      rewards.createMysteryEvent(
        ["ipfs://one", "ipfs://two"],
        [alice.address, alice.address],
      ),
    ).to.be.revertedWithCustomError(rewards, "NotEnoughEligible");

    await (
      await rewards.createMysteryEvent(
        ["ipfs://one", "ipfs://two"],
        [alice.address, bob.address, alice.address, carol.address],
      )
    ).wait();
    expect(await rewards.eventEligibleCount(1)).to.equal(3);

    await (await rewards.requestMysteryRandom(1)).wait();
    const pending = await rewards.events(1);
    expect(pending.randomnessRequested).to.equal(true);
    expect(pending.vrfRequestId).to.equal(1);
    expect(await rewards.vrfRequestToEvent(1)).to.equal(1);

    await expect(
      rewards.fulfillRandom(1, 123),
    ).to.be.revertedWithCustomError(rewards, "OnlyVrfRouter");
    await (await coordinator.fulfill(router.address, 1, 123456789)).wait();

    const completed = await rewards.events(1);
    const reward1 = await rewards.rewardInfo(1);
    const reward2 = await rewards.rewardInfo(2);
    expect(completed.finished).to.equal(true);
    expect(completed.randomnessRequested).to.equal(false);
    expect(completed.vrfRequestId).to.equal(0);
    expect(reward1.assigned).to.not.equal(ethers.constants.AddressZero);
    expect(reward2.assigned).to.not.equal(ethers.constants.AddressZero);
    expect(reward1.assigned).to.not.equal(reward2.assigned);
    expect(rewards.interface.functions["emergencyResolveMystery(uint256,uint256)"]).to.equal(
      undefined,
    );
    expect(rewards.interface.functions["createCharacterReward(address,string)"]).to.equal(
      undefined,
    );
  });

  it("ignores a late old callback and completes only the retried request", async () => {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const { coordinator, router, rewards } = await deployVrfStack(owner);
    await (await rewards.setMysteryRetryDelay(60)).wait();
    await (
      await rewards.createMysteryEvent(
        ["ipfs://one", "ipfs://two"],
        [alice.address, bob.address, carol.address],
      )
    ).wait();
    await (await rewards.requestMysteryRandom(1)).wait();

    await expect(rewards.retryMysteryRandom(1)).to.be.revertedWithCustomError(
      rewards,
      "RetryTooEarly",
    );
    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);
    await (await rewards.retryMysteryRandom(1)).wait();

    let eventData = await rewards.events(1);
    expect(eventData.vrfRequestId).to.equal(2);
    expect(await rewards.vrfRequestToEvent(1)).to.equal(0);
    expect(await rewards.vrfRequestToEvent(2)).to.equal(1);

    await (await coordinator.fulfill(router.address, 1, 111)).wait();
    eventData = await rewards.events(1);
    expect(eventData.finished).to.equal(false);
    expect(eventData.vrfRequestId).to.equal(2);

    await (await coordinator.fulfill(router.address, 2, 222)).wait();
    eventData = await rewards.events(1);
    expect(eventData.finished).to.equal(true);
    expect(await rewards.vrfRequestToEvent(2)).to.equal(0);
  });

  it("rejects zero and reused request ids from a bad router", async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    const router = await deploy("MockRewardVrfRouterV2");
    const rewards = await deploy(
      "BiggiNFTRewardsV2",
      owner.address,
      router.address,
    );

    await (
      await rewards.createMysteryEvent(["ipfs://one"], [alice.address])
    ).wait();
    await (await router.setNextRequestId(0)).wait();
    await expect(
      rewards.requestMysteryRandom(1),
    ).to.be.revertedWithCustomError(rewards, "InvalidRequestId");

    await (await router.setNextRequestId(7)).wait();
    await (await rewards.requestMysteryRandom(1)).wait();
    await (
      await rewards.createMysteryEvent(["ipfs://two"], [bob.address])
    ).wait();
    await expect(
      rewards.requestMysteryRandom(2),
    ).to.be.revertedWithCustomError(rewards, "RequestIdAlreadyUsed");
  });

  it("rejects native POL and uses two-step ownership without renounce", async () => {
    const [owner, nextOwner] = await ethers.getSigners();
    const router = await deploy("MockRewardVrfRouterV2");
    const rewards = await deploy(
      "BiggiNFTRewardsV2",
      owner.address,
      router.address,
    );

    await expect(
      owner.sendTransaction({ to: rewards.address, value: 1 }),
    ).to.be.revertedWithCustomError(rewards, "NativeTokenNotAccepted");
    await expect(rewards.renounceOwnership()).to.be.revertedWithCustomError(
      rewards,
      "OwnershipRenounceDisabled",
    );
    expect(rewards.interface.functions["setVrfRouter(address)"]).to.equal(undefined);
    expect(await rewards.vrfRouter()).to.equal(router.address);

    await (await rewards.transferOwnership(nextOwner.address)).wait();
    expect(await rewards.owner()).to.equal(owner.address);
    expect(await rewards.pendingOwner()).to.equal(nextOwner.address);
    await (await rewards.connect(nextOwner).acceptOwnership()).wait();
    expect(await rewards.owner()).to.equal(nextOwner.address);
  });
});
