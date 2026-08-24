const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function same(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

function address(value, label) {
  const raw = String(value || "").trim();
  if (!ethers.utils.isAddress(raw) || same(raw, ZERO)) {
    throw new Error(`${label} is not a valid non-zero address`);
  }
  return ethers.utils.getAddress(raw);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function requireCode(label, value) {
  const normalized = address(value, label);
  if ((await ethers.provider.getCode(normalized)) === "0x") {
    throw new Error(`${label} has no Polygon bytecode: ${normalized}`);
  }
  return normalized;
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
  const priorityFee = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee =
    latestBlock.baseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
  const calculatedMaxFee = baseFee.mul(2).add(priorityFee);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee)
    ? feeData.maxFeePerGas
    : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priorityFee, maxFeePerGas: maxFee };
}

function setEnvLines(file, updates) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const entry = `${key}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = entry;
    else lines.push(entry);
  }
  fs.writeFileSync(file, lines.join("\n"));
}

function updateJsonAddresses(file, oldRewards, newRewards, oldReader, newReader, metadata) {
  if (!fs.existsSync(file)) return;
  const value = readJson(file);
  const basename = path.basename(file);
  const coreAddressBook = [
    "addresses.master.json",
    "addresses.json",
    "addresses.core.polygon.json",
    "addresses.visibility.polygon.json",
  ].includes(basename);
  if (coreAddressBook || Object.prototype.hasOwnProperty.call(value, "COLLECTION_REWARDS")) {
    value.COLLECTION_REWARDS = newRewards;
  }
  if (coreAddressBook || Object.prototype.hasOwnProperty.call(value, "MAIN_READER")) {
    value.MAIN_READER = newReader;
  }
  if (Object.prototype.hasOwnProperty.call(value, "READER") && same(value.READER, oldReader)) {
    value.READER = newReader;
  }
  if (basename === "addresses.master.json") {
    value.OLD_COLLECTION_REWARDS = oldRewards;
    value.OLD_MAIN_READER = oldReader;
    value.collectionRewardsRedeployedAt = metadata.completedAt;
    value.collectionRewardsRedeployBlock = metadata.blockNumber;
  }
  writeJson(file, value);
}

function updateFrontendAddresses(file, oldRewards, newRewards, oldReader, newReader) {
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, "utf8");
  const replacements = [
    ["COLLECTION_REWARDS", oldRewards, newRewards],
    ["MAIN_READER", oldReader, newReader],
    ["READER", oldReader, newReader],
  ];
  for (const [key, oldValue, newValue] of replacements) {
    const expression = new RegExp(`^(\\s*${key}:\\s*)"${oldValue}"(,?)$`, "mi");
    if (expression.test(source)) source = source.replace(expression, `$1"${newValue}"$2`);
  }
  fs.writeFileSync(file, source);
}

function syncAddressBooks(root, repoRoot, oldRewards, newRewards, oldReader, newReader, metadata) {
  for (const relative of [
    "addresses.master.json",
    "addresses.json",
    "addresses.core.polygon.json",
    "addresses.visibility.polygon.json",
    "addresses.tokenomics.phase1.polygon.json",
    "addresses.tokenomics.phase2.polygon.json",
  ]) {
    updateJsonAddresses(
      path.join(root, relative),
      oldRewards,
      newRewards,
      oldReader,
      newReader,
      metadata,
    );
  }

  setEnvLines(path.join(root, ".env.core.polygon"), {
    COLLECTION_REWARDS: newRewards,
    MAIN_READER: newReader,
  });
  for (const file of [path.join(repoRoot, ".env"), path.join(repoRoot, ".env.example")]) {
    setEnvLines(file, {
      VITE_ADDR_COLLECTION_REWARDS: newRewards,
      VITE_ADDR_MAIN_READER: newReader,
    });
  }
  for (const file of [
    path.join(repoRoot, "src/shared/utils/addresses.js"),
    path.join(repoRoot, "public-repo/src/shared/utils/addresses.js"),
  ]) {
    updateFrontendAddresses(file, oldRewards, newRewards, oldReader, newReader);
  }
}

async function main() {
  const execute = env("REDEPLOY_COLLECTION_REWARDS_EXECUTE") === "1";
  const resume = env("REDEPLOY_COLLECTION_REWARDS_RESUME") === "1";
  const confirmations = Number(env("TX_CONFIRMATIONS", "2"));
  const root = path.resolve(__dirname, "../..");
  const repoRoot = path.resolve(root, "../..");
  const reportFile = path.join(root, "reports", "collection-rewards-redeploy-polygon.json");
  const resumeFile = path.join(root, "addresses.collection-rewards-redeploy.resume.polygon.json");
  const persistedResume = resume && fs.existsSync(resumeFile)
    ? readJson(resumeFile)
    : null;
  const book = readJson(path.join(root, "addresses.master.json"));
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  if (!chapters.length) throw new Error("No chapters in addresses.master.json");

  const chain = await ethers.provider.getNetwork();
  if (network.name !== "polygon" || chain.chainId !== 137) {
    throw new Error(`Expected Polygon mainnet, got ${network.name} (${chain.chainId})`);
  }

  const required = {
    OWNER: address(book.OWNER, "OWNER"),
    DEPLOYER: address(book.DEPLOYER || book.deployer, "DEPLOYER"),
    MAIN: await requireCode("MAIN", book.MAIN),
    TICKET_HUB: await requireCode("TICKET_HUB", book.TICKET_HUB),
    REGISTRY: await requireCode("REGISTRY", book.REGISTRY),
    DISTRIBUTOR: await requireCode("DISTRIBUTOR", book.DISTRIBUTOR),
    OLD_REWARDS: await requireCode("COLLECTION_REWARDS", book.COLLECTION_REWARDS),
    OLD_READER: await requireCode("MAIN_READER", book.MAIN_READER),
    MASTER_CONFIG: await requireCode("MASTER_CONFIG", book.MASTER_CONFIG),
  };
  const chapterMains = [];
  for (const chapter of chapters) {
    chapterMains.push(await requireCode(`Chapter ${chapter.chapterId} MAIN`, chapter.MAIN));
  }

  const oldRewards = new ethers.Contract(required.OLD_REWARDS, [
    "function owner() view returns (address)",
    "function distributor() view returns (address)",
    "function registry() view returns (address)",
    "function defaultMain() view returns (address)",
    "function orangeReward() view returns (uint256)",
    "function blockReward() view returns (uint256)",
    "function rainbowReward() view returns (uint256)",
    "function orangeWinnersCount(address) view returns (uint8)",
    "function blockWinnersCount(address) view returns (uint8)",
    "function rainbowRewardClaimedGlobal(address) view returns (bool)",
    "function orangeMainIdPaid(address,uint256) view returns (bool)",
    "function blockPaid(address,uint16) view returns (bool)",
    "function maximumCollectionLiability() view returns (uint256)",
  ], ethers.provider);
  const distributorRead = new ethers.Contract(required.DISTRIBUTOR, [
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function collectionRewards() view returns (address)",
    "function pending(address) view returns (uint256)",
  ], ethers.provider);
  const masterConfigRead = new ethers.Contract(required.MASTER_CONFIG, [
    "function owner() view returns (address)",
    "function rewardsBundle() view returns (address,address,address,address)",
  ], ethers.provider);
  const ticketHub = new ethers.Contract(required.TICKET_HUB, [
    "function chapterActive(uint256) view returns (bool)",
  ], ethers.provider);
  const oldReader = new ethers.Contract(required.OLD_READER, [
    "function main() view returns (address)",
    "function ticketHub() view returns (address)",
    "function collectionRewards() view returns (address)",
  ], ethers.provider);

  const [
    oldOwner,
    oldDistributor,
    oldRegistry,
    oldDefaultMain,
    orangeReward,
    blockReward,
    rainbowReward,
    oldBalance,
    distributorOwner,
    distributorPaused,
    distributorTarget,
    distributorPending,
    configOwner,
    rewardsBundle,
    oldReaderMain,
    oldReaderTicketHub,
    oldReaderRewards,
  ] = await Promise.all([
    oldRewards.owner(),
    oldRewards.distributor(),
    oldRewards.registry(),
    oldRewards.defaultMain(),
    oldRewards.orangeReward(),
    oldRewards.blockReward(),
    oldRewards.rainbowReward(),
    ethers.provider.getBalance(required.OLD_REWARDS),
    distributorRead.owner(),
    distributorRead.paused(),
    distributorRead.collectionRewards(),
    distributorRead.pending(required.OLD_REWARDS),
    masterConfigRead.owner(),
    masterConfigRead.rewardsBundle(),
    oldReader.main(),
    oldReader.ticketHub(),
    oldReader.collectionRewards(),
  ]);

  const blockers = [];
  const expectAddress = (label, actual, expected) => {
    if (!same(actual, expected)) blockers.push(`${label}: ${actual}, expected ${expected}`);
  };
  expectAddress("CollectionRewards owner", oldOwner, required.OWNER);
  expectAddress("CollectionRewards distributor", oldDistributor, required.DISTRIBUTOR);
  expectAddress("CollectionRewards registry", oldRegistry, required.REGISTRY);
  expectAddress("CollectionRewards defaultMain", oldDefaultMain, required.MAIN);
  expectAddress("Distributor owner", distributorOwner, required.OWNER);
  expectAddress("MasterConfig owner", configOwner, required.OWNER);
  const allowedRewardsTargets = [required.OLD_REWARDS, persistedResume?.newCollectionRewards]
    .filter(Boolean);
  if (!allowedRewardsTargets.some((candidate) => same(distributorTarget, candidate))) {
    blockers.push(`Distributor target: ${distributorTarget}, expected old or resumed CollectionRewards`);
  }
  if (!allowedRewardsTargets.some((candidate) => same(rewardsBundle[0], candidate))) {
    blockers.push(`MasterConfig rewards target: ${rewardsBundle[0]}, expected old or resumed CollectionRewards`);
  }
  expectAddress("MainReader main", oldReaderMain, required.MAIN);
  expectAddress("MainReader TicketHub", oldReaderTicketHub, required.TICKET_HUB);
  expectAddress("MainReader rewards", oldReaderRewards, required.OLD_REWARDS);
  if (!oldBalance.isZero()) blockers.push(`Old CollectionRewards balance is ${ethers.utils.formatEther(oldBalance)} POL`);
  if (!distributorPending.isZero()) blockers.push(`Distributor pending for old CollectionRewards is ${ethers.utils.formatEther(distributorPending)} POL`);
  try {
    await oldRewards.maximumCollectionLiability();
    if (!persistedResume) {
      blockers.push("The configured CollectionRewards already exposes isolated chapter budgets");
    }
  } catch {
    // Expected for the legacy deployment being replaced.
  }

  const chapterState = [];
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const mainAddress = chapterMains[index];
    const [active, orangeCount, blockCount, rainbowClaimed, orangePaid, blocksPaid] = await Promise.all([
      ticketHub.chapterActive(chapter.chapterId),
      oldRewards.orangeWinnersCount(mainAddress),
      oldRewards.blockWinnersCount(mainAddress),
      oldRewards.rainbowRewardClaimedGlobal(mainAddress),
      Promise.all(Array.from({ length: 10 }, (_, id) => oldRewards.orangeMainIdPaid(mainAddress, id + 1))),
      Promise.all(Array.from({ length: 9 }, (_, id) => oldRewards.blockPaid(mainAddress, id + 1))),
    ]);
    const settledClaims =
      Number(orangeCount) +
      Number(blockCount) +
      (rainbowClaimed ? 1 : 0) +
      orangePaid.filter(Boolean).length +
      blocksPaid.filter(Boolean).length;
    if (active) blockers.push(`Chapter ${chapter.chapterId} is active`);
    if (settledClaims !== 0) blockers.push(`Chapter ${chapter.chapterId} has historical CollectionRewards claim state`);
    chapterState.push({
      chapterId: Number(chapter.chapterId),
      name: chapter.seriesName,
      main: mainAddress,
      active,
      settledClaims,
    });
  }

  const rewardsFactory = await ethers.getContractFactory("BiggiCollectionRewards");
  const readerFactory = await ethers.getContractFactory("BiggiMainReader");
  const fees = await feeOverrides();
  const rewardsDeploy = rewardsFactory.getDeployTransaction(required.MAIN, required.OWNER);
  const rewardsGas = await ethers.provider.estimateGas({
    ...rewardsDeploy,
    from: required.DEPLOYER,
  });
  const estimatedRewardsAddress = ethers.utils.getContractAddress({
    from: required.DEPLOYER,
    nonce: await ethers.provider.getTransactionCount(required.DEPLOYER),
  });
  const readerDeploy = readerFactory.getDeployTransaction(
    required.MAIN,
    required.TICKET_HUB,
    estimatedRewardsAddress,
  );
  const readerGas = await ethers.provider.estimateGas({
    ...readerDeploy,
    from: required.DEPLOYER,
  });

  let report = {
    checkedAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    blockNumber: await ethers.provider.getBlockNumber(),
    mode: execute ? (resume ? "resume" : "execute") : "dry-run",
    oldCollectionRewards: required.OLD_REWARDS,
    oldMainReader: required.OLD_READER,
    owner: required.OWNER,
    deployer: required.DEPLOYER,
    distributorInitiallyPaused:
      persistedResume?.distributorInitiallyPaused ?? distributorPaused,
    legacyState: {
      balancePOL: ethers.utils.formatEther(oldBalance),
      distributorPendingPOL: ethers.utils.formatEther(distributorPending),
    },
    rewardSchedulePOL: {
      orange: ethers.utils.formatEther(orangeReward),
      block: ethers.utils.formatEther(blockReward),
      rainbow: ethers.utils.formatEther(rainbowReward),
      maximumPerChapter: ethers.utils.formatEther(
        orangeReward.mul(10).add(blockReward.mul(9)).add(rainbowReward),
      ),
    },
    chapters: chapterState,
    deploymentGasEstimate: rewardsGas.add(readerGas).toString(),
    deploymentMaximumCostPOL: ethers.utils.formatEther(
      rewardsGas.add(readerGas).mul(fees.maxFeePerGas),
    ),
    blockers,
    transactions: Array.isArray(persistedResume?.transactions)
      ? [...persistedResume.transactions]
      : [],
  };
  writeJson(reportFile, report);
  if (blockers.length) throw new Error(`CollectionRewards redeploy blocked: ${blockers.join("; ")}`);
  if (!execute) {
    report.result = "ready-for-explicit-execute";
    writeJson(reportFile, report);
    console.log(JSON.stringify({
      result: report.result,
      chapters: chapters.length,
      maximumLiabilityPerChapterPOL: report.rewardSchedulePOL.maximumPerChapter,
      deploymentMaximumCostPOL: report.deploymentMaximumCostPOL,
      report: reportFile,
    }, null, 2));
    return;
  }

  const deployerKey = env("DEPLOYER_PRIVATE_KEY");
  const ownerKey = env("OWNER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) throw new Error("DEPLOYER_PRIVATE_KEY is missing or invalid");
  if (!/^0x[0-9a-fA-F]{64}$/.test(ownerKey)) throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  const deployer = new ethers.Wallet(deployerKey, ethers.provider);
  const owner = new ethers.Wallet(ownerKey, ethers.provider);
  expectAddress("Deployer signer", deployer.address, required.DEPLOYER);
  expectAddress("Owner signer", owner.address, required.OWNER);
  if (blockers.length) throw new Error(`Signer validation failed: ${blockers.join("; ")}`);

  const resumeState = persistedResume || {
        oldCollectionRewards: required.OLD_REWARDS,
        oldMainReader: required.OLD_READER,
        distributorInitiallyPaused: distributorPaused,
      };

  async function record(label, tx, receipt) {
    report.transactions.push({
      label,
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });
    resumeState.transactions = report.transactions;
    writeJson(resumeFile, resumeState);
    writeJson(reportFile, report);
  }

  async function send(label, transactionFactory) {
    const tx = await transactionFactory(fees);
    const receipt = await tx.wait(confirmations);
    if (receipt.status !== 1) throw new Error(`${label} failed: ${tx.hash}`);
    await record(label, tx, receipt);
    return receipt;
  }

  let newRewards;
  if (resumeState.newCollectionRewards && (await ethers.provider.getCode(resumeState.newCollectionRewards)) !== "0x") {
    newRewards = rewardsFactory.attach(resumeState.newCollectionRewards).connect(owner);
  } else {
    newRewards = await rewardsFactory.connect(deployer).deploy(required.MAIN, required.OWNER, fees);
    const receipt = await newRewards.deployTransaction.wait(confirmations);
    resumeState.newCollectionRewards = newRewards.address;
    await record("deploy BiggiCollectionRewards", newRewards.deployTransaction, receipt);
    newRewards = newRewards.connect(owner);
  }

  if (!(await newRewards.orangeReward()).eq(orangeReward) ||
      !(await newRewards.blockReward()).eq(blockReward) ||
      !(await newRewards.rainbowReward()).eq(rainbowReward)) {
    await send("preserve reward schedule", (txFees) =>
      newRewards.setRewardsAmounts(orangeReward, blockReward, rainbowReward, txFees));
  }
  if (!same(await newRewards.registry(), required.REGISTRY)) {
    await send("set CollectionRewards registry", (txFees) =>
      newRewards.setRegistry(required.REGISTRY, txFees));
  }
  if (!same(await newRewards.distributor(), required.DISTRIBUTOR)) {
    await send("set CollectionRewards distributor", (txFees) =>
      newRewards.setDistributor(required.DISTRIBUTOR, txFees));
  }
  for (const mainAddress of chapterMains) {
    const budget = await newRewards.collectionBudgets(mainAddress);
    if (!Boolean(budget.configured ?? budget[0])) {
      await send(`configure budget ${mainAddress}`, (txFees) =>
        newRewards.configureCollectionBudget(mainAddress, txFees));
    }
  }
  if (!same(await newRewards.fundingCollection(), chapterMains[0])) {
    await send("set Chapter 1 funding collection", (txFees) =>
      newRewards.setFundingCollection(chapterMains[0], txFees));
  }

  let newReader;
  if (resumeState.newMainReader && (await ethers.provider.getCode(resumeState.newMainReader)) !== "0x") {
    newReader = readerFactory.attach(resumeState.newMainReader);
  } else {
    newReader = await readerFactory.connect(deployer).deploy(
      required.MAIN,
      required.TICKET_HUB,
      newRewards.address,
      fees,
    );
    const receipt = await newReader.deployTransaction.wait(confirmations);
    resumeState.newMainReader = newReader.address;
    await record("deploy BiggiMainReader", newReader.deployTransaction, receipt);
  }

  const distributor = new ethers.Contract(required.DISTRIBUTOR, [
    "function paused() view returns (bool)",
    "function pause()",
    "function unpause()",
    "function collectionRewards() view returns (address)",
    "function setCollectionRewards(address)",
    "function pending(address) view returns (uint256)",
  ], owner);
  const masterConfig = new ethers.Contract(required.MASTER_CONFIG, [
    "function rewardsBundle() view returns (address,address,address,address)",
    "function setRewards(address,address,address,address)",
  ], owner);

  if (!(await distributor.paused())) {
    await send("pause distributor for target switch", (txFees) => distributor.pause(txFees));
  }
  if (!same(await distributor.collectionRewards(), newRewards.address)) {
    await send("switch distributor CollectionRewards target", (txFees) =>
      distributor.setCollectionRewards(newRewards.address, txFees));
  }
  const currentBundle = await masterConfig.rewardsBundle();
  if (!same(currentBundle[0], newRewards.address)) {
    await send("switch MasterConfig CollectionRewards target", (txFees) =>
      masterConfig.setRewards(newRewards.address, currentBundle[1], currentBundle[2], currentBundle[3], txFees));
  }
  if (!resumeState.distributorInitiallyPaused && await distributor.paused()) {
    await send("restore distributor unpaused state", (txFees) => distributor.unpause(txFees));
  }

  const newReaderView = new ethers.Contract(newReader.address, [
    "function main() view returns (address)",
    "function ticketHub() view returns (address)",
    "function collectionRewards() view returns (address)",
  ], ethers.provider);
  const postBundle = await masterConfig.rewardsBundle();
  const postChecks = {
    newRewardsOwner: same(await newRewards.owner(), required.OWNER),
    newRewardsRegistry: same(await newRewards.registry(), required.REGISTRY),
    newRewardsDistributor: same(await newRewards.distributor(), required.DISTRIBUTOR),
    fundingCollection: same(await newRewards.fundingCollection(), chapterMains[0]),
    distributorTarget: same(await distributor.collectionRewards(), newRewards.address),
    distributorPendingOldZero: (await distributor.pending(required.OLD_REWARDS)).isZero(),
    distributorPendingNewZero: (await distributor.pending(newRewards.address)).isZero(),
    masterConfigTarget: same(postBundle[0], newRewards.address),
    readerMain: same(await newReaderView.main(), required.MAIN),
    readerTicketHub: same(await newReaderView.ticketHub(), required.TICKET_HUB),
    readerRewards: same(await newReaderView.collectionRewards(), newRewards.address),
  };
  for (const mainAddress of chapterMains) {
    const budget = await newRewards.collectionBudgets(mainAddress);
    postChecks[`budgetConfigured:${mainAddress}`] = Boolean(budget.configured ?? budget[0]);
  }
  const failedPostChecks = Object.entries(postChecks).filter(([, ok]) => !ok);
  if (failedPostChecks.length) {
    throw new Error(`Post-deploy checks failed: ${failedPostChecks.map(([label]) => label).join(", ")}`);
  }

  const latestReceipt = report.transactions.at(-1);
  const metadata = {
    completedAt: new Date().toISOString(),
    blockNumber: latestReceipt?.blockNumber || await ethers.provider.getBlockNumber(),
  };
  syncAddressBooks(
    root,
    repoRoot,
    required.OLD_REWARDS,
    newRewards.address,
    required.OLD_READER,
    newReader.address,
    metadata,
  );
  report.newCollectionRewards = newRewards.address;
  report.newMainReader = newReader.address;
  report.postChecks = postChecks;
  report.completedAt = metadata.completedAt;
  report.completedBlock = metadata.blockNumber;
  report.result = "completed";
  writeJson(reportFile, report);
  console.log(JSON.stringify({
    result: report.result,
    collectionRewards: newRewards.address,
    mainReader: newReader.address,
    report: reportFile,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
