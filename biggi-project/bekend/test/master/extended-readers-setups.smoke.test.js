const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployMainWithLinkedLibraries(initialOwner) {
  const namesLib = await deploy("BiggiNamesLib");
  const mainFactory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: {
      BiggiNamesLib: namesLib.address,
    },
  });
  const main = await mainFactory.deploy(initialOwner);
  await main.deployed();
  return main;
}

describe("BIGGI_MASTER: extended readers + setup wrappers smoke", function () {
  it("covers reserve/treasury/system/tokenRewards/supply readers and buyback reader", async () => {
    const [owner] = await ethers.getSigners();

    const nftMain = await deploy("MockBlockNft");
    const nftMain2 = await deploy("MockBlockNft");
    const token = await deploy("BiggiToken", owner.address);
    const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
    const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
    const rewards = await deploy("BiggiTokenRewards", nftMain.address, nftMain2.address, token.address, owner.address);
    const treasury = await deploy("BiggiTreasury", token.address, owner.address);
    const policy = await deploy("BiggiPolicy", owner.address);
    const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
    const pair = await deploy("MockPairLite", token.address, weth.address);
    const buybackRouter = await deploy("MockBuybackRouter", weth.address);
    const dripLm = await deploy("MockDripLM");
    const buyback = await deploy("BiggiBuybackAgent", token.address, owner.address);

    await (await pair.setReserves(toWei("1000"), toWei("1000"))).wait();

    const controller = await deploy(
      "BiggiSupplyController",
      owner.address,
      token.address,
      drip.address,
      rewards.address,
      pair.address
    );
    const guardian = await deploy("BiggiSupplyGuardian", owner.address, controller.address);
    const masterConfig = await deploy("BiggiMasterTokenomicsConfig", owner.address);

    await (await token.setReserve(reserve.address)).wait();
    await (await token.setDripDistributor(drip.address)).wait();
    await (await token.setTokenRewards(rewards.address)).wait();
    await (await token.setMarketingSupport(owner.address)).wait();
    await (await token.setSupplyController(controller.address)).wait();
    await (await token.setSupplyGuardian(guardian.address)).wait();
    await (await token.initialDistribute()).wait();

    await (await treasury.setBuybackAgent(buyback.address)).wait();
    await (await treasury.setTokenRewards(rewards.address)).wait();
    await (await treasury.setReserve(reserve.address)).wait();
    await (await treasury.setDripDistributor(drip.address)).wait();
    await (await drip.setTreasury(treasury.address)).wait();
    await (await reserve.setNotifyCaller(treasury.address, true)).wait();
    await (await treasury.setEcosystemBiggiCaller(nftMain.address, true)).wait();
    await (await treasury.setEcosystemBiggiCaller(nftMain2.address, true)).wait();

    await (await buyback.setRouter(buybackRouter.address)).wait();
    await (await buyback.setTreasury(treasury.address)).wait();
    await (await buyback.setPolicy(policy.address)).wait();
    await (await policy.setBuybackAgent(buyback.address)).wait();
    await (await buyback.setDripLM(dripLm.address)).wait();

    await (await controller.snapshotBaseline()).wait();
    await (await masterConfig.setSupplyController(controller.address)).wait();
    await (await masterConfig.setSupplyGuardian(guardian.address)).wait();

    const reserveTreasuryReader = await deploy("BiggiReserveTreasuryReader", reserve.address, treasury.address);
    const tokenRewardsReader = await deploy("BiggiTokenRewardsReader", rewards.address);
    const supplyGuardianReader = await deploy("BiggiSupplyGuardianReader", guardian.address);
    const systemReader = await deploy("BiggiSystemReader", token.address, controller.address, guardian.address);
    const addonReader = await deploy("BiggiTokenomicsSystemAddonReader", masterConfig.address, token.address);
    const upkeepProxy = await deploy("BiggiBuybackUpkeepProxy", owner.address);
    const buybackReader = await deploy("BiggiBuybackReader", buyback.address, treasury.address, policy.address, upkeepProxy.address);

    await (await upkeepProxy.setAgent(buyback.address)).wait();
    await (await upkeepProxy.setThreshold(toWei("1"))).wait();

    const reserveSnap = await reserveTreasuryReader.reserveSnapshot();
    const treasurySnap = await reserveTreasuryReader.treasurySnapshot();
    const reserveTreasuryWiring = await reserveTreasuryReader.wiringSnapshot();
    const ecosystemRoute = await reserveTreasuryReader.ecosystemBiggiRouteSnapshot(
      nftMain.address,
      nftMain2.address,
      rewards.address,
      drip.address
    );
    expect(reserveSnap.reserveBiggi).to.be.gt(0);
    expect(treasurySnap.totalBiggiFromBuyback).to.equal(0);
    expect(treasurySnap.totalBiggiFromEcosystem).to.equal(0);
    expect(reserveTreasuryWiring.treasuryTokenRewards).to.equal(rewards.address);
    expect(ecosystemRoute.routeReady).to.equal(true);

    const [rewardsStatus] = await tokenRewardsReader.getStatus();
    expect(rewardsStatus.tokenRewards).to.equal(rewards.address);
    await tokenRewardsReader.getBlockWeights();
    await tokenRewardsReader.getTokenMeta();
    await tokenRewardsReader.preview([]);
    await tokenRewardsReader.previewFor([], []);

    const guardianStatus = await supplyGuardianReader.getStatus();
    expect(guardianStatus.guardian).to.equal(guardian.address);
    expect(guardianStatus.controller).to.equal(controller.address);

    const systemSnap = await systemReader.snapshot();
    expect(systemSnap.t.token).to.equal(token.address);
    expect(systemSnap.c.controller).to.equal(controller.address);
    expect(systemSnap.g.guardian).to.equal(guardian.address);

    const addonStatus = await addonReader.getStatus();
    expect(addonStatus.masterConfig).to.equal(masterConfig.address);
    expect(addonStatus.core.biggi).to.equal(ethers.constants.AddressZero);
    expect(addonStatus.supplyController).to.equal(controller.address);
    expect(addonStatus.supplyGuardian).to.equal(guardian.address);

    const buybackSnap = await buybackReader.snapshot();
    expect(buybackSnap.a.router).to.equal(buybackRouter.address);
    expect(buybackSnap.a.treasury).to.equal(treasury.address);
    expect(buybackSnap.a.policy).to.equal(policy.address);
    expect(buybackSnap.k.agent).to.equal(buyback.address);
  });

  it("covers buyback-drip setup and liquidity setup wrappers + lp price feed", async () => {
    const [owner] = await ethers.getSigners();

    const nftMain = await deploy("MockBlockNft");
    const nftMain2 = await deploy("MockBlockNft");
    const token = await deploy("BiggiToken", owner.address);
    const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
    const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
    const rewards = await deploy("BiggiTokenRewards", nftMain.address, nftMain2.address, token.address, owner.address);
    const treasury = await deploy("BiggiTreasury", token.address, owner.address);
    const policy = await deploy("BiggiPolicy", owner.address);
    const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
    const pairLite = await deploy("MockPairLite", token.address, weth.address);
    const buybackRouter = await deploy("MockBuybackRouter", weth.address);
    const buyback = await deploy("BiggiBuybackAgent", token.address, owner.address);
    const dripLm = await deploy("BiggiDripLMToModerator", token.address, buybackRouter.address, owner.address);
    const controller = await deploy(
      "BiggiSupplyController",
      owner.address,
      token.address,
      drip.address,
      rewards.address,
      pairLite.address
    );

    await (await pairLite.setReserves(toWei("1000"), toWei("1000"))).wait();
    await (await token.setReserve(reserve.address)).wait();
    await (await token.setDripDistributor(drip.address)).wait();
    await (await token.setTokenRewards(rewards.address)).wait();
    await (await token.setMarketingSupport(owner.address)).wait();
    await (await token.initialDistribute()).wait();
    await (await treasury.setBuybackAgent(buyback.address)).wait();
    await (await treasury.setTokenRewards(rewards.address)).wait();
    await (await treasury.setReserve(reserve.address)).wait();
    await (await treasury.setDripDistributor(drip.address)).wait();

    const buybackSetup = await deploy(
      "BiggiBuybackDripSetup",
      owner.address,
      buyback.address,
      dripLm.address,
      drip.address,
      reserve.address,
      treasury.address,
      buybackRouter.address,
      policy.address
    );

    await (await buyback.transferOwnership(buybackSetup.address)).wait();
    await (await dripLm.transferOwnership(buybackSetup.address)).wait();
    await (await drip.transferOwnership(buybackSetup.address)).wait();
    await (await token.transferOwnership(buybackSetup.address)).wait();
    await (await controller.transferOwnership(buybackSetup.address)).wait();

    await (
      await buybackSetup.runAllAndWireSupply(
        [weth.address, token.address],
        500,
        600,
        0,
        true,
        40,
        300,
        600,
        treasury.address,
        toWei("1"),
        token.address,
        controller.address,
        pairLite.address,
        false
      )
    ).wait();

    expect(await buybackSetup.executed()).to.equal(true);
    expect(await buyback.router()).to.equal(buybackRouter.address);
    expect(await buyback.treasury()).to.equal(treasury.address);
    expect(await buyback.policy()).to.equal(policy.address);
    expect(await buyback.dripLM()).to.equal(dripLm.address);
    expect(await drip.dripLM()).to.equal(dripLm.address);
    expect(await drip.tokensPerMintOperator()).to.equal(dripLm.address);
    expect(await token.supplyController()).to.equal(controller.address);
    expect(await controller.pair()).to.equal(pairLite.address);

    const liqNftMain = await deploy("MockBlockNft");
    const liqNftMain2 = await deploy("MockBlockNft");
    const liqToken = await deploy("BiggiToken", owner.address);
    const liqReserve = await deploy("BiggiReserveV4", liqToken.address, owner.address);
    const liqDrip = await deploy("BiggiDripDistributor", liqToken.address, owner.address);
    const liqRewards = await deploy(
      "BiggiTokenRewards",
      liqNftMain.address,
      liqNftMain2.address,
      liqToken.address,
      owner.address
    );
    const liqWeth = await deploy("MockERC20", "Wrapped Native", "WNLQ", 18);
    const vault = await deploy("LiquidityVault", owner.address);
    const lpToken = await deploy("MockLpToken");
    const liqRouter = await deploy("MockLiquidityRouter", liqWeth.address, lpToken.address);
    const liqFactory = await deploy("MockLiquidityFactory");
    const lm = await deploy(
      "BiggiLiquidityManager",
      liqToken.address,
      liqRouter.address,
      vault.address,
      owner.address,
      liqReserve.address
    );

    await (await liqToken.setReserve(liqReserve.address)).wait();
    await (await liqToken.setDripDistributor(liqDrip.address)).wait();
    await (await liqToken.setTokenRewards(liqRewards.address)).wait();
    await (await liqToken.setMarketingSupport(owner.address)).wait();
    await (await liqDrip.setTreasury(owner.address)).wait();
    await (await liqToken.initialDistribute()).wait();

    await (await lpToken.setPairTokens(liqToken.address, liqWeth.address)).wait();
    await (await lpToken.setReserves(toWei("1000"), toWei("1000"))).wait();
    await (await liqFactory.setPair(lpToken.address)).wait();

    const liqSetup = await deploy(
      "LiquiditySetup",
      owner.address,
      liqToken.address,
      liqRouter.address,
      vault.address,
      lm.address,
      liqReserve.address,
      liqWeth.address
    );

    await (await liqToken.transferOwnership(liqSetup.address)).wait();
    await (await vault.transferOwnership(liqSetup.address)).wait();
    await (await liqSetup.setSlippageBps(300)).wait();
    await (await liqSetup.setDeadlineSec(900)).wait();
    await (await liqSetup.runDexConnections(liqFactory.address)).wait();
    await (await liqSetup.runInitialLiquidity(toWei("10"), { value: toWei("5") })).wait();

    expect(await liqSetup.executedInitial()).to.equal(true);
    expect(await lpToken.balanceOf(vault.address)).to.be.gt(0);

    const lpFeed = await deploy(
      "BiggiLpPriceFeed",
      liqToken.address,
      liqWeth.address,
      lpToken.address,
      8,
      owner.address
    );
    const reserves = await lpFeed.readReserves();
    expect(reserves.ok).to.equal(true);
    await (await lpFeed.updateFromReserves()).wait();
    const latest = await lpFeed.latestRoundData();
    expect(latest[1]).to.be.gt(0);
  });

  it("covers main reader, community center, and nft rewards reader", async () => {
    const [owner, alice] = await ethers.getSigners();

    const main = await deployMainWithLinkedLibraries(owner.address);
    const ticketHub = await deploy("BiggiTicketHub", owner.address, main.address);
    const collectionRewards = await deploy("BiggiCollectionRewards", main.address, owner.address);
    const distributor = await deploy("MockMintShareReceiver");
    const token = await deploy("BiggiToken", owner.address);
    const treasury = await deploy("BiggiTreasury", token.address, owner.address);

    await (await main.setTicketHub(ticketHub.address)).wait();
    await (await ticketHub.setMainCollection(main.address)).wait();
    await (await ticketHub.setDistributor(distributor.address)).wait();
    await (await ticketHub.setBiggiToken(token.address)).wait();
    await (await ticketHub.setTokenSink(treasury.address, 10_000)).wait();
    await (await ticketHub.setTokenSinkDepositMode(true)).wait();
    await (await treasury.setEcosystemBiggiCaller(ticketHub.address, true)).wait();

    const ticketPrice = await ticketHub.ticketPrice();
    await (await ticketHub.connect(alice).mintTicket({ value: ticketPrice })).wait();

    const mainReader = await deploy("BiggiMainReader", main.address, ticketHub.address, collectionRewards.address);
    await mainReader.getAllBlockPrices();
    await mainReader.getAllBlockMintCounts();
    await mainReader.getAllBackgroundMintCounts();
    await mainReader.getRewardsCounters();
    await mainReader.getFrontendSnapshot();
    const ticketHubSnapshot = await mainReader.getTicketHubFrontendSnapshot(alice.address, treasury.address);
    expect(ticketHubSnapshot.ecosystemTreasuryRouteOk).to.equal(true);
    expect(ticketHubSnapshot.userTicketCount).to.equal(1);
    const foundTickets = await mainReader.findTicket(alice.address);
    expect(foundTickets.length).to.equal(1);

    const community = await deploy("BiggiCommunityCenter", owner.address);
    await (await community.setDistributor(owner.address)).wait();
    await (await community.receiveMintShare({ value: toWei("2") })).wait();
    await (
      await community.createEvent(
        "Weekly Reward",
        "ipfs://event/1",
        0,
        0,
        toWei("1"),
        [alice.address],
        [toWei("1")]
      )
    ).wait();
    await (await community.connect(alice).claim(1)).wait();
    const status = await community.userStatus(1, alice.address);
    expect(status.claimed).to.equal(true);

    const nftRewards = await deploy("BiggiNFTRewards", owner.address);
    await (await nftRewards.setMainContract(main.address)).wait();
    await (await nftRewards.setVrfRouter(owner.address)).wait();
    await (await nftRewards.setRegistry(owner.address)).wait();
    await (await nftRewards.setAllowedMainCollection(main.address, true)).wait();
    await (await nftRewards.createManualReward(alice.address, "ipfs://reward/1")).wait();
    await expect(
      nftRewards.createMysteryEvent(["ipfs://reward/bad"], [ethers.constants.AddressZero])
    ).to.be.reverted;
    await (await nftRewards.createMysteryEvent(["ipfs://reward/2"], [alice.address, alice.address])).wait();

    const nftReader = await deploy("BiggiNftRewardsReader", nftRewards.address);
    const nftStatus = await nftReader.getStatus();
    expect(nftStatus.nftRewards).to.equal(nftRewards.address);
    expect(nftStatus.main).to.equal(main.address);
    expect(nftStatus.registry).to.equal(owner.address);
    expect(await nftReader.eventEligibleCount(2)).to.equal(1);
    expect(await nftReader.getEligibleAt(2, 0)).to.equal(alice.address);
    expect(await nftReader.isAllowedMainCollection(main.address)).to.equal(true);

    const rewardEvent = await nftReader.getEvent(2);
    expect(rewardEvent.rewardCount).to.equal(1);
    const rewardInfo = await nftReader.rewardInfo(1);
    expect(rewardInfo.assigned).to.equal(alice.address);
  });

  it("covers chapter/series reader snapshots and collection routing eligibility", async () => {
    const [owner] = await ethers.getSigners();

    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const controller = await deploy("BiggiChapterController", owner.address, registry.address);
    const vrfCollection = await deploy("MockCollectionMainView");
    const publicCollection = await deploy("MockCollectionMainView");
    const ticketHub = await deploy("MockTicketHubProgress");

    await (await ticketHub.setMainCollection(vrfCollection.address)).wait();
    await (await ticketHub.setCaps(5, 5, 10)).wait();
    await (await vrfCollection.setTicketHub(ticketHub.address)).wait();

    await (await registry.createSeries("MASTER")).wait();
    await (await registry.createChapter(1)).wait(); // chapterId 1
    await (await registry.setChapterCollections(1, vrfCollection.address, publicCollection.address, ticketHub.address)).wait();
    await (
      await controller.configureChapter(
        1,
        1,
        vrfCollection.address,
        publicCollection.address,
        ticketHub.address,
        5,
        5,
        10
      )
    ).wait();
    await (await ticketHub.setProgress(5, 5, 10)).wait();

    const chapterSeriesReader = await deploy("BiggiChapterSeriesReader", controller.address, registry.address);
    const global = await chapterSeriesReader.globalSnapshot();
    expect(global.controller).to.equal(controller.address);
    expect(global.registry).to.equal(registry.address);
    expect(global.seriesCount).to.equal(1);
    expect(global.chapterCount).to.equal(1);
    expect(global.controllerMatchesRegistry).to.equal(true);

    const series = await chapterSeriesReader.seriesSnapshot(1);
    expect(series.exists).to.equal(true);
    expect(series.name).to.equal("MASTER");
    expect(series.chapterCount).to.equal(1);

    const chapter = await chapterSeriesReader.chapterSnapshot(1);
    expect(chapter.configured).to.equal(true);
    expect(chapter.chapterExists).to.equal(true);
    expect(chapter.seriesId).to.equal(1);
    expect(chapter.chapterNumber).to.equal(1);
    expect(chapter.vrfCollection).to.equal(vrfCollection.address);
    expect(chapter.publicCollection).to.equal(publicCollection.address);
    expect(chapter.ticketHub).to.equal(ticketHub.address);
    expect(chapter.saleCap).to.equal(5);
    expect(chapter.marketingCap).to.equal(5);
    expect(chapter.totalCap).to.equal(10);
    expect(chapter.saleMinted).to.equal(5);
    expect(chapter.marketingMinted).to.equal(5);
    expect(chapter.totalMinted).to.equal(10);
    expect(chapter.publicUnlocked).to.equal(true);
    expect(chapter.priceProvider).to.equal(vrfCollection.address);
    expect(chapter.tokenRewardsEligibleVRF).to.equal(true);
    expect(chapter.tokenRewardsEligiblePublic).to.equal(true);
    expect(chapter.collectionRewardsEligibleVRF).to.equal(true);
    expect(chapter.controllerRegistryMatch).to.equal(true);

    const vrfSnap = await chapterSeriesReader.collectionSnapshot(vrfCollection.address);
    expect(vrfSnap.chapterId).to.equal(1);
    expect(vrfSnap.seriesId).to.equal(1);
    expect(vrfSnap.tokenRewardsEligible).to.equal(true);
    expect(vrfSnap.collectionRewardsEligible).to.equal(true);
    expect(vrfSnap.isVrfCollection).to.equal(true);
    expect(vrfSnap.isPublicCollection).to.equal(false);
    expect(vrfSnap.isTicketHubCollection).to.equal(false);

    const allSnaps = await chapterSeriesReader.batchCollectionSnapshot([
      vrfCollection.address,
      publicCollection.address,
      ticketHub.address,
    ]);
    expect(allSnaps.length).to.equal(3);
    expect(allSnaps[1].isPublicCollection).to.equal(true);
    expect(allSnaps[2].isTicketHubCollection).to.equal(true);
    await chapterSeriesReader.chapterPaymentSnapshot(1, owner.address);
  });
});
