const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: token, drip, tokenRewards, guard smoke", function () {
  let owner;
  let alice;
  let bob;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
  });

  async function deployTokenStack() {
    const token = await deploy("BiggiToken", owner.address);
    const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
    const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
    const nftMain = await deploy("MockBlockNft");
    const nftMain2 = await deploy("MockBlockNft");
    const rewards = await deploy(
      "BiggiTokenRewards",
      nftMain.address,
      nftMain2.address,
      token.address,
      owner.address
    );

    const quoteToken = await deploy("MockERC20", "Quote", "QTE", 18);
    const pair = await deploy("MockPairLite", token.address, quoteToken.address);
    await (await pair.setReserves(toWei("1000000"), toWei("1000000"))).wait();

    const controller = await deploy(
      "BiggiSupplyController",
      owner.address,
      token.address,
      drip.address,
      rewards.address,
      pair.address
    );
    const guardian = await deploy("BiggiSupplyGuardian", owner.address, controller.address);
    const guard = await deploy(
      "BiggiDexReserveGuard",
      owner.address,
      pair.address,
      token.address,
      quoteToken.address,
      controller.address
    );

    await (await token.setReserve(reserve.address)).wait();
    await (await token.setDripDistributor(drip.address)).wait();
    await (await token.setTokenRewards(rewards.address)).wait();
    await (await token.setMarketingSupport(owner.address)).wait();
    await (await token.setSupplyController(controller.address)).wait();
    await (await token.setSupplyGuardian(guardian.address)).wait();
    await (await drip.setTreasury(owner.address)).wait();
    await (await token.initialDistribute()).wait();

    return {
      token,
      reserve,
      drip,
      rewards,
      nftMain,
      nftMain2,
      pair,
      controller,
      guardian,
      guard,
    };
  }

  it("seeds drip + token rewards on initial distribute and syncs drip accounting", async () => {
    const { token, drip, rewards } = await deployTokenStack();

    const dripInitial = toWei("200000000");
    const rewardsInitial = toWei("200000000");
    const totalInitialSupply = toWei("1200000000");
    const remainingAfterInitial = toWei("1000000000");

    expect(await token.distributed()).to.equal(true);
    expect(await token.balanceOf(drip.address)).to.equal(dripInitial);
    expect(await drip.getTotalReceived()).to.equal(dripInitial);
    expect(await drip.getAvailable()).to.equal(dripInitial);
    expect(await token.balanceOf(rewards.address)).to.equal(rewardsInitial);
    expect(await token.totalSupply()).to.equal(totalInitialSupply);
    expect(await token.remainingMintable()).to.equal(remainingAfterInitial);
  });

  it("enforces supply authority and guardian pause on drip/rewards mint legs", async () => {
    const { token, controller } = await deployTokenStack();

    await expect(token.connect(alice).mintToDripDistributor(toWei("1"))).to.be.revertedWith(
      "not supply authority"
    );
    await expect(token.connect(alice).mintToTokenRewards(toWei("1"))).to.be.revertedWith(
      "not supply authority"
    );

    await (await token.setGuardianMintPaused(true)).wait();
    await expect(controller.refillDex(toWei("1"))).to.be.revertedWith("guardian mint paused");
    await expect(controller.refillRewards(toWei("1"))).to.be.revertedWith("guardian mint paused");
  });

  it("keeps rewards operator refill inside the guardian rewards budget", async () => {
    const { token, rewards } = await deployTokenStack();

    await (await token.setRewardsOperator(owner.address)).wait();

    await (await token.refillRewardsIfBelow(toWei("200000001"), toWei("200000010"))).wait();

    expect(await token.balanceOf(rewards.address)).to.equal(toWei("200000010"));
    expect(await token.guardianRewardsMinted()).to.equal(toWei("10"));
  });

  it("prevents rewards operator from bypassing the guardian rewards cap", async () => {
    const { token } = await deployTokenStack();

    await (await token.setRewardsOperator(owner.address)).wait();

    await expect(
      token.refillRewardsIfBelow(toWei("200000001"), toWei("800000001"))
    ).to.be.revertedWith("REWARDS_CAP");
  });

  it("requires guardian wiring and then performs dual maintenance refill", async () => {
    const { token, drip, pair, controller, guardian } = await deployTokenStack();

    await (
      await controller.setDexConfig(
        9000,
        toWei("100"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.setRewardsConfig(toWei("300000000"), toWei("50"), 0)).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await pair.setReserves(toWei("1000"), toWei("1000000"))).wait();

    const beforeReceived = await drip.getTotalReceived();

    await expect(guardian.manualMaintenance()).to.be.revertedWith("not keeper/owner");

    await (await controller.transferOwnership(guardian.address)).wait();
    const [dexNeeded, rewardsNeeded] = await guardian.callStatic.manualMaintenance();
    expect(dexNeeded).to.equal(true);
    expect(rewardsNeeded).to.equal(true);
    await (await guardian.manualMaintenance()).wait();

    expect(await token.guardianDexMinted()).to.equal(toWei("100"));
    expect(await token.guardianRewardsMinted()).to.equal(toWei("50"));
    expect(await drip.getTotalReceived()).to.equal(beforeReceived.add(toWei("100")));
  });

  it("enforces drip distributor total cap for treasury deposits", async () => {
    const { token, drip } = await deployTokenStack();

    const cap = await drip.CAP();
    await (await drip.seedHistoricalState(cap, 0, 0, cap)).wait();

    await (await token.approve(drip.address, toWei("1"))).wait();
    await expect(drip.depositTokens(toWei("1"))).to.be.reverted;
  });

  it("triggers controller dex refill from critical-point guard when reserve depletes", async () => {
    const { token, drip, pair, controller, guard } = await deployTokenStack();

    await (
      await controller.setDexConfig(
        9000,
        toWei("77"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await controller.setAllowedCaller(guard.address, true)).wait();

    await (await guard.setCooldown(0)).wait();
    await (await guard.setReserveRatioBps(9000)).wait();
    await (await guard.snapshotBaseline()).wait();

    const beforeReceived = await drip.getTotalReceived();
    await (await pair.setReserves(toWei("1000"), toWei("1000000"))).wait();

    const performData = ethers.utils.defaultAbiCoder.encode(["uint256"], [toWei("77")]);
    await (await guard.performUpkeep(performData)).wait();

    expect(await token.guardianDexMinted()).to.equal(toWei("77"));
    expect(await drip.getTotalReceived()).to.equal(beforeReceived.add(toWei("77")));
    expect(await guard.lastRefillAt()).to.not.equal(0);
  });

  it("accepts LP price feed as dex guard quote oracle and enforces fresh price sanity", async () => {
    const { token, drip, pair, controller, guard } = await deployTokenStack();

    const feed = await deploy("BiggiLpPriceFeed", token.address, await guard.quoteToken(), pair.address, 18, owner.address);
    await (await feed.updateFromReserves()).wait();
    expect(await feed.latestAnswer()).to.equal(toWei("1"));

    await (
      await controller.setDexConfig(
        9000,
        toWei("33"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await controller.setAllowedCaller(guard.address, true)).wait();

    await (await guard.setCooldown(0)).wait();
    await (await guard.setReserveRatioBps(9000)).wait();
    await (await guard.snapshotBaseline()).wait();
    await (await guard.setQuoteOracle(feed.address)).wait();
    await (await guard.setQuoteOracleConfig(24 * 60 * 60, true)).wait();
    await (await guard.setPriceCheckConfig(true, 500)).wait();
    await (await guard.refreshPriceAnchor()).wait();

    await (await pair.setReserves(toWei("1000"), toWei("1000"))).wait();

    const beforeReceived = await drip.getTotalReceived();
    const performData = ethers.utils.defaultAbiCoder.encode(["uint256"], [toWei("33")]);
    await (await guard.performUpkeep(performData)).wait();

    expect(await token.guardianDexMinted()).to.equal(toWei("33"));
    expect(await drip.getTotalReceived()).to.equal(beforeReceived.add(toWei("33")));

    const status = await guard.quoteOracleStatus();
    expect(status.valid).to.equal(true);
    expect(status.roundDataSupported).to.equal(true);
    expect(status.answerE18).to.equal(toWei("1"));
  });

  it("rejects dex guard refill when required quote oracle is stale", async () => {
    const { pair, controller, guard } = await deployTokenStack();

    const feed = await deploy("BiggiLpPriceFeed", await guard.token(), await guard.quoteToken(), pair.address, 18, owner.address);
    await (await feed.updateFromReserves()).wait();

    await (
      await controller.setDexConfig(
        9000,
        toWei("10"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await controller.setAllowedCaller(guard.address, true)).wait();

    await (await guard.setCooldown(0)).wait();
    await (await guard.setReserveRatioBps(9000)).wait();
    await (await guard.snapshotBaseline()).wait();
    await (await guard.setQuoteOracle(feed.address)).wait();
    await (await guard.setQuoteOracleConfig(1, true)).wait();
    await (await guard.setPriceCheckConfig(true, 500)).wait();

    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine");
    await (await pair.setReserves(toWei("1000"), toWei("1000"))).wait();

    const performData = ethers.utils.defaultAbiCoder.encode(["uint256"], [toWei("10")]);
    await expect(guard.performUpkeep(performData)).to.be.reverted;
  });

  it("uses upkeep performData hints for deterministic execution", async () => {
    const { token, pair, controller } = await deployTokenStack();

    await (
      await controller.setDexConfig(
        9000,
        toWei("10"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.setRewardsConfig(toWei("300000000"), toWei("25"), 0)).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await pair.setReserves(toWei("1000"), toWei("1000000"))).wait();

    // Only rewards leg allowed.
    const rewardsOnlyData = ethers.utils.defaultAbiCoder.encode(["bool", "bool"], [false, true]);
    await (await controller.performUpkeep(rewardsOnlyData)).wait();

    expect(await token.guardianDexMinted()).to.equal(0);
    expect(await token.guardianRewardsMinted()).to.equal(toWei("25"));
  });

  it("keeps dex and rewards single checks isolated", async () => {
    const { token, pair, controller } = await deployTokenStack();

    await (
      await controller.setDexConfig(
        9000,
        toWei("10"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.setRewardsConfig(toWei("300000000"), toWei("25"), 0)).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await pair.setReserves(toWei("1000"), toWei("1000000"))).wait();

    expect(await controller.callStatic.checkDexDepletion()).to.equal(true);
    await (await controller.checkDexDepletion()).wait();
    expect(await token.guardianDexMinted()).to.equal(toWei("10"));
    expect(await token.guardianRewardsMinted()).to.equal(0);

    expect(await controller.callStatic.checkRewardsThreshold()).to.equal(true);
    await (await controller.checkRewardsThreshold()).wait();
    expect(await token.guardianRewardsMinted()).to.equal(toWei("25"));
  });

  it("locks reserve target after initial distribution", async () => {
    const { token } = await deployTokenStack();

    await expect(token.setReserve(alice.address)).to.be.revertedWith("reserve locked");
  });

  it("enforces strict notify caller mode on reserve when enabled", async () => {
    const { token, reserve } = await deployTokenStack();

    await (await token.transfer(reserve.address, toWei("5"))).wait();
    await (await reserve.setNotifyCallerCheck(true)).wait();

    await expect(reserve.connect(alice).notifyBiggiReceived(toWei("1"))).to.be.reverted;

    await (await reserve.setNotifyCaller(alice.address, true)).wait();
    await (await reserve.connect(alice).notifyBiggiReceived(toWei("1"))).wait();
    expect(await reserve.availableForDexRefill()).to.equal(toWei("1"));
  });

  it("trips circuit breaker when dex reserve stays below critical floor", async () => {
    const { token, pair, controller } = await deployTokenStack();

    await (await controller.setCircuitBreakerConfig(true, toWei("500"), toWei("500"))).wait();
    await (
      await controller.setDexConfig(
        9000,
        toWei("10"),
        0,
        0,
        false
      )
    ).wait();
    await (await controller.snapshotBaseline()).wait();
    await (await pair.setReserves(toWei("100"), toWei("1000000"))).wait();

    await (await controller.performMaintenance()).wait();

    expect(await token.guardianDexMinted()).to.equal(toWei("10"));
    expect(await controller.paused()).to.equal(true);
    await expect(controller.performMaintenance()).to.be.reverted;
  });

  it("distributes weighted token rewards across VRF + public collections", async () => {
    const { token, rewards, nftMain, nftMain2 } = await deployTokenStack();

    await (await nftMain.mint(alice.address, 1, 3)).wait(); // weight 30
    await (await nftMain2.mint(alice.address, 2, 7)).wait(); // weight 70

    await (await rewards.setUnitReward(toWei("3000000"))).wait();
    await (await token.transferOwnership(rewards.address)).wait();

    await (
      await rewards
        .connect(alice)
        .claimWithCollections([nftMain.address, nftMain2.address], [1, 2])
    ).wait();

    // 100 weighted units * 3,000,000 BIGGI
    const expectedPayout = toWei("300000000");
    expect(await token.balanceOf(alice.address)).to.equal(expectedPayout);
    expect(await rewards.rewardsMinted()).to.equal(toWei("100000000"));

    await expect(
      rewards.connect(alice).claimWithCollections([nftMain.address, nftMain2.address], [1, 2])
    ).to.be.reverted;
  });

  it("uses dynamic token rewards budget while preserving rarity weights", async () => {
    const { token, rewards, nftMain, nftMain2 } = await deployTokenStack();

    const emission = await deploy(
      "BiggiTokenRewardsEmissionController",
      rewards.address,
      ethers.constants.AddressZero,
      token.address,
      owner.address
    );

    await (await emission.setTargetWeeklyUnits(100)).wait();
    await (
      await emission.setBudgetConfig(
        toWei("50"),
        toWei("50"),
        toWei("50"),
        toWei("50"),
        toWei("50"),
        toWei("50"),
        10000
      )
    ).wait();
    await (await rewards.setEmissionController(emission.address, true)).wait();

    await (await nftMain.mint(alice.address, 1, 3)).wait(); // 30 units
    await (await nftMain2.mint(bob.address, 2, 7)).wait(); // 70 units

    const alicePreview = await rewards.connect(alice).claimablePreviewFor([nftMain.address], [1]);
    const bobPreview = await rewards.connect(bob).claimablePreviewFor([nftMain2.address], [2]);

    expect(alicePreview.units).to.equal(30);
    expect(alicePreview.amount).to.equal(toWei("15"));
    expect(bobPreview.units).to.equal(70);
    expect(bobPreview.amount).to.equal(toWei("35"));

    await (await rewards.connect(alice).claimWithCollections([nftMain.address], [1])).wait();
    await (await rewards.connect(bob).claimWithCollections([nftMain2.address], [2])).wait();

    expect(await token.balanceOf(alice.address)).to.equal(toWei("15"));
    expect(await token.balanceOf(bob.address)).to.equal(toWei("35"));

    const week = await rewards.currentWeek();
    const state = await emission.weekState(week);
    expect(state.budget).to.equal(toWei("50"));
    expect(state.paid).to.equal(toWei("50"));
    expect(state.unitReward).to.equal(toWei("0.5"));
  });

  it("rejects token rewards claims that exceed the weekly dynamic budget", async () => {
    const { token, rewards, nftMain } = await deployTokenStack();

    const emission = await deploy(
      "BiggiTokenRewardsEmissionController",
      rewards.address,
      ethers.constants.AddressZero,
      token.address,
      owner.address
    );

    await (await emission.setTargetWeeklyUnits(100)).wait();
    await (
      await emission.setBudgetConfig(
        toWei("50"),
        toWei("50"),
        toWei("50"),
        toWei("50"),
        toWei("50"),
        toWei("50"),
        10000
      )
    ).wait();
    await (await rewards.setEmissionController(emission.address, true)).wait();

    await (await nftMain.mint(alice.address, 1, 10)).wait(); // 100 units => 50 BIGGI
    await (await nftMain.mint(alice.address, 2, 10)).wait(); // 100 units => 50 BIGGI

    const previewTooLarge = await rewards.connect(alice).claimablePreviewFor(
      [nftMain.address, nftMain.address],
      [1, 2]
    );
    expect(previewTooLarge.units).to.equal(200);
    expect(previewTooLarge.amount).to.equal(0);

    await expect(
      rewards.connect(alice).claimWithCollections([nftMain.address, nftMain.address], [1, 2])
    ).to.be.reverted;

    await (await rewards.connect(alice).claimWithCollections([nftMain.address], [1])).wait();
    expect(await token.balanceOf(alice.address)).to.equal(toWei("50"));
  });

  it("accepts future VRF collections via registry and follows eligibility toggles", async () => {
    const { token, rewards } = await deployTokenStack();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const futureVrf = await deploy("MockBlockNft");
    const futurePublic = await deploy("MockBlockNft");
    const futureHub = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("FUTURE")).wait();
    await (await registry.createChapter(1)).wait(); // chapterId 1
    await (await registry.setChapterCollections(1, futureVrf.address, futurePublic.address, futureHub.address)).wait();

    await (await rewards.setRegistry(registry.address)).wait();
    await (await token.mint(rewards.address, toWei("1000"))).wait();
    await (await futureVrf.mint(alice.address, 77, 10)).wait(); // block 10 => weight 100

    expect(await rewards.isAllowedCollection(futureVrf.address)).to.equal(true);
    expect(await rewards.isAllowedCollection(futurePublic.address)).to.equal(true);

    const preview = await rewards.connect(alice).claimablePreviewFor([futureVrf.address], [77]);
    expect(preview.units).to.equal(100);
    expect(preview.amount).to.equal(toWei("100"));

    const before = await token.balanceOf(alice.address);
    await (await rewards.connect(alice).claimWithCollections([futureVrf.address], [77])).wait();
    const after = await token.balanceOf(alice.address);
    expect(after.sub(before)).to.equal(toWei("100"));

    await (await registry.setRewardsEligibility(1, false, true, true)).wait();
    expect(await rewards.isAllowedCollection(futureVrf.address)).to.equal(false);
    expect(await rewards.isAllowedCollection(futurePublic.address)).to.equal(true);

    await expect(
      rewards.connect(alice).claimWithCollections([futureVrf.address], [77])
    ).to.be.reverted;
  });

  it("keeps legacy main collections claimable after registry mode is enabled", async () => {
    const { token, rewards, nftMain } = await deployTokenStack();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    await (await rewards.setRegistry(registry.address)).wait();
    await (await token.mint(rewards.address, toWei("1000"))).wait();
    await (await nftMain.mint(alice.address, 11, 4)).wait(); // block 4 => weight 40

    const preview = await rewards.connect(alice).claimablePreview([11]);
    expect(preview.units).to.equal(40);
    expect(preview.amount).to.equal(toWei("40"));

    const before = await token.balanceOf(alice.address);
    await (await rewards.connect(alice).claim([11])).wait();
    const after = await token.balanceOf(alice.address);
    expect(after.sub(before)).to.equal(toWei("40"));
  });
});
