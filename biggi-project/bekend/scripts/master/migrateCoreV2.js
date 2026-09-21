const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const CHAPTER_COUNT = 5;
const ROWS_PER_CHAPTER = 550;
const BATCH_SIZE = 55;
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const EXECUTE_CONFIRMATION = "I_UNDERSTAND_CORE_V2_MAINNET_MIGRATION";
const SEED_CONFIRMATION = "I_APPROVE_HASH_PINNED_CHAPTERS_2_TO_5_SEED";
const MULTICALL_ABI = [
  "function aggregate(tuple(address target,bytes callData)[] calls) view returns (uint256 blockNumber,bytes[] returnData)",
];

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function envInt(name, fallback) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function same(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function address(value, label) {
  const raw = String(value || "").trim();
  if (!ethers.utils.isAddress(raw) || same(raw, ZERO)) {
    throw new Error(`${label} is not a valid non-zero address`);
  }
  return ethers.utils.getAddress(raw);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function rowFromDecoded(decoded) {
  const row = decoded.background == null ? decoded[0] : decoded;
  return {
    background: Number(row.background),
    blockIdx: Number(row.blockIdx),
    mainId: row.mainId.toString(),
    minted: Boolean(row.minted),
  };
}

function rowsEqual(left, right) {
  return left.background === right.background &&
    left.blockIdx === right.blockIdx &&
    left.mainId === right.mainId &&
    left.minted === right.minted;
}

function rowUnset(row) {
  return row.background === 0 && row.blockIdx === 0 && row.mainId === "0" && !row.minted;
}

function rowValid(row) {
  return row.background >= 1 && row.background <= 10 &&
    row.blockIdx >= 1 && row.blockIdx <= 10 &&
    ethers.BigNumber.from(row.mainId).gt(0) && !row.minted;
}

async function requireCode(label, value) {
  const normalized = address(value, label);
  if ((await ethers.provider.getCode(normalized)) === "0x") {
    throw new Error(`${label} has no Polygon bytecode at ${normalized}`);
  }
  return normalized;
}

async function requireOwner(label, contract, expectedOwner) {
  const actual = await contract.owner();
  if (!same(actual, expectedOwner)) throw new Error(`${label} owner mismatch: ${actual}`);
}

async function feeSnapshot() {
  const minimumPriorityFee = ethers.utils.parseUnits(env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"), "gwei");
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priority = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.constants.Zero;
  const calculated = baseFee.mul(2).add(priority);
  const maxFee = feeData.maxFeePerGas?.gte(calculated) ? feeData.maxFeePerGas : calculated;
  const projectedEffective = baseFee.add(priority).gt(maxFee) ? maxFee : baseFee.add(priority);
  return {
    baseFeePerGas: baseFee,
    projectedEffectiveGasPrice: projectedEffective,
    overrides: { type: 2, maxPriorityFeePerGas: priority, maxFeePerGas: maxFee },
  };
}

async function feeOverrides() {
  return (await feeSnapshot()).overrides;
}

function consumedGas(transactions, sender) {
  return (transactions || []).reduce((total, transaction) => {
    if (!transaction.from || !same(transaction.from, sender)) return total;
    return total.add(ethers.BigNumber.from(transaction.gasUsed || 0));
  }, ethers.constants.Zero);
}

function gasBudget(roleGas, transactions, sender, balance, projectedGasPrice, safetyBps) {
  const baselineGas = ethers.BigNumber.from(roleGas);
  const spentGas = consumedGas(transactions, sender);
  const remainingGas = spentGas.gte(baselineGas) ? ethers.constants.Zero : baselineGas.sub(spentGas);
  const requiredWei = remainingGas.mul(projectedGasPrice).mul(safetyBps).add(9999).div(10000);
  return {
    baselineGas: baselineGas.toString(),
    recordedGas: spentGas.toString(),
    remainingGas: remainingGas.toString(),
    requiredPOL: ethers.utils.formatEther(requiredWei),
    balancePOL: ethers.utils.formatEther(balance),
    sufficient: balance.gte(requiredWei),
  };
}

async function readWithRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  throw new Error(`${label} failed after 3 read-only attempts (${lastError?.code || "RPC_READ_FAILED"})`);
}

function safeErrorMessage(error) {
  return String(error?.reason || error?.message || error || "unknown error")
    .replace(/https?:\/\/[^\s)\]]+/gi, "[redacted-url]")
    .replace(/\b0x[0-9a-fA-F]{64}\b/g, "[redacted-64-byte-value]");
}

function setNested(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== "object") cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts.at(-1)] = value;
}

