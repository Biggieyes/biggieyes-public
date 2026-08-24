const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: multicollection + rewards consistency smoke", function () {
  it("scales collection rewards across multiple eligible VRF collections", async () => {
    const [owner, alice, bob] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const main1 = await deploy("MockCollectionMainView");
    const main2 = await deploy("MockCollectionMainView");
    const pub1 = await deploy("MockMintShareReceiver");
    const pub2 = await deploy("MockMintShareReceiver");
    const hub1 = await deploy("MockMintShareReceiver");
    const hub2 = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait(); // chapterId 1
    await (await registry.createChapter(1)).wait(); // chapterId 2
    await (await registry.setChapterCollections(1, main1.address, pub1.address, hub1.address)).wait();
    await (await registry.setChapterCollections(2, main2.address, pub2.address, hub2.address)).wait();

    const rewards = await deploy("BiggiCollectionRewards", main1.address, owner.address);
    await (await rewards.setRegistry(registry.address)).wait();
    await (await rewards.setRewardsAmounts(toWei("1"), toWei("2"), toWei("3"))).wait();
    await (await rewards.configureCollectionBudget(main1.address)).wait();
    await (await rewards.configureCollectionBudget(main2.address)).wait();
    await (await rewards.fundCollectionBudget(main1.address, { value: toWei("31") })).wait();
    await (await rewards.fundCollectionBudget(main2.address, { value: toWei("31") })).wait();

    await (await main1.setHasAllTenMainIdsInBlock(alice.address, 1, true)).wait();
    await (await main2.setHasAllTenMainIdsInBlock(bob.address, 1, true)).wait();
    await (await main1.setHasAllBackgroundsForMainIdInBlock(alice.address, 1, 1, true)).wait();
    await (await main2.setHasAllBackgroundsForMainIdInBlock(bob.address, 1, 1, true)).wait();
    await (await main1.setHasAllTenMainIdsInBlock(alice.address, 10, true)).wait();
    await (await main2.setHasAllTenMainIdsInBlock(bob.address, 10, true)).wait();

    await (await rewards.connect(alice).claimBlockRewardFor(main1.address, 1)).wait();
    await (await rewards.connect(bob).claimBlockRewardFor(main2.address, 1)).wait();
    await (await rewards.connect(alice).claimOrangeRewardFor(main1.address, 1)).wait();
    await (await rewards.connect(bob).claimOrangeRewardFor(main2.address, 1)).wait();
    await (await rewards.connect(alice).claimRainbowRewardFor(main1.address)).wait();
    await (await rewards.connect(bob).claimRainbowRewardFor(main2.address)).wait();

    expect(await rewards.blockWinnersCount(main1.address)).to.equal(1);
    expect(await rewards.blockWinnersCount(main2.address)).to.equal(1);
    expect(await rewards.orangeWinnersCount(main1.address)).to.equal(1);
    expect(await rewards.orangeWinnersCount(main2.address)).to.equal(1);
    expect(await rewards.rainbowRewardClaimedGlobal(main1.address)).to.equal(true);
    expect(await rewards.rainbowRewardClaimedGlobal(main2.address)).to.equal(true);
    expect(await ethers.provider.getBalance(rewards.address)).to.equal(toWei("50"));

    await expect(
      rewards.connect(alice).claimBlockRewardFor(main1.address, 1)
    ).to.be.reverted;
    await expect(
      rewards.connect(bob).claimOrangeRewardFor(main1.address, 1)
    ).to.be.reverted;
    await expect(
      rewards.connect(bob).claimRainbowRewardFor(main1.address)
    ).to.be.reverted;

    await expect(
      rewards.connect(alice).claimBlockRewardFor(pub1.address, 1)
    ).to.be.reverted;
  });

  it("unlocks claims only after each collection reaches its own full budget", async () => {
    const [owner, alice] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const main1 = await deploy("MockCollectionMainView");
    const main2 = await deploy("MockCollectionMainView");
    const pub1 = await deploy("MockMintShareReceiver");
    const pub2 = await deploy("MockMintShareReceiver");
    const hub1 = await deploy("MockMintShareReceiver");
    const hub2 = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.setChapterCollections(1, main1.address, pub1.address, hub1.address)).wait();
    await (await registry.setChapterCollections(2, main2.address, pub2.address, hub2.address)).wait();

    const rewards = await deploy("BiggiCollectionRewards", main1.address, owner.address);
    await (await rewards.setRegistry(registry.address)).wait();
    await (await rewards.setRewardsAmounts(toWei("1"), toWei("2"), toWei("3"))).wait();
    await (await rewards.configureCollectionBudget(main1.address)).wait();
    await (await rewards.configureCollectionBudget(main2.address)).wait();

    await (await main1.setHasAllTenMainIdsInBlock(alice.address, 1, true)).wait();
    await (await main2.setHasAllTenMainIdsInBlock(alice.address, 1, true)).wait();

    await (await rewards.fundCollectionBudget(main1.address, { value: toWei("30") })).wait();
    let preview = await rewards.canClaimBlockFor(main1.address, alice.address, 1);
    expect(preview.ok).to.equal(false);
    expect(preview.reason).to.equal(9);
    await expect(
      rewards.connect(alice).claimBlockRewardFor(main1.address, 1)
    ).to.be.revertedWithCustomError(rewards, "ClaimsBudgetLocked");

    await expect(rewards.fundCollectionBudget(main1.address, { value: toWei("1") }))
      .to.emit(rewards, "CollectionClaimsEnabled")
      .withArgs(main1.address, toWei("31"), toWei("31"));

    preview = await rewards.canClaimBlockFor(main1.address, alice.address, 1);
    expect(preview.ok).to.equal(true);

    const main2Before = await rewards.collectionBudgetSnapshot(main2.address);
    expect(main2Before.claimsEnabled).to.equal(false);
    expect(main2Before.fundedBudget).to.equal(0);

    await (await rewards.connect(alice).claimBlockRewardFor(main1.address, 1)).wait();
    const main1After = await rewards.collectionBudgetSnapshot(main1.address);
    expect(main1After.claimsEnabled).to.equal(true);
    expect(main1After.spentBudget).to.equal(toWei("2"));
    expect(main1After.availableBudget).to.equal(toWei("29"));

    preview = await rewards.canClaimBlockFor(main2.address, alice.address, 1);
    expect(preview.ok).to.equal(false);
    expect(preview.reason).to.equal(9);
  });

  it("tracks chapter attribution, pending retries, and reader snapshots", async () => {
    const [owner] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const source = await deploy("MockDistributorSource");
    const pub = await deploy("MockMintShareReceiver");
    const hub = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait(); // chapterId 1
    await (await registry.setChapterCollections(1, source.address, pub.address, hub.address)).wait();

    const distributor = await deploy("BiggiMultiCollectionDistributor", owner.address);
    const collectionRewards = await deploy("BiggiCollectionRewards", source.address, owner.address);
    const reserve = await deploy("MockMintShareReceiver");
    const buyback = await deploy("MockMintShareReceiver");
    const treasury = await deploy("MockMintShareReceiver");
    const community = await deploy("MockRejectReceiver");
    await (await collectionRewards.setDistributor(distributor.address)).wait();
    await (await collectionRewards.setFundingCollection(source.address)).wait();

    await (await distributor.setRegistry(registry.address)).wait();
    await (await distributor.setCollectionRewards(collectionRewards.address)).wait();
    await (await distributor.setReserve(reserve.address)).wait();
    await (await distributor.setBuybackAgent(buyback.address)).wait();
    await (await distributor.setTreasury(treasury.address)).wait();
    await (await distributor.setCommunityCenter(community.address)).wait();
    await (await distributor.addCollection(source.address)).wait();

    await (await source.forwardDistribute(distributor.address, { value: toWei("10") })).wait();

    expect(await distributor.totalReceived()).to.equal(toWei("10"));
    expect(await distributor.receivedByCollection(source.address)).to.equal(toWei("10"));
    expect(await distributor.receivedByChapter(1)).to.equal(toWei("10"));
    expect(await distributor.receivedBySeries(1)).to.equal(toWei("10"));
    expect(await distributor.pending(community.address)).to.equal(toWei("1"));
    expect(await distributor.totalPending()).to.equal(toWei("1"));

    await (await community.setReject(false)).wait();
    await (await distributor.retryPending(community.address)).wait();

    expect(await distributor.pending(community.address)).to.equal(0);
    expect(await distributor.totalPending()).to.equal(0);
    expect(await community.totalReceived()).to.equal(toWei("1"));
    const budget = await collectionRewards.collectionBudgetSnapshot(source.address);
    expect(budget.fundedBudget).to.equal(toWei("2.5"));
    expect(budget.claimsEnabled).to.equal(false);

    const reader = await deploy("BiggiMultiCollectionDistributorReaderV2", distributor.address);
    const sourceSnapshot = await reader.sourceSnapshot(source.address);
    expect(sourceSnapshot.whitelisted).to.equal(true);
    expect(sourceSnapshot.totalForSource).to.equal(toWei("10"));
    expect(sourceSnapshot.chapterId).to.equal(1);
    expect(sourceSnapshot.seriesId).to.equal(1);

    const full = await reader.fullSnapshot(source.address, community.address);
    expect(full.totalReceived_).to.equal(toWei("10"));
    expect(full.totalPending_).to.equal(0);
    expect(full.pendingForRecipient).to.equal(0);
    expect(full.collectionRewards_).to.equal(collectionRewards.address);
    expect(full.reserve_).to.equal(reserve.address);
    expect(full.buybackAgent_).to.equal(buyback.address);
    expect(full.treasury_).to.equal(treasury.address);
    expect(full.communityCenter_).to.equal(community.address);
    expect(full.registry_).to.equal(registry.address);
  });

  it("routes native split to integrated recipients (rewards/reserve/buyback/treasury/community)", async () => {
    const [owner] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const source = await deploy("MockDistributorSource");
    const pub = await deploy("MockMintShareReceiver");
    const hub = await deploy("MockMintShareReceiver");

    const token = await deploy("BiggiToken", owner.address);
    const distributor = await deploy("BiggiMultiCollectionDistributor", owner.address);
    const mainView = await deploy("MockCollectionMainView");
    const collectionRewards = await deploy("BiggiCollectionRewards", mainView.address, owner.address);
    const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
    const buyback = await deploy("BiggiBuybackAgent", token.address, owner.address);
    const treasury = await deploy("BiggiTreasury", token.address, owner.address);
    const community = await deploy("BiggiCommunityCenter", owner.address);

    await (await buyback.toggleAutoBuyback(false)).wait();
    await (await collectionRewards.setFundingCollection(mainView.address)).wait();

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait(); // chapterId 1
    await (await registry.setChapterCollections(1, source.address, pub.address, hub.address)).wait();

    await (await collectionRewards.setDistributor(distributor.address)).wait();
    await (await reserve.setDistributor(distributor.address)).wait();
    await (await treasury.setDistributor(distributor.address)).wait();
    await (await community.setDistributor(distributor.address)).wait();
    await (await buyback.setDistributor(distributor.address)).wait();

    await (await distributor.setRegistry(registry.address)).wait();
    await (await distributor.setCollectionRewards(collectionRewards.address)).wait();
    await (await distributor.setReserve(reserve.address)).wait();
    await (await distributor.setBuybackAgent(buyback.address)).wait();
    await (await distributor.setTreasury(treasury.address)).wait();
    await (await distributor.setCommunityCenter(community.address)).wait();
    await (await distributor.addCollection(source.address)).wait();

    const value = toWei("10");
    const expectedCollection = value.mul(2500).div(10000);
    const expectedReserve = value.mul(3500).div(10000);
    const expectedBuyback = value.mul(2000).div(10000);
    const expectedTreasury = value.mul(1000).div(10000);
    const expectedCommunity = value.mul(1000).div(10000);

    const beforeRewardsNative = await ethers.provider.getBalance(collectionRewards.address);
    await (await source.forwardDistribute(distributor.address, { value })).wait();

    expect(await distributor.totalReceived()).to.equal(value);
    expect(await distributor.receivedByCollection(source.address)).to.equal(value);
    expect(await distributor.receivedByChapter(1)).to.equal(value);
    expect(await distributor.receivedBySeries(1)).to.equal(value);
    expect(await distributor.totalPending()).to.equal(0);

    expect(await ethers.provider.getBalance(collectionRewards.address)).to.equal(
      beforeRewardsNative.add(expectedCollection)
    );
    expect(await reserve.totalPolReceived()).to.equal(expectedReserve);
    expect(await buyback.totalNativeReceived()).to.equal(expectedBuyback);
    expect(await treasury.totalPolReceivedFromDistributor()).to.equal(expectedTreasury);
    expect(await community.poolBalance()).to.equal(expectedCommunity);

    const distributedSum = expectedCollection
      .add(expectedReserve)
      .add(expectedBuyback)
      .add(expectedTreasury)
      .add(expectedCommunity);
    expect(distributedSum).to.equal(value);
  });

  it("attributes central TicketHub native mints to the explicit chapter", async () => {
    const [owner, alice] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const main1 = await deploy("MockCollectionMainView");
    const main2 = await deploy("MockCollectionMainView");
    const public1 = await deploy("MockMintShareReceiver");
    const public2 = await deploy("MockMintShareReceiver");
    const ticketHub = await deploy("BiggiTicketHub", owner.address, main1.address);
    const distributor = await deploy("BiggiMultiCollectionDistributor", owner.address);
    const collectionRewards = await deploy("BiggiCollectionRewards", main1.address, owner.address);
    const reserve = await deploy("MockMintShareReceiver");
    const buyback = await deploy("MockMintShareReceiver");
    const treasury = await deploy("MockMintShareReceiver");
    const community = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.setChapterCollections(1, main1.address, public1.address, ticketHub.address)).wait();
    await (await registry.setChapterCollections(2, main2.address, public2.address, ticketHub.address)).wait();

    await (await collectionRewards.setRegistry(registry.address)).wait();
    await (await collectionRewards.setDistributor(distributor.address)).wait();
    await (await collectionRewards.setFundingCollection(main2.address)).wait();

    await (await distributor.setRegistry(registry.address)).wait();
    await (await distributor.setCollectionRewards(collectionRewards.address)).wait();
    await (await distributor.setReserve(reserve.address)).wait();
    await (await distributor.setBuybackAgent(buyback.address)).wait();
    await (await distributor.setTreasury(treasury.address)).wait();
    await (await distributor.setCommunityCenter(community.address)).wait();
    await (await distributor.addCollection(ticketHub.address)).wait();

    await (await ticketHub.configureChapter(2, main2.address, 500, 50, "ipfs://chapter-2/")).wait();
    await (await ticketHub.setDistributor(distributor.address)).wait();
    await (await ticketHub.setChapterActive(2, true)).wait();

    const ticketPrice = await ticketHub.ticketPrice();
    const distributed = ticketPrice.mul(6000).div(10000);
    await (await ticketHub.connect(alice).mintTicketForChapter(2, { value: ticketPrice })).wait();

    expect(await distributor.receivedByCollection(ticketHub.address)).to.equal(distributed);
    expect(await distributor.receivedByChapter(1)).to.equal(0);
    expect(await distributor.receivedByChapter(2)).to.equal(distributed);
    expect(await distributor.receivedBySeries(1)).to.equal(distributed);
    const chapterBudget = await collectionRewards.collectionBudgetSnapshot(main2.address);
    expect(chapterBudget.fundedBudget).to.equal(distributed.mul(2500).div(10000));
    expect(chapterBudget.fundedBudget).to.equal(ticketPrice.mul(1500).div(10000));
    expect(chapterBudget.claimsEnabled).to.equal(false);
  });

  it("does not block native distribution when optional registry attribution is misconfigured", async () => {
    const [owner] = await ethers.getSigners();

    const source = await deploy("MockDistributorSource");
    const distributor = await deploy("BiggiMultiCollectionDistributor", owner.address);
    const collectionRewards = await deploy("MockMintShareReceiver");
    const reserve = await deploy("MockMintShareReceiver");
    const buyback = await deploy("MockMintShareReceiver");
    const treasury = await deploy("MockMintShareReceiver");
    const community = await deploy("MockMintShareReceiver");
    const notRegistry = await deploy("MockMintShareReceiver");

    await (await distributor.setRegistry(notRegistry.address)).wait();
    await (await distributor.setCollectionRewards(collectionRewards.address)).wait();
    await (await distributor.setReserve(reserve.address)).wait();
    await (await distributor.setBuybackAgent(buyback.address)).wait();
    await (await distributor.setTreasury(treasury.address)).wait();
    await (await distributor.setCommunityCenter(community.address)).wait();
    await (await distributor.addCollection(source.address)).wait();

    const value = toWei("10");
    await expect(source.forwardDistribute(distributor.address, { value }))
      .to.emit(distributor, "ChapterAttributionFailed")
      .withArgs(source.address, notRegistry.address, value);

    expect(await distributor.totalReceived()).to.equal(value);
    expect(await distributor.receivedByCollection(source.address)).to.equal(value);
    expect(await distributor.receivedByChapter(1)).to.equal(0);
    expect(await collectionRewards.totalReceived()).to.equal(value.mul(2500).div(10000));
    expect(await reserve.totalReceived()).to.equal(value.mul(3500).div(10000));
    expect(await buyback.totalReceived()).to.equal(value.mul(2000).div(10000));
    expect(await treasury.totalReceived()).to.equal(value.mul(1000).div(10000));
    expect(await community.totalReceived()).to.equal(value.mul(1000).div(10000));
  });

  it("keeps default main collection claimable after registry mode is enabled", async () => {
    const [owner, alice] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const defaultMain = await deploy("MockCollectionMainView");
    const futureMain = await deploy("MockCollectionMainView");
    const pub = await deploy("MockMintShareReceiver");
    const hub = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.setChapterCollections(1, futureMain.address, pub.address, hub.address)).wait();

    const rewards = await deploy("BiggiCollectionRewards", defaultMain.address, owner.address);
    await (await rewards.setRegistry(registry.address)).wait();
    await (await rewards.setRewardsAmounts(toWei("1"), toWei("2"), toWei("3"))).wait();
    await (await rewards.configureCollectionBudget(defaultMain.address)).wait();
    await (await rewards.fundCollectionBudget(defaultMain.address, { value: toWei("31") })).wait();

    await (await defaultMain.setHasAllTenMainIdsInBlock(alice.address, 1, true)).wait();

    const preview = await rewards.canClaimBlockFor(defaultMain.address, alice.address, 1);
    expect(preview.ok).to.equal(true);
    expect(preview.reason).to.equal(0);

    await (await rewards.connect(alice).claimBlockRewardFor(defaultMain.address, 1)).wait();
    expect(await rewards.blockWinnersCount(defaultMain.address)).to.equal(1);
  });
});
