const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const root = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(root, ".env.core.polygon"), override: true });

const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const report = {
  network: "polygon",
  chainId: null,
  blockNumber: null,
  checkedAt: null,
  checks: [],
  warnings: [],
  chapters: [],
};

const REWARDS_ABI = [
  "function owner() view returns (address)",
  "function distributor() view returns (address)",
  "function registry() view returns (address)",
  "function defaultMain() view returns (address)",
  "function orangeReward() view returns (uint256)",
  "function blockReward() view returns (uint256)",
  "function rainbowReward() view returns (uint256)",
  "function isEligibleCollection(address) view returns (bool)",
  "function orangeWinnersCount(address) view returns (uint8)",
  "function blockWinnersCount(address) view returns (uint8)",
  "function rainbowRewardClaimedGlobal(address) view returns (bool)",
  "function orangeMainIdPaid(address,uint256) view returns (bool)",
  "function blockPaid(address,uint16) view returns (bool)",
  "function canClaimOrangeFor(address,address,uint256) view returns (bool,uint8)",
  "function canClaimBlockFor(address,address,uint16) view returns (bool,uint8)",
  "function canClaimRainbowFor(address,address) view returns (bool,uint8)",
];

const REGISTRY_ABI = [
  "function isCollectionRewardsCollection(address) view returns (bool)",
  "function isTokenRewardsCollection(address) view returns (bool)",
  "function chapterByCollection(address) view returns (uint256)",
];

const DISTRIBUTOR_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function registry() view returns (address)",
  "function collectionRewards() view returns (address)",
  "function collections(address) view returns (bool)",
  "function pending(address) view returns (uint256)",
  "function totalPending() view returns (uint256)",
  "function totalReceived() view returns (uint256)",
  "function receivedByChapter(uint256) view returns (uint256)",
  "function receivedByCollection(address) view returns (uint256)",
];

const TICKET_HUB_ABI = [
  "function chapterActive(uint256) view returns (bool)",
  "function chapterSaleCap(uint256) view returns (uint16)",
  "function ticketPrice() view returns (uint256)",
  "function priceIncreasePerMint() view returns (uint256)",
  "function BIGGI() view returns (address)",
  "function paused() view returns (bool)",
];

function sameAddress(actual, expected) {
  return ethers.utils.isAddress(actual || "") &&
    ethers.utils.isAddress(expected || "") &&
    ethers.utils.getAddress(actual) === ethers.utils.getAddress(expected);
}

function check(label, ok, actual, expected) {
  report.checks.push({
    label,
    ok: Boolean(ok),
    actual: String(actual),
    expected: String(expected),
  });
}

function formatPol(value) {
  return ethers.utils.formatEther(value);
}

function preview(raw) {
  return { ok: Boolean(raw[0]), reason: Number(raw[1]) };
}

function projectNativeFunding(startPrice, priceFactor, saleCount, liability) {
  let price = startPrice;
  let gross = ethers.constants.Zero;
  let rewardsShare = ethers.constants.Zero;
  let breakEvenMint = null;
  for (let mint = 1; mint <= saleCount; mint += 1) {
    gross = gross.add(price);
    const distributorShare = price.mul(6000).div(10000);
    rewardsShare = rewardsShare.add(distributorShare.mul(2500).div(10000));
    if (breakEvenMint == null && rewardsShare.gte(liability)) {
      breakEvenMint = mint;
    }
    price = price.mul(priceFactor).div(10000);
  }
  return { gross, rewardsShare, finalPrice: price, breakEvenMint };
}

