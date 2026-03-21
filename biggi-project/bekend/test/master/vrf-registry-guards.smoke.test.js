const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: vrf + registry guards smoke", function () {
  it("prevents reusing collection address across different chapters", async () => {
    const [owner] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const collA = await deploy("MockMintShareReceiver");
    const collB = await deploy("MockMintShareReceiver");
    const collC = await deploy("MockMintShareReceiver");
    const collD = await deploy("MockMintShareReceiver");
    const collE = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.createChapter(1)).wait();

    await (await registry.setChapterCollections(1, collA.address, collB.address, collC.address)).wait();

    await expect(
      registry.setChapterCollections(2, collA.address, collD.address, collE.address)
    ).to.be.reverted;

    expect(await registry.chapterByCollection(collA.address)).to.equal(1);
    expect(await registry.chapterByCollection(collB.address)).to.equal(1);
    expect(await registry.chapterByCollection(collC.address)).to.equal(1);
    expect(await registry.chapterByCollection(collD.address)).to.equal(0);
    expect(await registry.chapterByCollection(collE.address)).to.equal(0);
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
});
