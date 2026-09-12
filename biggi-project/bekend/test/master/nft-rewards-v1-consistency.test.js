const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy(name, ...args) {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("NFT Rewards V1: deployed frontend contract", function () {
  it("assigns before minting, preserves metadata and prevents unauthorized or repeated claims", async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    const rewards = await deploy("BiggiNFTRewards", owner.address);
    const reader = await deploy("BiggiNftRewardsReader", rewards.address);
    await rewards.createManualReward(alice.address, "ipfs://reward/1.json");
    const event = await rewards.events(1);
    expect(event.kind).to.equal(2);
    expect(event.finished).to.equal(false);
    expect((await reader.rewardInfo(1)).assigned).to.equal(alice.address);
    await expect(rewards.ownerOf(1)).to.be.reverted;
    await expect(rewards.connect(bob).claim(1)).to.be.revertedWithCustomError(
      rewards,
      "NotAssigned",
    );
    await rewards.connect(alice).claim(1);
    expect(await rewards.ownerOf(1)).to.equal(alice.address);
    expect(await rewards.tokenURI(1)).to.equal("ipfs://reward/1.json");
    expect((await reader.rewardInfo(1)).isClaimed).to.equal(true);
    await expect(rewards.connect(alice).claim(1)).to.be.revertedWithCustomError(
      rewards,
      "AlreadyClaimedError",
    );
    await rewards.connect(alice).transferFrom(alice.address, bob.address, 1);
    expect(await rewards.ownerOf(1)).to.equal(bob.address);
    expect((await reader.rewardInfo(1)).assigned).to.equal(alice.address);
    expect((await reader.getStatus()).totalRewardsCreated).to.equal(1);
  });

  it("uses the VRF router to assign a mystery reward before its separate claim", async () => {
    const [owner, alice] = await ethers.getSigners();
    const coordinator = await deploy("MockVrfCoordinatorV2Plus");
    const router = await deploy(
      "BiggiVRFRouter",
      coordinator.address,
      owner.address,
      ethers.utils.hexZeroPad("0xbeef", 32),
      17,
    );
    const rewards = await deploy("BiggiNFTRewards", owner.address);
    await rewards.setVrfRouter(router.address);
    await router.setRewardConsumerApproval(rewards.address, true);
    await rewards.createMysteryEvent(["ipfs://mystery"], [alice.address]);
    await expect(rewards.connect(alice).claim(1)).to.be.revertedWithCustomError(
      rewards,
      "NotAssigned",
    );
    await rewards.requestMysteryRandom(1);
    const pending = await rewards.events(1);
    expect(pending.randomnessRequested).to.equal(true);
    await coordinator.fulfill(router.address, pending.vrfRequestId, 123);
    expect((await rewards.events(1)).finished).to.equal(true);
    expect((await rewards.rewardInfo(1)).isClaimed).to.equal(false);
    await rewards.connect(alice).claim(1);
    expect(await rewards.ownerOf(1)).to.equal(alice.address);
  });
});