async function main() {
  if (!process.env.POLYGON_RPC_URL) {
    throw new Error("POLYGON_RPC_URL is missing from .env.core.polygon");
  }

  const addresses = JSON.parse(
    fs.readFileSync(path.join(root, "addresses.master.json"), "utf8"),
  );
  const network = await provider.getNetwork();
  report.chainId = network.chainId;
  report.blockNumber = await provider.getBlockNumber();
  check("Polygon chainId", network.chainId === 137, network.chainId, 137);

  const rewards = new ethers.Contract(
    addresses.COLLECTION_REWARDS,
    REWARDS_ABI,
    provider,
  );
  const registry = new ethers.Contract(addresses.REGISTRY, REGISTRY_ABI, provider);
  const distributor = new ethers.Contract(
    addresses.DISTRIBUTOR,
    DISTRIBUTOR_ABI,
    provider,
  );
  const ticketHub = new ethers.Contract(
    addresses.TICKET_HUB,
    TICKET_HUB_ABI,
    provider,
  );

  const [
    owner,
    configuredDistributor,
    configuredRegistry,
    defaultMain,
    orangeReward,
    blockReward,
    rainbowReward,
    rewardsBalance,
    distributorOwner,
    distributorPaused,
    distributorRegistry,
    distributorTarget,
    distributorPending,
    distributorTotalPending,
    distributorTotalReceived,
    distributorBalance,
    ticketHubWhitelisted,
    ticketPrice,
    priceIncreasePerMint,
    ticketBiggi,
    ticketHubPaused,
  ] = await Promise.all([
    rewards.owner(),
    rewards.distributor(),
    rewards.registry(),
    rewards.defaultMain(),
    rewards.orangeReward(),
    rewards.blockReward(),
    rewards.rainbowReward(),
    provider.getBalance(addresses.COLLECTION_REWARDS),
    distributor.owner(),
    distributor.paused(),
    distributor.registry(),
    distributor.collectionRewards(),
    distributor.pending(addresses.COLLECTION_REWARDS),
    distributor.totalPending(),
    distributor.totalReceived(),
    provider.getBalance(addresses.DISTRIBUTOR),
    distributor.collections(addresses.TICKET_HUB),
    ticketHub.ticketPrice(),
    ticketHub.priceIncreasePerMint(),
    ticketHub.BIGGI(),
    ticketHub.paused(),
  ]);

  check("CollectionRewards owner", sameAddress(owner, addresses.OWNER), owner, addresses.OWNER);
  check(
    "CollectionRewards distributor",
    sameAddress(configuredDistributor, addresses.DISTRIBUTOR),
    configuredDistributor,
    addresses.DISTRIBUTOR,
  );
  check(
    "CollectionRewards registry",
    sameAddress(configuredRegistry, addresses.REGISTRY),
    configuredRegistry,
    addresses.REGISTRY,
  );
  check(
    "CollectionRewards default main",
    sameAddress(defaultMain, addresses.MAIN),
    defaultMain,
    addresses.MAIN,
  );
  check("Orange reward", orangeReward.eq(ethers.utils.parseEther("1000")), formatPol(orangeReward), "1000 POL");
  check("Block reward", blockReward.eq(ethers.utils.parseEther("3000")), formatPol(blockReward), "3000 POL");
  check("Rainbow reward", rainbowReward.eq(ethers.utils.parseEther("10000")), formatPol(rainbowReward), "10000 POL");
  check("Distributor owner", sameAddress(distributorOwner, addresses.OWNER), distributorOwner, addresses.OWNER);
  check("Distributor unpaused", distributorPaused === false, distributorPaused, false);
  check("Distributor registry", sameAddress(distributorRegistry, addresses.REGISTRY), distributorRegistry, addresses.REGISTRY);
  check("Distributor rewards target", sameAddress(distributorTarget, addresses.COLLECTION_REWARDS), distributorTarget, addresses.COLLECTION_REWARDS);
  check("TicketHub distributor whitelist", ticketHubWhitelisted, ticketHubWhitelisted, true);
  check("TicketHub unpaused", ticketHubPaused === false, ticketHubPaused, false);
  check("TicketHub BIGGI token", sameAddress(ticketBiggi, addresses.BIGGI_TOKEN), ticketBiggi, addresses.BIGGI_TOKEN);

  let outstandingLiability = ethers.constants.Zero;
  let activeOutstandingLiability = ethers.constants.Zero;
  let firstSaleCap = null;
  for (const chapter of addresses.chapters) {
    const id = Number(chapter.chapterId);
    const paidOrange = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        rewards.orangeMainIdPaid(chapter.MAIN, index + 1),
      ),
    );
    const paidBlocks = await Promise.all(
      Array.from({ length: 9 }, (_, index) =>
        rewards.blockPaid(chapter.MAIN, index + 1),
      ),
    );
    const [
      directEligible,
      registryEligible,
      publicDirectEligible,
      publicRegistryEligible,
      tokenRewardsVrf,
      registryChapterId,
      chapterActive,
      orangeCount,
      blockCount,
      rainbowClaimed,
      ownerOrangePreview,
      ownerBlockPreview,
      ownerRainbowPreview,
      receivedByChapter,
      receivedByMain,
      receivedByPublic,
      mainWhitelisted,
      publicWhitelisted,
      mainCode,
      publicCode,
      saleCap,
    ] = await Promise.all([
      rewards.isEligibleCollection(chapter.MAIN),
      registry.isCollectionRewardsCollection(chapter.MAIN),
      rewards.isEligibleCollection(chapter.MAIN2),
      registry.isCollectionRewardsCollection(chapter.MAIN2),
      registry.isTokenRewardsCollection(chapter.MAIN),
      registry.chapterByCollection(chapter.MAIN),
      ticketHub.chapterActive(id),
      rewards.orangeWinnersCount(chapter.MAIN),
      rewards.blockWinnersCount(chapter.MAIN),
      rewards.rainbowRewardClaimedGlobal(chapter.MAIN),
      rewards.canClaimOrangeFor(chapter.MAIN, addresses.OWNER, 1),
      rewards.canClaimBlockFor(chapter.MAIN, addresses.OWNER, 1),
      rewards.canClaimRainbowFor(chapter.MAIN, addresses.OWNER),
      distributor.receivedByChapter(id),
      distributor.receivedByCollection(chapter.MAIN),
      distributor.receivedByCollection(chapter.MAIN2),
      distributor.collections(chapter.MAIN),
      distributor.collections(chapter.MAIN2),
      provider.getCode(chapter.MAIN),
      provider.getCode(chapter.MAIN2),
      ticketHub.chapterSaleCap(id),
    ]);

    check(`Chapter ${id} VRF eligible`, directEligible && registryEligible, `${directEligible}/${registryEligible}`, "true/true");
    check(`Chapter ${id} Public excluded`, !publicDirectEligible && !publicRegistryEligible, `${publicDirectEligible}/${publicRegistryEligible}`, "false/false");
    check(`Chapter ${id} TokenRewards eligible`, tokenRewardsVrf, tokenRewardsVrf, true);
    check(`Chapter ${id} registry binding`, registryChapterId.eq(id), registryChapterId, id);
    check(`Chapter ${id} VRF code`, mainCode !== "0x", `${(mainCode.length - 2) / 2} bytes`, "deployed bytecode");
    check(`Chapter ${id} Public code`, publicCode !== "0x", `${(publicCode.length - 2) / 2} bytes`, "deployed bytecode");
    check(`Chapter ${id} orange count`, Number(orangeCount) === paidOrange.filter(Boolean).length, orangeCount, paidOrange.filter(Boolean).length);
    check(`Chapter ${id} block count`, Number(blockCount) === paidBlocks.filter(Boolean).length, blockCount, paidBlocks.filter(Boolean).length);

    const chapterOutstanding = orangeReward
      .mul(10 - paidOrange.filter(Boolean).length)
      .add(blockReward.mul(9 - paidBlocks.filter(Boolean).length))
      .add(rainbowClaimed ? 0 : rainbowReward);
    outstandingLiability = outstandingLiability.add(chapterOutstanding);
    if (chapterActive) {
      activeOutstandingLiability = activeOutstandingLiability.add(
        chapterOutstanding,
      );
    }
    if (firstSaleCap == null) firstSaleCap = Number(saleCap);

    report.chapters.push({
      chapterId: id,
      name: chapter.seriesName,
      vrfCollection: chapter.MAIN,
      publicCollection: chapter.MAIN2,
      active: chapterActive,
      saleCap: Number(saleCap),
      distributorWhitelist: {
        vrf: mainWhitelisted,
        public: publicWhitelisted,
      },
      receivedPOL: {
        chapter: formatPol(receivedByChapter),
        vrf: formatPol(receivedByMain),
        public: formatPol(receivedByPublic),
      },
      paid: {
        orange: paidOrange.filter(Boolean).length,
        blocks: paidBlocks.filter(Boolean).length,
        rainbow: rainbowClaimed,
      },
      ownerPreview: {
        orangeMainId1: preview(ownerOrangePreview),
        block1: preview(ownerBlockPreview),
        rainbow: preview(ownerRainbowPreview),
      },
      outstandingLiabilityPOL: formatPol(chapterOutstanding),
    });
  }

  report.rewards = {
    address: addresses.COLLECTION_REWARDS,
    balancePOL: formatPol(rewardsBalance),
    orangeRewardPOL: formatPol(orangeReward),
    blockRewardPOL: formatPol(blockReward),
    rainbowRewardPOL: formatPol(rainbowReward),
    maximumLiabilityPerChapterPOL: formatPol(
      orangeReward.mul(10).add(blockReward.mul(9)).add(rainbowReward),
    ),
    outstandingLiabilityAllChaptersPOL: formatPol(outstandingLiability),
    outstandingLiabilityActiveChaptersPOL: formatPol(
      activeOutstandingLiability,
    ),
  };
  report.distributor = {
    address: addresses.DISTRIBUTOR,
    balancePOL: formatPol(distributorBalance),
    pendingRewardsPOL: formatPol(distributorPending),
    totalPendingPOL: formatPol(distributorTotalPending),
    totalReceivedPOL: formatPol(distributorTotalReceived),
  };

  const perChapterLiability = orangeReward
    .mul(10)
    .add(blockReward.mul(9))
    .add(rainbowReward);
  const nativeProjection = projectNativeFunding(
    ticketPrice,
    priceIncreasePerMint,
    firstSaleCap || 500,
    perChapterLiability,
  );
  report.fundingModel = {
    currentTicketPricePOL: formatPol(ticketPrice),
    priceFactorBps: priceIncreasePerMint.toString(),
    ticketNativeShareToDistributorBps: 6000,
    distributorShareToCollectionRewardsBps: 2500,
    effectiveNativeMintShareToCollectionRewardsBps: 1500,
    projectedNativeSales: firstSaleCap || 500,
    projectedGrossPOL: formatPol(nativeProjection.gross),
    projectedCollectionRewardsPOL: formatPol(nativeProjection.rewardsShare),
    projectedFinalTicketPricePOL: formatPol(nativeProjection.finalPrice),
    nativeMintsToFundOneChapterLiability: nativeProjection.breakEvenMint,
    biggiTicketMintFundsNativeRewardsPool: false,
  };

  if (rewardsBalance.lt(outstandingLiability)) {
    report.warnings.push({
      label: "CollectionRewards pool is not fully prefunded",
      currentPOL: formatPol(rewardsBalance),
      outstandingLiabilityPOL: formatPol(outstandingLiability),
      note: "Claims remain fail-closed until sufficient mint revenue reaches the pool.",
    });
  }
  if (!distributorPending.isZero()) {
    report.warnings.push({
      label: "Distributor has a pending CollectionRewards transfer",
      pendingPOL: formatPol(distributorPending),
    });
  }
  report.warnings.push({
    label: "BIGGI-paid ticket mints do not fund the native CollectionRewards pool",
    note: "Before each chapter activation, prefund its outstanding POL liability or enforce a monitored native-mint funding threshold.",
  });

  report.checkedAt = new Date().toISOString();
  const failed = report.checks.filter((item) => !item.ok);
  const reportFile = path.join(
    root,
    "reports",
    "collection-rewards-claims-audit-polygon.json",
  );
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`CollectionRewards claim audit at Polygon block ${report.blockNumber}`);
  console.log(`Checks: ${report.checks.length - failed.length}/${report.checks.length}`);
  console.log(`Pool: ${report.rewards.balancePOL} POL`);
  console.log(`Outstanding maximum liability: ${report.rewards.outstandingLiabilityAllChaptersPOL} POL`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Report: ${reportFile}`);
  if (failed.length) {
    for (const item of failed) {
      console.error(`FAIL ${item.label}: ${item.actual} (expected ${item.expected})`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