async function main() {
  const execute = env("CORE_V2_MIGRATION_EXECUTE") === "1";
  const resume = env("CORE_V2_MIGRATION_RESUME") === "1";
  const stageChapters = envInt("CORE_V2_STAGE_CHAPTERS", 0);
  const cutoverThrough = envInt("CORE_V2_CUTOVER_THROUGH", 0);
  if (stageChapters > CHAPTER_COUNT) throw new Error(`CORE_V2_STAGE_CHAPTERS must not exceed ${CHAPTER_COUNT}`);
  if (cutoverThrough > CHAPTER_COUNT) throw new Error(`CORE_V2_CUTOVER_THROUGH must not exceed ${CHAPTER_COUNT}`);
  if (stageChapters && cutoverThrough) {
    throw new Error("CORE_V2_STAGE_CHAPTERS and CORE_V2_CUTOVER_THROUGH are mutually exclusive");
  }
  const confirmations = envInt("TX_CONFIRMATIONS", 2);
  const root = path.resolve(__dirname, "../..");
  const addressFile = path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json")));
  const seedPlanFile = path.join(root, "metadata/main/core-v2-seed-plan.json");
  const gasBaselineFile = path.join(root, "metadata/main/core-v2-gas-baseline.json");
  const layoutFile = path.join(root, "metadata/main/main-layout.json");
  const resumeFile = path.resolve(env(
    "CORE_V2_RESUME_FILE",
    path.join(root, "addresses.core-v2-migration.resume.polygon.json"),
  ));
  const reportFile = path.resolve(env(
    "CORE_V2_REPORT_FILE",
    path.join(root, "reports/core-v2-migration-polygon.json"),
  ));
  const preflightReportFile = path.resolve(env(
    "CORE_V2_PREFLIGHT_REPORT_FILE",
    path.join(root, "reports/core-v2-preflight-polygon.json"),
  ));

  const chain = await ethers.provider.getNetwork();
  if (network.name !== "polygon" || Number(chain.chainId) !== 137) {
    throw new Error(`Polygon mainnet required, received ${network.name} (${chain.chainId})`);
  }

  const book = readJson(addressFile);
  const seedPlan = readJson(seedPlanFile);
  const gasBaseline = readJson(gasBaselineFile);
  const configurationLimit = stageChapters || cutoverThrough || CHAPTER_COUNT;
  const requiresFutureChapterSeed = configurationLimit > 1;
  if (gasBaseline.schemaVersion !== 1 || gasBaseline.chainId !== 137 || gasBaseline.testResult !== "5 passing") {
    throw new Error("CORE V2 gas baseline is missing a successful Polygon fork rehearsal");
  }
  const safetyBps = envInt("CORE_V2_GAS_SAFETY_BPS", gasBaseline.safetyBps);
  if (safetyBps < 10000) throw new Error("CORE_V2_GAS_SAFETY_BPS must be at least 10000");
  if (seedPlan.chainId !== 137 || seedPlan.rowsPerChapter !== ROWS_PER_CHAPTER) {
    throw new Error("Seed plan chain or row count mismatch");
  }
  let layoutHash = null;
  let proposedRows = [];
  if (requiresFutureChapterSeed) {
    const layoutBuffer = fs.readFileSync(layoutFile);
    const layout = JSON.parse(layoutBuffer.toString("utf8"));
    layoutHash = sha256(layoutBuffer);
    if (layoutHash !== seedPlan.layoutSha256) throw new Error("Hash-pinned metadata layout mismatch");
    if (!Array.isArray(layout) || layout.length !== ROWS_PER_CHAPTER) {
      throw new Error("Metadata layout must contain 550 rows");
    }
    proposedRows = layout.map((row, index) => {
      const normalized = {
        background: Number(row.background),
        blockIdx: Number(row.blockIdx),
        mainId: String(row.mainId),
        minted: false,
      };
      if (Number(row.idx) !== index + 1 || !rowValid(normalized)) {
        throw new Error(`Invalid candidate metadata row ${index + 1}`);
      }
      return normalized;
    });
  }

  const expectedOwner = address(book.OWNER || book.DEV_WALLET, "OWNER");
  const expectedDeployer = address(book.DEPLOYER || book.deployer, "DEPLOYER");
  const A = {
    hub: await requireCode("TICKET_HUB", book.TICKET_HUB),
    registry: await requireCode("REGISTRY", book.REGISTRY),
    controller: await requireCode("CHAPTER_CONTROLLER", book.CHAPTER_CONTROLLER),
    oldRouter: await requireCode("VRF_ROUTER", book.VRF_ROUTER),
    compute: await requireCode("COMPUTE", book.COMPUTE),
    names: await requireCode("BIGGI_NAMES_LIB", book.BIGGI_NAMES_LIB),
    collectionRewards: await requireCode("COLLECTION_REWARDS", book.COLLECTION_REWARDS),
    chapterReader: await requireCode("CHAPTER_SERIES_READER", book.CHAPTER_SERIES_READER),
  };
  await requireCode("MULTICALL", MULTICALL);

  const configuredChapters = Array.isArray(book.chapters) ? book.chapters : [];
  if (configuredChapters.length !== CHAPTER_COUNT) throw new Error("Address book must contain exactly five chapters");
  const oldChapters = configuredChapters
    .map((chapter) => ({
      id: Number(chapter.chapterId),
      oldMain: address(chapter.MAIN, `chapter ${chapter.chapterId} old MAIN`),
      publicCollection: address(chapter.MAIN2, `chapter ${chapter.chapterId} MAIN2`),
    }))
    .sort((left, right) => left.id - right.id);
  if (oldChapters.some((chapter, index) => chapter.id !== index + 1)) {
    throw new Error("Address book chapter IDs must be 1 through 5");
  }
  for (const chapter of oldChapters) {
    await requireCode(`chapter ${chapter.id} old MAIN`, chapter.oldMain);
    await requireCode(`chapter ${chapter.id} MAIN2`, chapter.publicCollection);
  }

  const hub = await ethers.getContractAt("BiggiTicketHub", A.hub);
  const registry = await ethers.getContractAt("BiggiSeriesRegistry", A.registry);
  const controller = await ethers.getContractAt("BiggiChapterController", A.controller);
  const oldRouter = await ethers.getContractAt("BiggiVRFRouter", A.oldRouter);
  const collectionRewards = await ethers.getContractAt("BiggiCollectionRewards", A.collectionRewards);
  await requireOwner("TicketHub", hub, expectedOwner);
  await requireOwner("Registry", registry, expectedOwner);
  await requireOwner("old VRF router", oldRouter, expectedOwner);
  await requireOwner("CollectionRewards", collectionRewards, expectedOwner);

  const coordinatorAddress = await requireCode("VRF coordinator", await oldRouter.coordinator());
  const subId = await oldRouter.subId();
  const keyHash = await oldRouter.keyHash();
  const coordinator = new ethers.Contract(coordinatorAddress, [
    "function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address subOwner,address[] consumers)",
    "function addConsumer(uint256 subId,address consumer)",
  ], ethers.provider);
  const subscription = await coordinator.getSubscription(subId);
  const subscriptionOwner = subscription.subOwner || subscription[3];
  const subscriptionConsumers = subscription.consumers || subscription[4];
  if (!same(subscriptionOwner, expectedOwner)) throw new Error("VRF subscription owner mismatch");
  if (!ethers.BigNumber.from(subscription.reqCount ?? subscription[2]).isZero()) {
    throw new Error("VRF subscription has historical requests; zero-state migration is forbidden");
  }
  if (!subscriptionConsumers.some((consumer) => same(consumer, A.oldRouter))) {
    throw new Error("Old CORE router is not registered as a subscription consumer");
  }

  let state = fs.existsSync(resumeFile) ? readJson(resumeFile) : null;
  if (state && !resume && execute && state.status !== "complete") {
    throw new Error(`Incomplete migration state exists at ${resumeFile}; use --resume`);
  }
  if (resume && !state) throw new Error(`Resume file not found: ${resumeFile}`);
  if (state && (Number(state.chainId) !== 137 || !same(state.owner, expectedOwner))) {
    throw new Error("Resume state chain or owner mismatch");
  }

  const multicall = new ethers.Contract(MULTICALL, MULTICALL_ABI, ethers.provider);
  async function batchRead(contract, calls, blockTag = undefined) {
    const payload = calls.map(([method, args = []]) => ({
      target: contract.address,
      callData: contract.interface.encodeFunctionData(method, args),
    }));
    const result = await readWithRetry("Multicall", () => multicall.callStatic.aggregate(
      payload,
      blockTag == null ? {} : { blockTag },
    ));
    return calls.map(([method], index) => contract.interface.decodeFunctionResult(method, result.returnData[index]));
  }

  const snapshotBlock = await ethers.provider.getBlockNumber();
  const snapshots = [];
  for (const chapter of oldChapters) {
    const oldMain = await ethers.getContractAt("BiggiEyesMain", chapter.oldMain);
    const publicCollection = await ethers.getContractAt("BiggiEyesMain2", chapter.publicCollection);
    await requireOwner(`chapter ${chapter.id} old MAIN`, oldMain, expectedOwner);
    await requireOwner(`chapter ${chapter.id} MAIN2`, publicCollection, expectedOwner);
    if (Number(await oldMain.biggiMinted()) !== 0) throw new Error(`Chapter ${chapter.id} has minted VRF NFTs`);
    if (await hub.chapterActive(chapter.id)) throw new Error(`Chapter ${chapter.id} must remain inactive`);

    const currentRegistry = await registry.getChapterCollections(chapter.id);
    const resumedMain = state?.chapters?.find((item) => Number(item.id) === chapter.id)?.newMain;
    const allowedCurrentMains = [chapter.oldMain, resumedMain].filter(Boolean);
    if (!allowedCurrentMains.some((candidate) => same(candidate, currentRegistry.vrfCollection))) {
      throw new Error(`Chapter ${chapter.id} registry points to an unexpected VRF collection`);
    }
    if (!same(currentRegistry.publicCollection, chapter.publicCollection) || !same(currentRegistry.ticketHub, A.hub)) {
      throw new Error(`Chapter ${chapter.id} registry public collection or TicketHub mismatch`);
    }
    const currentHubMain = await hub.chapterMainCollection(chapter.id);
    if (!allowedCurrentMains.some((candidate) => same(candidate, currentHubMain))) {
      throw new Error(`Chapter ${chapter.id} TicketHub binding is unexpected`);
    }

    let historicalRows = [];
    for (let start = 1; start <= ROWS_PER_CHAPTER; start += BATCH_SIZE) {
      const calls = Array.from({ length: BATCH_SIZE }, (_, index) => ["nftInfo", [start + index]]);
      const decoded = await batchRead(oldMain, calls, snapshotBlock);
      historicalRows.push(...decoded.map(rowFromDecoded));
    }
    let expectedRows;
    let metadataSource;
    if (chapter.id === 1) {
      if (!historicalRows.every(rowValid)) throw new Error("Chapter 1 historical metadata is incomplete or minted");
      expectedRows = historicalRows;
      metadataSource = "historical-onchain-copy";
    } else if (chapter.id <= configurationLimit) {
      if (!historicalRows.every(rowUnset)) {
        throw new Error(`Chapter ${chapter.id} historical metadata is not completely unset`);
      }
      const seedEntry = seedPlan.chapters.find((entry) => Number(entry.chapterId) === chapter.id);
      if (seedEntry?.source !== "approved-layout-seed") throw new Error(`Chapter ${chapter.id} seed decision is missing`);
      expectedRows = proposedRows;
      metadataSource = "hash-pinned-layout-seed";
    } else {
      if (!historicalRows.every(rowUnset)) {
        throw new Error(`Deferred chapter ${chapter.id} historical metadata is not completely unset`);
      }
      expectedRows = null;
      metadataSource = "deferred-user-definition";
    }

    const settingsCalls = [
      ["compute"], ["contractURI"], ["rewardsBaseURI"], ["charactersBaseURI"],
      ...Array.from({ length: 10 }, (_, index) => ["blockBaseURIs", [index + 1]]),
      ...Array.from({ length: 10 }, (_, index) => ["getCurrentBlockPrice", [index + 1]]),
    ];
    const settingsResult = await batchRead(oldMain, settingsCalls, snapshotBlock);
    const settings = {
      compute: address(settingsResult[0][0], `chapter ${chapter.id} compute`),
      contractURI: settingsResult[1][0],
      rewardsBaseURI: settingsResult[2][0],
      charactersBaseURI: settingsResult[3][0],
      blockBaseURIs: Array.from({ length: 10 }, (_, index) => settingsResult[4 + index][0]),
      blockPrices: Array.from({ length: 10 }, (_, index) => settingsResult[14 + index][0].toString()),
    };
    if (!same(settings.compute, A.compute)) throw new Error(`Chapter ${chapter.id} compute mismatch`);

    const budget = await collectionRewards.collectionBudgetSnapshot(chapter.oldMain);
    if (!ethers.BigNumber.from(budget.fundedBudget ?? budget[3]).isZero() ||
        !ethers.BigNumber.from(budget.spentBudget ?? budget[4]).isZero() ||
        Boolean(budget.claimsEnabled ?? budget[1])) {
      throw new Error(`Chapter ${chapter.id} old reward budget is not empty and locked`);
    }
    const explicitPriceProvider = await publicCollection.priceProvider();
    if (![chapter.oldMain, resumedMain, ZERO].filter(Boolean).some((candidate) => same(candidate, explicitPriceProvider))) {
      throw new Error(`Chapter ${chapter.id} public priceProvider is unexpected`);
    }
    snapshots.push({
      ...chapter,
      expectedRows,
      metadataSource,
      metadataHash: expectedRows
        ? sha256(Buffer.from(JSON.stringify(expectedRows)))
        : null,
      settings,
    });
  }
  const configurationSnapshots = snapshots.filter((chapter) => chapter.id <= configurationLimit);
  const cutoverSnapshots = cutoverThrough
    ? snapshots.filter((chapter) => chapter.id <= cutoverThrough)
    : snapshots;
  const deferredSnapshots = cutoverThrough
    ? snapshots.filter((chapter) => chapter.id > cutoverThrough)
    : [];

  const deployerKey = env("DEPLOYER_PRIVATE_KEY");
  const ownerKey = env("OWNER_PRIVATE_KEY");
  const deployer = /^0x[0-9a-fA-F]{64}$/.test(deployerKey)
    ? new ethers.Wallet(deployerKey, ethers.provider)
    : null;
  const owner = /^0x[0-9a-fA-F]{64}$/.test(ownerKey)
    ? new ethers.Wallet(ownerKey, ethers.provider)
    : null;
  const feePolicy = await feeSnapshot();
  const fees = feePolicy.overrides;
  const deployerBalance = deployer ? await ethers.provider.getBalance(deployer.address) : ethers.constants.Zero;
  const ownerBalance = owner ? await ethers.provider.getBalance(owner.address) : ethers.constants.Zero;
  const balances = {
    deployer: deployer ? ethers.utils.formatEther(deployerBalance) : null,
    owner: owner ? ethers.utils.formatEther(ownerBalance) : null,
  };
  const currentDeployerGas = deployer
    ? consumedGas(state?.transactions, deployer.address)
    : ethers.constants.Zero;
  const currentOwnerGas = owner
    ? consumedGas(state?.transactions, owner.address)
    : ethers.constants.Zero;
  let deployerGasBaseline = gasBaseline.core.deployerGas;
  let ownerGasBaseline;
  if (stageChapters > 0 && stageChapters < CHAPTER_COUNT) {
    ownerGasBaseline = ethers.BigNumber.from(gasBaseline.core.stagedOwnerGasPerChapter).mul(stageChapters).toString();
  } else if (cutoverThrough > 0 && cutoverThrough < CHAPTER_COUNT) {
    const selectiveBaseline = gasBaseline.core.selectiveCutover;
    if (!selectiveBaseline || Number(selectiveBaseline.throughChapter) !== cutoverThrough) {
      throw new Error(`Missing fork-tested selective cutover gas baseline for chapters 1-${cutoverThrough}`);
    }
    const existingPlan = state?.selectiveCutovers?.[String(cutoverThrough)];
    const ownerStartGas = ethers.BigNumber.from(existingPlan?.ownerStartGas ?? currentOwnerGas);
    const deployerStartGas = ethers.BigNumber.from(existingPlan?.deployerStartGas ?? currentDeployerGas);
    ownerGasBaseline = ownerStartGas.add(selectiveBaseline.ownerGas).toString();
    deployerGasBaseline = deployerStartGas.add(selectiveBaseline.deployerGas).toString();
  } else {
    ownerGasBaseline = gasBaseline.core.ownerGas;
  }
  const financialPlan = deployer && owner ? {
    baselineForkBlock: gasBaseline.forkBlock,
    baselineTestResult: gasBaseline.testResult,
    safetyBps,
    projectedEffectiveFeeGwei: ethers.utils.formatUnits(feePolicy.projectedEffectiveGasPrice, "gwei"),
    deployer: gasBudget(
      deployerGasBaseline,
      state?.transactions,
      deployer.address,
      deployerBalance,
      feePolicy.projectedEffectiveGasPrice,
      safetyBps,
    ),
    owner: gasBudget(
      ownerGasBaseline,
      state?.transactions,
      owner.address,
      ownerBalance,
      feePolicy.projectedEffectiveGasPrice,
      safetyBps,
    ),
  } : null;
  const financialReady = Boolean(financialPlan?.deployer.sufficient && financialPlan?.owner.sufficient);
  const preflight = {
    mode: execute ? (resume ? "resume" : "execute") : "dry-run",
    chainId: 137,
    snapshotBlock,
    owner: expectedOwner,
    deployer: expectedDeployer,
    balancesPOL: balances,
    maxFeeGwei: ethers.utils.formatUnits(fees.maxFeePerGas, "gwei"),
    priorityFeeGwei: ethers.utils.formatUnits(fees.maxPriorityFeePerGas, "gwei"),
    financialPlan,
    financialReady,
    stageChapters: stageChapters || null,
    cutoverThrough: cutoverThrough || null,
    oldRouter: A.oldRouter,
    coordinator: coordinatorAddress,
    subscriptionId: subId.toString(),
    subscriptionNativeBalance: ethers.utils.formatEther(subscription.nativeBalance ?? subscription[1]),
    subscriptionRequestCount: (subscription.reqCount ?? subscription[2]).toString(),
    seedLayoutSha256: layoutHash,
    seedFileBroadcastAuthorized: Boolean(seedPlan.broadcastAuthorized),
    chapters: snapshots.map((chapter) => ({
      id: chapter.id,
      oldMain: chapter.oldMain,
      publicCollection: chapter.publicCollection,
      metadataSource: chapter.metadataSource,
      metadataHash: chapter.metadataHash,
    })),
  };
  console.log(JSON.stringify(preflight, null, 2));

  if (!execute) {
    const result = financialReady
      ? "preflight-pass-no-transactions"
      : "preflight-structural-pass-financial-blocked-no-transactions";
    writeJson(preflightReportFile, { ...preflight, result, checkedAt: new Date().toISOString() });
    console.log(`Preflight PASS. No transactions sent. Report: ${preflightReportFile}`);
    return;
  }
  if (!deployer || !same(deployer.address, expectedDeployer)) throw new Error("DEPLOYER_PRIVATE_KEY signer mismatch");
  if (!owner || !same(owner.address, expectedOwner)) throw new Error("OWNER_PRIVATE_KEY signer mismatch");
  if (env("CONFIRM_CORE_V2_MIGRATION") !== EXECUTE_CONFIRMATION) {
    throw new Error(`Set CONFIRM_CORE_V2_MIGRATION=${EXECUTE_CONFIRMATION}`);
  }
  if (requiresFutureChapterSeed) {
    if (seedPlan.broadcastAuthorized !== true) {
      throw new Error("Future chapter metadata seed is not approved for mainnet broadcast");
    }
    if (env("CONFIRM_CORE_V2_SEED") !== SEED_CONFIRMATION) {
      throw new Error(`Set CONFIRM_CORE_V2_SEED=${SEED_CONFIRMATION}`);
    }
  }
  const insufficientRoles = Object.entries({
    deployer: financialPlan.deployer,
    owner: financialPlan.owner,
  }).filter(([, budget]) => !budget.sufficient);
  if (insufficientRoles.length) {
    const detail = insufficientRoles
      .map(([role, budget]) => `${role} requires ${budget.requiredPOL} POL, balance ${budget.balancePOL} POL`)
      .join("; ");
    throw new Error(`CORE V2 financial gate failed: ${detail}`);
  }

  const report = fs.existsSync(reportFile) && resume
    ? readJson(reportFile)
    : { ...preflight, result: "in-progress", transactions: [], startedAt: new Date().toISOString() };
  if (!state) {
    state = {
      schemaVersion: 1,
      chainId: 137,
      owner: expectedOwner,
      deployer: expectedDeployer,
      status: "initialized",
      oldRouter: A.oldRouter,
      coordinator: coordinatorAddress,
      subscriptionId: subId.toString(),
      chapters: snapshots.map((chapter) => ({
        id: chapter.id,
        oldMain: chapter.oldMain,
        publicCollection: chapter.publicCollection,
        metadataHash: chapter.metadataHash,
      })),
      transactions: [],
      updatedAt: new Date().toISOString(),
    };
    writeJson(resumeFile, state);
  }

  function persist(status = state.status) {
    state.status = status;
    state.updatedAt = new Date().toISOString();
    writeJson(resumeFile, state);
    report.transactions = state.transactions;
    writeJson(reportFile, report);
  }

  if (cutoverThrough > 0 && cutoverThrough < CHAPTER_COUNT) {
    state.selectiveCutovers = state.selectiveCutovers || {};
    const key = String(cutoverThrough);
    if (!state.selectiveCutovers[key]) {
      state.selectiveCutovers[key] = {
        throughChapter: cutoverThrough,
        ownerStartGas: currentOwnerGas.toString(),
        deployerStartGas: currentDeployerGas.toString(),
        startedAt: new Date().toISOString(),
      };
      persist(`selective-cutover-through-${cutoverThrough}-initialized`);
    }
  }

  async function resolvePending() {
    if (!state.pending) return;
    const receipt = await ethers.provider.getTransactionReceipt(state.pending.hash);
    if (!receipt) throw new Error(`Pending transaction ${state.pending.hash} is not mined; resume later, do not resend`);
    if (receipt.status !== 1) {
      const failedTransaction = await ethers.provider.getTransaction(state.pending.hash);
      const exhaustedGas = failedTransaction?.gasLimit && receipt.gasUsed.eq(failedTransaction.gasLimit);
      if (!state.pending.label.includes("sealMetadata") || !exhaustedGas) {
        throw new Error(`Pending transaction failed for a reason other than proven sealMetadata out-of-gas: ${state.pending.hash}`);
      }
      state.failedTransactions = state.failedTransactions || [];
      state.failedTransactions.push({
        label: state.pending.label,
        hash: state.pending.hash,
        from: receipt.from,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        reason: "gas-limit-exhausted",
      });
      const failedLabel = state.pending.label;
      delete state.pending;
      persist(`retry-required:${failedLabel}`);
      console.log(`${failedLabel}: recorded failed OOG receipt; operation remains incomplete and may be retried`);
      return false;
    }
    if (state.pending.assignContractAddress) {
      if (!receipt.contractAddress) throw new Error(`Deployment receipt lacks contract address: ${state.pending.hash}`);
      setNested(state, state.pending.assignContractAddress, receipt.contractAddress);
    }
    state.transactions.push({
      label: state.pending.label,
      hash: state.pending.hash,
      from: receipt.from,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });
    delete state.pending;
    persist();
    return true;
  }

  async function send(label, transactionFactory, assignContractAddress = "") {
    if (state.pending) await resolvePending();
    const currentFees = await feeOverrides();
    const result = await transactionFactory(currentFees);
    const tx = result.deployTransaction || result;
    if (!tx?.hash || typeof tx.wait !== "function") {
      throw new Error(`${label} did not return a transaction response`);
    }
    state.pending = { label, hash: tx.hash, assignContractAddress };
    persist(`pending:${label}`);
    const receipt = await tx.wait(confirmations);
    if (receipt.status !== 1) {
      await resolvePending();
      throw new Error(`${label} failed: ${tx.hash}`);
    }
    await resolvePending();
    console.log(`${label}: ${tx.hash} (gas ${receipt.gasUsed.toString()})`);
    return receipt;
  }
  await resolvePending();

  const routerFactory = await ethers.getContractFactory("BiggiVRFRouterV2", deployer);
  if (!state.router || (await ethers.provider.getCode(state.router)) === "0x") {
    await send("deploy BiggiVRFRouterV2", (txFees) => routerFactory.deploy(
      coordinatorAddress,
      expectedOwner,
      keyHash,
      subId,
      txFees,
    ), "router");
  }
  const router = await ethers.getContractAt("BiggiVRFRouterV2", state.router, owner);
  await requireOwner("new VRF router", router, expectedOwner);
  if (!(await router.vrfRecoveryVersion()).eq(2)) throw new Error("New router version mismatch");

  const mainFactory = await ethers.getContractFactory("BiggiEyesMainV2", {
    signer: deployer,
    libraries: { BiggiNamesLib: A.names },
  });
  const deploymentSnapshots = cutoverThrough ? configurationSnapshots : snapshots;
  for (const chapter of deploymentSnapshots) {
    const stateChapter = state.chapters.find((item) => Number(item.id) === chapter.id);
    if (!stateChapter.newMain || (await ethers.provider.getCode(stateChapter.newMain)) === "0x") {
      await send(
        `deploy BiggiEyesMainV2 chapter ${chapter.id}`,
        (txFees) => mainFactory.deploy(expectedOwner, txFees),
        `chapters.${state.chapters.indexOf(stateChapter)}.newMain`,
      );
    }
  }
  persist("contracts-deployed");

  for (const chapter of configurationSnapshots) {
    const stateChapter = state.chapters.find((item) => Number(item.id) === chapter.id);
    const target = await ethers.getContractAt("BiggiEyesMainV2", stateChapter.newMain, owner);
    await requireOwner(`new MAIN chapter ${chapter.id}`, target, expectedOwner);
    if (!(await target.vrfRecoveryVersion()).eq(2)) throw new Error(`Chapter ${chapter.id} V2 version mismatch`);
    if (!same(await target.compute(), chapter.settings.compute) || !same(await target.vrfRouter(), router.address)) {
      await send(`chapter ${chapter.id} setModules`, (txFees) => target.setModules(chapter.settings.compute, router.address, txFees));
    }
    if (!(await target.chapterId()).eq(chapter.id)) {
      await send(`chapter ${chapter.id} setChapterId`, (txFees) => target.setChapterId(chapter.id, txFees));
    }

    for (let start = 0; start < ROWS_PER_CHAPTER; start += BATCH_SIZE) {
      const expectedBatch = chapter.expectedRows.slice(start, start + BATCH_SIZE);
      const calls = expectedBatch.map((_, index) => ["nftInfo", [start + index + 1]]);
      const actualBatch = (await batchRead(target, calls)).map(rowFromDecoded);
      const missing = [];
      actualBatch.forEach((actual, index) => {
        if (rowsEqual(actual, expectedBatch[index])) return;
        if (!rowUnset(actual)) throw new Error(`Chapter ${chapter.id} target metadata mismatch at ${start + index + 1}`);
        missing.push(index);
      });
      if (missing.length) {
        await send(`chapter ${chapter.id} seed rows ${start + 1}-${start + BATCH_SIZE}`, (txFees) =>
          target.batchSetNFTBackgroundAndBlock(
            missing.map((index) => start + index + 1),
            missing.map((index) => expectedBatch[index].background),
            missing.map((index) => expectedBatch[index].blockIdx),
            missing.map((index) => expectedBatch[index].mainId),
            txFees,
          ));
      }
    }
    if (!(await target.metadataSealed())) {
      const sealEstimate = await target.estimateGas.sealMetadata();
      const sealMarginBps = envInt("CORE_V2_SEAL_GAS_MARGIN_BPS", 12000);
      if (sealMarginBps < 10000) throw new Error("CORE_V2_SEAL_GAS_MARGIN_BPS must be at least 10000");
      const configuredFloor = ethers.BigNumber.from(env("CORE_V2_SEAL_GAS_LIMIT", "0"));
      const estimatedLimit = sealEstimate.mul(sealMarginBps).add(9999).div(10000);
      const sealGasLimit = configuredFloor.gt(estimatedLimit) ? configuredFloor : estimatedLimit;
      const blockGasLimit = (await ethers.provider.getBlock("latest")).gasLimit;
      if (sealGasLimit.gte(blockGasLimit)) {
        throw new Error(`sealMetadata gas limit ${sealGasLimit.toString()} exceeds current block capacity`);
      }
      console.log(`chapter ${chapter.id} sealMetadata estimate ${sealEstimate.toString()}, limit ${sealGasLimit.toString()}`);
      await send(`chapter ${chapter.id} sealMetadata`, (txFees) => target.sealMetadata({ ...txFees, gasLimit: sealGasLimit }));
    }
    const metadataState = await target.metadataConsistency();
    if (!metadataState.configuredCount.eq(ROWS_PER_CHAPTER) || !metadataState.fullyConfigured || !metadataState.rewardMatrixConsistent) {
      throw new Error(`Chapter ${chapter.id} target metadata consistency failed`);
    }
    if ((await target.contractURI()) !== chapter.settings.contractURI) {
      await send(`chapter ${chapter.id} setContractURI`, (txFees) => target.setContractURI(chapter.settings.contractURI, txFees));
    }
    if ((await target.rewardsBaseURI()) !== chapter.settings.rewardsBaseURI) {
      await send(`chapter ${chapter.id} set rewards URI`, (txFees) => target.setURI(0, 0, chapter.settings.rewardsBaseURI, txFees));
    }
    if ((await target.charactersBaseURI()) !== chapter.settings.charactersBaseURI) {
      await send(`chapter ${chapter.id} set characters URI`, (txFees) => target.setURI(1, 0, chapter.settings.charactersBaseURI, txFees));
    }
    for (let blockId = 1; blockId <= 10; blockId += 1) {
      if ((await target.blockBaseURIs(blockId)) !== chapter.settings.blockBaseURIs[blockId - 1]) {
        await send(`chapter ${chapter.id} set block ${blockId} URI`, (txFees) =>
          target.setURI(3, blockId, chapter.settings.blockBaseURIs[blockId - 1], txFees));
      }
      if (!(await target.getCurrentBlockPrice(blockId)).eq(chapter.settings.blockPrices[blockId - 1])) {
        await send(`chapter ${chapter.id} set block ${blockId} price`, (txFees) =>
          target.setBlockCurrentPrice(blockId, chapter.settings.blockPrices[blockId - 1], txFees));
      }
    }
    stateChapter.configured = true;
    persist(`chapter-${chapter.id}-configured`);
  }

  if (stageChapters > 0 && stageChapters < CHAPTER_COUNT) {
    const configured = state.chapters
      .filter((chapter) => chapter.configured)
      .map((chapter) => Number(chapter.id))
      .sort((left, right) => left - right);
    const expected = Array.from({ length: stageChapters }, (_, index) => index + 1);
    if (JSON.stringify(configured) !== JSON.stringify(expected)) {
      throw new Error(`Staged configuration mismatch: expected ${expected.join(",")}, got ${configured.join(",")}`);
    }
    persist(`staged-chapters-1-${stageChapters}-configured`);
    report.result = `staged-chapters-1-${stageChapters}-configured-no-cutover`;
    report.stageChapters = stageChapters;
    report.router = state.router;
    report.chapters = state.chapters;
    report.updatedAt = new Date().toISOString();
    writeJson(reportFile, report);
    console.log(JSON.stringify({
      result: report.result,
      router: state.router,
      configuredChapters: configured,
      cutoverStarted: false,
      chaptersRemainInactive: true,
      report: reportFile,
      resume: resumeFile,
      next: "Fund the owner wallet, then run the full CORE V2 resume command without a stage limit.",
    }, null, 2));
    return;
  }

  for (const chapter of cutoverSnapshots) {
    const stateChapter = state.chapters.find((item) => Number(item.id) === chapter.id);
    const target = await ethers.getContractAt("BiggiEyesMainV2", stateChapter.newMain);
    for (let start = 0; start < ROWS_PER_CHAPTER; start += BATCH_SIZE) {
      const expectedBatch = chapter.expectedRows.slice(start, start + BATCH_SIZE);
      const calls = expectedBatch.map((_, index) => ["nftInfo", [start + index + 1]]);
      const actualBatch = (await batchRead(target, calls)).map(rowFromDecoded);
      actualBatch.forEach((actual, index) => {
        if (!rowsEqual(actual, expectedBatch[index])) {
          throw new Error(`Final target metadata mismatch, chapter ${chapter.id}, row ${start + index + 1}`);
        }
      });
    }
    if (!(await target.metadataSealed())) throw new Error(`Chapter ${chapter.id} metadata is not sealed`);
  }
  persist(cutoverThrough ? `metadata-verified-through-${cutoverThrough}` : "all-metadata-verified");

  const chapterOne = state.chapters.find((item) => Number(item.id) === 1);
  const readerFactory = await ethers.getContractFactory("BiggiMainReader", deployer);
  if (!state.mainReader || (await ethers.provider.getCode(state.mainReader)) === "0x") {
    await send("deploy BiggiMainReader", (txFees) => readerFactory.deploy(
      chapterOne.newMain,
      A.hub,
      A.collectionRewards,
      txFees,
    ), "mainReader");
  }
  const mainReader = await ethers.getContractAt("BiggiMainReader", state.mainReader);
  if (!same(await mainReader.main(), chapterOne.newMain) ||
      !same(await mainReader.ticketHub(), A.hub) ||
      !same(await mainReader.collectionRewards(), A.collectionRewards)) {
    throw new Error("New MainReader immutable bindings mismatch");
  }

  const cutoverStateChapters = state.chapters
    .filter((chapter) => cutoverSnapshots.some((candidate) => candidate.id === Number(chapter.id)));
  for (const stateChapter of cutoverStateChapters) {
    if (!(await router.approvedMains(stateChapter.newMain))) {
      if (Number(stateChapter.id) === 1) {
        await send("router set chapter 1 main", (txFees) => router.setMain(stateChapter.newMain, txFees));
      } else {
        await send(`router approve chapter ${stateChapter.id}`, (txFees) =>
          router.setMainApproval(stateChapter.newMain, true, txFees));
      }
    }
  }
  if (!same(await router.main(), chapterOne.newMain)) {
    await send("router set default main", (txFees) => router.setMain(chapterOne.newMain, txFees));
  }

  let currentSubscription = await coordinator.getSubscription(subId);
  let currentConsumers = currentSubscription.consumers || currentSubscription[4];
  if (!currentConsumers.some((consumer) => same(consumer, router.address))) {
    await send("VRF subscription add CORE V2 router", (txFees) =>
      coordinator.connect(owner).addConsumer(subId, router.address, txFees));
  }
  currentSubscription = await coordinator.getSubscription(subId);
  currentConsumers = currentSubscription.consumers || currentSubscription[4];
  if (!currentConsumers.some((consumer) => same(consumer, router.address)) ||
      !currentConsumers.some((consumer) => same(consumer, A.oldRouter))) {
    throw new Error("VRF subscription consumer retention check failed");
  }
  persist("router-ready-and-registered");

  const deferredBefore = new Map();
  for (const chapter of deferredSnapshots) {
    const current = await registry.getChapterCollections(chapter.id);
    const publicCollection = await ethers.getContractAt("BiggiEyesMain2", chapter.publicCollection);
    deferredBefore.set(chapter.id, {
      active: await hub.chapterActive(chapter.id),
      hubMain: await hub.chapterMainCollection(chapter.id),
      registryMain: current.vrfCollection,
      registryPublic: current.publicCollection,
      registryHub: current.ticketHub,
      priceProvider: await publicCollection.priceProvider(),
    });
  }

  const hubOwner = hub.connect(owner);
  const registryOwner = registry.connect(owner);
  const rewardsOwner = collectionRewards.connect(owner);
  for (const chapter of cutoverSnapshots) {
    const stateChapter = state.chapters.find((item) => Number(item.id) === chapter.id);
    const target = await ethers.getContractAt("BiggiEyesMainV2", stateChapter.newMain, owner);
    if (await hub.chapterActive(chapter.id)) throw new Error(`Chapter ${chapter.id} became active during migration`);
    if (!same(await hub.chapterMainCollection(chapter.id), target.address)) {
      await send(`chapter ${chapter.id} TicketHub cutover`, (txFees) =>
        hubOwner.setChapterMainCollection(chapter.id, target.address, txFees));
    }
    if (!same(await target.ticketHub(), A.hub)) {
      await send(`chapter ${chapter.id} bind TicketHub`, (txFees) => target.setTicketHub(A.hub, txFees));
    }
    const current = await registry.getChapterCollections(chapter.id);
    if (!same(current.vrfCollection, target.address)) {
      if (!same(current.vrfCollection, chapter.oldMain)) {
        throw new Error(`Chapter ${chapter.id} registry changed unexpectedly before cutover`);
      }
      await send(`chapter ${chapter.id} registry cutover`, (txFees) =>
        registryOwner.setChapterCollections(chapter.id, target.address, chapter.publicCollection, A.hub, txFees));
    }
    const budget = await collectionRewards.collectionBudgetSnapshot(target.address);
    if (!Boolean(budget.configured ?? budget[0])) {
      await send(`chapter ${chapter.id} configure reward budget`, (txFees) =>
        rewardsOwner.configureCollectionBudget(target.address, txFees));
    }
    const publicCollection = await ethers.getContractAt("BiggiEyesMain2", chapter.publicCollection, owner);
    const explicitPriceProvider = await publicCollection.priceProvider();
    if (same(explicitPriceProvider, chapter.oldMain)) {
      await send(`chapter ${chapter.id} public priceProvider`, (txFees) =>
        publicCollection.setPriceProvider(target.address, txFees));
    } else if (!same(explicitPriceProvider, target.address) && !same(explicitPriceProvider, ZERO)) {
      throw new Error(`Chapter ${chapter.id} public priceProvider changed unexpectedly`);
    }
    stateChapter.cutover = true;
    persist(`chapter-${chapter.id}-cutover`);
  }

  if (!same(await collectionRewards.defaultMain(), chapterOne.newMain)) {
    await send("CollectionRewards set default Main", (txFees) => rewardsOwner.setMain(chapterOne.newMain, txFees));
  }
  if (!same(await collectionRewards.fundingCollection(), chapterOne.newMain)) {
    await send("CollectionRewards set funding collection", (txFees) =>
      rewardsOwner.setFundingCollection(chapterOne.newMain, txFees));
  }

  const postChecks = {};
  for (const chapter of cutoverSnapshots) {
    const stateChapter = state.chapters.find((item) => Number(item.id) === chapter.id);
    const target = await ethers.getContractAt("BiggiEyesMainV2", stateChapter.newMain);
    const current = await registry.getChapterCollections(chapter.id);
    postChecks[`chapter${chapter.id}:inactive`] = !(await hub.chapterActive(chapter.id));
    postChecks[`chapter${chapter.id}:hub`] = same(await hub.chapterMainCollection(chapter.id), target.address);
    postChecks[`chapter${chapter.id}:mainHub`] = same(await target.ticketHub(), A.hub);
    postChecks[`chapter${chapter.id}:registry`] = same(current.vrfCollection, target.address) &&
      same(current.publicCollection, chapter.publicCollection) && same(current.ticketHub, A.hub);
    postChecks[`chapter${chapter.id}:router`] = await router.approvedMains(target.address);
    postChecks[`chapter${chapter.id}:stack`] = await controller.isChapterStackConsistent(chapter.id);
    postChecks[`chapter${chapter.id}:cap`] = await controller.isChapterCapConsistent(chapter.id);
    const budget = await collectionRewards.collectionBudgetSnapshot(target.address);
    postChecks[`chapter${chapter.id}:budgetConfigured`] = Boolean(budget.configured ?? budget[0]);
    postChecks[`chapter${chapter.id}:budgetLocked`] = !Boolean(budget.claimsEnabled ?? budget[1]);
  }
  postChecks.oldRouterRetained = currentConsumers.some((consumer) => same(consumer, A.oldRouter));
  postChecks.newRouterRegistered = currentConsumers.some((consumer) => same(consumer, router.address));
  postChecks.defaultMain = same(await collectionRewards.defaultMain(), chapterOne.newMain);
  postChecks.fundingCollection = same(await collectionRewards.fundingCollection(), chapterOne.newMain);
  postChecks.readerMain = same(await mainReader.main(), chapterOne.newMain);
  for (const chapter of deferredSnapshots) {
    const before = deferredBefore.get(chapter.id);
    const current = await registry.getChapterCollections(chapter.id);
    const publicCollection = await ethers.getContractAt("BiggiEyesMain2", chapter.publicCollection);
    postChecks[`chapter${chapter.id}:deferredInactive`] = !before.active && !(await hub.chapterActive(chapter.id));
    postChecks[`chapter${chapter.id}:deferredHubUnchanged`] = same(await hub.chapterMainCollection(chapter.id), before.hubMain);
    postChecks[`chapter${chapter.id}:deferredRegistryUnchanged`] = same(current.vrfCollection, before.registryMain) &&
      same(current.publicCollection, before.registryPublic) && same(current.ticketHub, before.registryHub);
    postChecks[`chapter${chapter.id}:deferredPriceProviderUnchanged`] = same(
      await publicCollection.priceProvider(),
      before.priceProvider,
    );
    const stateChapter = state.chapters.find((item) => Number(item.id) === chapter.id);
    if (stateChapter?.newMain) {
      postChecks[`chapter${chapter.id}:deferredRouterNotApproved`] = !(await router.approvedMains(stateChapter.newMain));
    }
  }
  const failed = Object.entries(postChecks).filter(([, passed]) => !passed).map(([label]) => label);
  if (failed.length) throw new Error(`CORE V2 post-checks failed: ${failed.join(", ")}`);

  const partialCutover = cutoverThrough > 0 && cutoverThrough < CHAPTER_COUNT;
  const finalStatus = partialCutover
    ? `partial-cutover-through-${cutoverThrough}-chapters-inactive`
    : "complete";
  state.status = finalStatus;
  state.completedAt = new Date().toISOString();
  if (partialCutover) {
    state.selectiveCutovers[String(cutoverThrough)].completedAt = state.completedAt;
  }
  persist(finalStatus);
  report.result = partialCutover
    ? `core-v2-partial-cutover-through-${cutoverThrough}-chapters-still-inactive`
    : "core-v2-cutover-complete-chapters-still-inactive";
  report.cutoverThrough = cutoverThrough || CHAPTER_COUNT;
  report.router = router.address;
  report.mainReader = mainReader.address;
  report.chapters = state.chapters;
  report.postChecks = postChecks;
  report.completedAt = state.completedAt;
  writeJson(reportFile, report);
  console.log(JSON.stringify({
    result: report.result,
    router: router.address,
    mainReader: mainReader.address,
    chapters: state.chapters.map(({ id, oldMain, newMain, cutover }) => ({ id, oldMain, newMain, cutover: Boolean(cutover) })),
    report: reportFile,
    resume: resumeFile,
    next: partialCutover
      ? "Run the chapter-aware distributor V2 dry-run and cutover, then update canonical addresses for cut-over chapters only."
      : "Run the chapter-aware distributor V2 dry-run and cutover before updating canonical address books.",
  }, null, 2));
}

main().catch((error) => {
  console.error(safeErrorMessage(error));
  process.exitCode = 1;
});
