const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers } = hre;
const ZERO = ethers.constants.Zero;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sameAddress(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function requiredAddress(value, label) {
  if (!ethers.utils.isAddress(value) || value === ethers.constants.AddressZero) {
    throw new Error(`${label} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

async function safeRead(read, fallback) {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

async function feeOverrides() {
  const minimumPriorityFee = ethers.utils.parseUnits(
    env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"),
    "gwei",
  );
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priority = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ZERO;
  const calculatedMaxFee = baseFee.mul(2).add(priority);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee)
    ? feeData.maxFeePerGas
    : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priority, maxFeePerGas: maxFee };
}

async function main() {
  const chain = await ethers.provider.getNetwork();
  if (Number(chain.chainId) !== 137) {
    throw new Error(`Polygon mainnet chainId 137 required, received ${chain.chainId}`);
  }

  const root = path.resolve(__dirname, "../..");
  const addressFile = path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json")));
  const book = readJson(addressFile);
  const chapterId = Number(env("CHAPTER_ACTIVATION_ID"));
  const execute = env("CHAPTER_ACTIVATION_EXECUTE") === "1";
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > Number(book.CHAPTER_COUNT || 0)) {
    throw new Error(`CHAPTER_ACTIVATION_ID must be between 1 and ${book.CHAPTER_COUNT}`);
  }

  const chapters = [...(book.chapters || [])].sort(
    (left, right) => Number(left.chapterId) - Number(right.chapterId),
  );
  if (chapters.length !== Number(book.CHAPTER_COUNT) || chapters.length !== 5) {
    throw new Error("Canonical address book must contain exactly five chapters");
  }
  const target = chapters.find((chapter) => Number(chapter.chapterId) === chapterId);
  if (!target) throw new Error(`Chapter ${chapterId} is absent from the canonical address book`);

  const ownerAddress = requiredAddress(book.OWNER || book.EXPECT_OWNER, "owner");
  const ticketHubAddress = requiredAddress(book.TICKET_HUB, "TicketHub");
  const registryAddress = requiredAddress(book.REGISTRY, "Registry");
  const routerAddress = requiredAddress(book.VRF_ROUTER, "VRF router");
  const distributorAddress = requiredAddress(book.DISTRIBUTOR, "Distributor");
  const rewardsAddress = requiredAddress(book.COLLECTION_REWARDS, "CollectionRewards");
  const targetMain = requiredAddress(target.MAIN, `chapter ${chapterId} Main`);
  const targetPublic = requiredAddress(target.MAIN2, `chapter ${chapterId} Public`);

  const ticketHub = new ethers.Contract(ticketHubAddress, [
    "function owner() view returns (address)",
    "function chapterExists(uint256) view returns (bool)",
    "function chapterActive(uint256) view returns (bool)",
    "function chapterMainCollection(uint256) view returns (address)",
    "function chapterTotalMinted(uint256) view returns (uint256)",
    "function chapterTotalCap(uint256) view returns (uint16)",
    "function setChapterActive(uint256,bool)",
  ], ethers.provider);
  const registry = new ethers.Contract(registryAddress, [
    "function getChapterCollections(uint256) view returns (address,address,address)",
  ], ethers.provider);
  const main = new ethers.Contract(targetMain, [
    "function owner() view returns (address)",
    "function chapterId() view returns (uint256)",
    "function ticketHub() view returns (address)",
    "function vrfRouter() view returns (address)",
    "function vrfRecoveryVersion() pure returns (uint256)",
    "function metadataSealed() view returns (bool)",
    "function isMetadataFullyConfigured() view returns (bool)",
    "function isRewardMatrixConsistent() view returns (bool)",
    "function paused() view returns (bool)",
  ], ethers.provider);
  const publicCollection = new ethers.Contract(targetPublic, [
    "function owner() view returns (address)",
    "function distributor() view returns (address)",
  ], ethers.provider);
  const router = new ethers.Contract(routerAddress, [
    "function approvedMains(address) view returns (bool)",
    "function vrfRecoveryVersion() pure returns (uint256)",
  ], ethers.provider);
  const distributor = new ethers.Contract(distributorAddress, [
    "function distributorVersion() pure returns (uint256)",
    "function collections(address) view returns (bool)",
    "function rewardCollectionForChapter(uint256) view returns (address)",
    "function pendingOf(address) view returns (uint256)",
    "function pendingCollectionRewards(address) view returns (uint256)",
  ], ethers.provider);
  const rewards = new ethers.Contract(rewardsAddress, [
    "function owner() view returns (address)",
    "function fundingCollection() view returns (address)",
    "function collectionBudgetSnapshot(address) view returns (bool,bool,uint256,uint256,uint256,uint256,uint256,uint256)",
    "function setFundingCollection(address)",
  ], ethers.provider);

  const [
    hubOwner,
    rewardsOwner,
    mainOwner,
    publicOwner,
    publicDistributor,
    routerVersion,
    distributorVersion,
    targetExists,
    targetActive,
    targetBoundMain,
    registryCollections,
    mainChapterId,
    mainTicketHub,
    mainRouter,
    mainVersion,
    metadataSealed,
    metadataComplete,
    rewardMatrixConsistent,
    mainPaused,
    routerApproved,
    rewardCollection,
    distributorPendingRewards,
    targetPendingRewards,
    fundingCollection,
    budget,
  ] = await Promise.all([
    ticketHub.owner(),
    rewards.owner(),
    safeRead(() => main.owner(), ethers.constants.AddressZero),
    publicCollection.owner(),
    publicCollection.distributor(),
    router.vrfRecoveryVersion(),
    distributor.distributorVersion(),
    ticketHub.chapterExists(chapterId),
    ticketHub.chapterActive(chapterId),
    ticketHub.chapterMainCollection(chapterId),
    registry.getChapterCollections(chapterId),
    safeRead(() => main.chapterId(), ZERO),
    safeRead(() => main.ticketHub(), ethers.constants.AddressZero),
    safeRead(() => main.vrfRouter(), ethers.constants.AddressZero),
    safeRead(() => main.vrfRecoveryVersion(), ZERO),
    safeRead(() => main.metadataSealed(), false),
    safeRead(() => main.isMetadataFullyConfigured(), false),
    safeRead(() => main.isRewardMatrixConsistent(), false),
    safeRead(() => main.paused(), true),
    router.approvedMains(targetMain),
    distributor.rewardCollectionForChapter(chapterId),
    distributor.pendingOf(rewardsAddress),
    distributor.pendingCollectionRewards(targetMain),
    rewards.fundingCollection(),
    rewards.collectionBudgetSnapshot(targetMain),
  ]);

  const chapterStates = [];
  for (const chapter of chapters) {
    const id = Number(chapter.chapterId);
    const [active, minted, cap] = await Promise.all([
      ticketHub.chapterActive(id),
      ticketHub.chapterTotalMinted(id),
      ticketHub.chapterTotalCap(id),
    ]);
    chapterStates.push({
      chapterId: id,
      active: Boolean(active),
      minted: minted.toString(),
      cap: cap.toString(),
      soldOut: minted.eq(cap),
    });
  }

  const checks = {
    allChaptersCurrentlyInactive: chapterStates.every((chapter) => !chapter.active),
    allEarlierChaptersSoldOut: chapterStates
      .filter((chapter) => chapter.chapterId < chapterId)
      .every((chapter) => chapter.soldOut),
    targetExists: Boolean(targetExists),
    targetInactive: !targetActive,
    targetNotSoldOut: chapterStates.find((chapter) => chapter.chapterId === chapterId)?.soldOut === false,
    targetCanonicalInactive: target.active === false,
    targetPublicMetadataReady: target.publicMetadataReady === true,
    ticketHubOwner: sameAddress(hubOwner, ownerAddress),
    rewardsOwner: sameAddress(rewardsOwner, ownerAddress),
    mainOwner: sameAddress(mainOwner, ownerAddress),
    publicOwner: sameAddress(publicOwner, ownerAddress),
    publicDistributorBinding: sameAddress(publicDistributor, distributorAddress),
    routerV2: routerVersion.eq(2),
    distributorV2: distributorVersion.eq(2),
    mainV2: mainVersion.eq(2),
    targetHubBinding: sameAddress(targetBoundMain, targetMain),
    registryMainBinding: sameAddress(registryCollections[0], targetMain),
    registryPublicBinding: sameAddress(registryCollections[1], targetPublic),
    registryHubBinding: sameAddress(registryCollections[2], ticketHubAddress),
    mainChapterBinding: mainChapterId.eq(chapterId),
    mainTicketHubBinding: sameAddress(mainTicketHub, ticketHubAddress),
    mainRouterBinding: sameAddress(mainRouter, routerAddress),
    metadataSealed: Boolean(metadataSealed),
    metadataComplete: Boolean(metadataComplete),
    rewardMatrixConsistent: Boolean(rewardMatrixConsistent),
    mainUnpaused: !mainPaused,
    routerApproval: Boolean(routerApproved),
    distributorChapterAttribution: sameAddress(rewardCollection, targetMain),
    distributorMainWhitelisted: await distributor.collections(targetMain),
    distributorPublicWhitelisted: await distributor.collections(targetPublic),
    distributorHubWhitelisted: await distributor.collections(ticketHubAddress),
    distributorRewardsPendingZero: distributorPendingRewards.eq(ZERO),
    targetRewardsPendingZero: targetPendingRewards.eq(ZERO),
    collectionBudgetConfigured: Boolean(budget[0]),
  };
  const failures = Object.entries(checks).filter(([, passed]) => passed !== true).map(([name]) => name);
  const reportFile = path.join(root, `reports/chapter-${chapterId}-activation-preflight-polygon.json`);
  const report = {
    network: "polygon",
    chainId: 137,
    chapterId,
    mode: execute ? "execute" : "dry-run",
    policy: "only one chapter active; every earlier chapter must be sold out",
    addresses: {
      targetMain,
      targetPublic,
      ticketHub: ticketHubAddress,
      registry: registryAddress,
      router: routerAddress,
      distributor: distributorAddress,
      collectionRewards: rewardsAddress,
    },
    chapterStates,
    checks,
    currentFundingCollection: fundingCollection,
    result: failures.length ? "blocked" : "ready-no-transactions",
    failures,
    checkedAt: new Date().toISOString(),
  };
  writeJson(reportFile, report);
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) {
    throw new Error(`Chapter ${chapterId} activation blocked: ${failures.join(", ")}`);
  }
  if (!execute) {
    console.log(`Activation preflight passed. No transactions sent. Report: ${reportFile}`);
    return;
  }

  const confirmation = `ACTIVATE_CHAPTER_${chapterId}_AFTER_PREVIOUS_SOLD_OUT`;
  if (env("CONFIRM_CHAPTER_ACTIVATION") !== confirmation) {
    throw new Error(`Set CONFIRM_CHAPTER_ACTIVATION=${confirmation}`);
  }
  const ownerKey = env("OWNER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(ownerKey)) {
    throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  }
  const signer = new ethers.Wallet(ownerKey, ethers.provider);
  if (!sameAddress(signer.address, ownerAddress)) {
    throw new Error(`OWNER_PRIVATE_KEY signer does not match canonical owner ${ownerAddress}`);
  }

  const transactions = [];
  if (!sameAddress(fundingCollection, targetMain)) {
    const fundingTx = await rewards.connect(signer).setFundingCollection(
      targetMain,
      await feeOverrides(),
    );
    const fundingReceipt = await fundingTx.wait();
    transactions.push({
      action: "setFundingCollection",
      hash: fundingReceipt.transactionHash,
      blockNumber: fundingReceipt.blockNumber,
    });
  }
  const activationTx = await ticketHub.connect(signer).setChapterActive(
    chapterId,
    true,
    await feeOverrides(),
  );
  const activationReceipt = await activationTx.wait();
  transactions.push({
    action: "setChapterActive",
    hash: activationReceipt.transactionHash,
    blockNumber: activationReceipt.blockNumber,
  });

  if (!(await ticketHub.chapterActive(chapterId))) {
    throw new Error(`Chapter ${chapterId} activation transaction did not produce an active state`);
  }
  const otherActive = [];
  for (const chapter of chapters) {
    const id = Number(chapter.chapterId);
    if (id !== chapterId && await ticketHub.chapterActive(id)) otherActive.push(id);
  }
  if (otherActive.length) throw new Error(`Other chapters became active: ${otherActive.join(", ")}`);

  writeJson(reportFile, {
    ...report,
    result: "activated",
    transactions,
    activatedAt: new Date().toISOString(),
  });
  console.log(`Chapter ${chapterId} activated; all other chapters remain inactive.`);
}

main().catch((error) => {
  console.error(error.message || "Sequential chapter activation failed");
  process.exitCode = 1;
});
