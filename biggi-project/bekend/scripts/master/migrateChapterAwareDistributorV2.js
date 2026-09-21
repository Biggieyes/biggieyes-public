const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const CONFIRMATION = "I_UNDERSTAND_MAINNET_STATE_CHANGES";

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
  return ethers.utils.getAddress(left) === ethers.utils.getAddress(right);
}

function address(value, label) {
  if (!value || !ethers.utils.isAddress(value) || same(value, ZERO)) {
    throw new Error(`${label} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

async function hasCode(value) {
  return (await ethers.provider.getCode(value)) !== "0x";
}

async function requireCode(label, value) {
  if (!(await hasCode(value))) throw new Error(`${label} has no contract code at ${value}`);
}

function signerFromKey(name, fallback) {
  const key = env(name);
  return key ? new ethers.Wallet(key, ethers.provider) : fallback;
}

async function requireOwner(label, contract, expectedOwner) {
  const actual = await contract.owner();
  if (!same(actual, expectedOwner)) {
    throw new Error(`${label} owner mismatch: ${actual} != ${expectedOwner}`);
  }
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
    projectedEffectiveGasPrice: projectedEffective,
    overrides: { type: 2, maxPriorityFeePerGas: priority, maxFeePerGas: maxFee },
  };
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

function safeErrorMessage(error) {
  return String(error?.reason || error?.message || error || "unknown error")
    .replace(/https?:\/\/[^\s)\]]+/gi, "[redacted-url]")
    .replace(/\b0x[0-9a-fA-F]{64}\b/g, "[redacted-64-byte-value]");
}

async function main() {
  const execute = env("DISTRIBUTOR_V2_MIGRATION_EXECUTE") === "1" || process.argv.includes("--execute");
  const resume = env("DISTRIBUTOR_V2_MIGRATION_RESUME") === "1" || process.argv.includes("--resume");
  const unknown = process.argv.slice(2).filter((arg) => !["--execute", "--dry-run", "--resume"].includes(arg));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  if (resume && !execute) throw new Error("--resume requires --execute");

  const root = path.resolve(__dirname, "../..");
  const addressFile = path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json")));
  const book = readJson(addressFile);
  const gasBaseline = readJson(path.join(root, "metadata/main/core-v2-gas-baseline.json"));
  if (gasBaseline.schemaVersion !== 1 || gasBaseline.chainId !== 137 || gasBaseline.testResult !== "5 passing") {
    throw new Error("Distributor V2 gas baseline is missing a successful Polygon fork rehearsal");
  }
  const safetyBps = envInt("DISTRIBUTOR_V2_GAS_SAFETY_BPS", gasBaseline.safetyBps);
  if (safetyBps < 10000) throw new Error("DISTRIBUTOR_V2_GAS_SAFETY_BPS must be at least 10000");
  const resumeFile = path.resolve(env(
    "DISTRIBUTOR_V2_RESUME_FILE",
    "./addresses.distributor-v2-migration.resume.polygon.json",
  ));
  const reportFile = path.resolve(env("DISTRIBUTOR_V2_REPORT", "./reports/distributor-v2-migration-polygon.json"));
  let resumeState = fs.existsSync(resumeFile) ? readJson(resumeFile) : null;
  if (resume && !resumeState) throw new Error(`Resume file not found: ${resumeFile}`);
  if (execute && resumeState && !resume && resumeState.status !== "complete") {
    throw new Error(`Incomplete migration state exists at ${resumeFile}; use --resume`);
  }
  const A = {
    registry: address(env("REGISTRY", book.REGISTRY), "REGISTRY"),
    hub: address(env("TICKET_HUB", book.TICKET_HUB), "TICKET_HUB"),
    oldDistributor: address(env("DISTRIBUTOR", book.DISTRIBUTOR), "DISTRIBUTOR"),
    collectionRewards: address(env("COLLECTION_REWARDS", book.COLLECTION_REWARDS), "COLLECTION_REWARDS"),
    reserve: address(env("RESERVE", book.RESERVE), "RESERVE"),
    buyback: address(env("BUYBACK_AGENT", book.BUYBACK_AGENT), "BUYBACK_AGENT"),
    treasury: address(env("TREASURY", book.TREASURY), "TREASURY"),
    community: address(env("COMMUNITY_CENTER", book.COMMUNITY_CENTER), "COMMUNITY_CENTER"),
  };

  const [defaultSigner] = await ethers.getSigners();
  const deployer = signerFromKey("DEPLOYER_PRIVATE_KEY", defaultSigner);
  const ownerSigner = signerFromKey("OWNER_PRIVATE_KEY", deployer);
  const deployerAddress = await deployer.getAddress();
  const ownerSignerAddress = await ownerSigner.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== 137) throw new Error(`Polygon mainnet chainId 137 required, received ${chainId}`);
  if (network.name === "hardhat") await network.provider.send("evm_mine");

  for (const [label, value] of Object.entries(A)) await requireCode(label, value);

  const registry = await ethers.getContractAt("BiggiSeriesRegistry", A.registry);
  const hub = await ethers.getContractAt("BiggiTicketHub", A.hub);
  const oldDistributor = await ethers.getContractAt("BiggiMultiCollectionDistributor", A.oldDistributor);
  const collectionRewards = await ethers.getContractAt("BiggiCollectionRewards", A.collectionRewards);
  const reserve = await ethers.getContractAt("BiggiReserveV4", A.reserve);
  const buyback = await ethers.getContractAt("BiggiBuybackAgent", A.buyback);
  const treasury = await ethers.getContractAt("BiggiTreasury", A.treasury);
  const community = await ethers.getContractAt("BiggiCommunityCenter", A.community);
  const ownedContracts = { hub, collectionRewards, reserve, buyback, treasury, community };
  const ownerAddress = address(env("OWNER", book.OWNER || await hub.owner()), "OWNER");

  for (const [label, contract] of Object.entries(ownedContracts)) {
    await requireOwner(label, contract, ownerAddress);
  }
  const resumedDistributor = resumeState?.DISTRIBUTOR || "";
  const expectedDistributorTargets = [A.oldDistributor, resumedDistributor].filter(Boolean);
  const hubDistributor = await hub.distributor();
  if (!expectedDistributorTargets.some((candidate) => same(hubDistributor, candidate))) {
    throw new Error("TicketHub does not use the expected old or resumed distributor");
  }
  for (const [label, contract] of Object.entries({ collectionRewards, reserve, buyback, treasury, community })) {
    const configuredDistributor = await contract.distributor();
    if (!expectedDistributorTargets.some((candidate) => same(configuredDistributor, candidate))) {
      throw new Error(`${label} does not trust the expected old or resumed distributor`);
    }
  }
  if (!(await oldDistributor.totalPending()).isZero()) throw new Error("Old distributor has pending recipient funds");
  if (!(await ethers.provider.getBalance(A.oldDistributor)).isZero()) throw new Error("Old distributor still holds native balance");

  const chapters = [];
  const sources = new Map();
  sources.set(A.hub.toLowerCase(), A.hub);
  for (let chapterId = 1; chapterId <= 5; chapterId += 1) {
    if (await hub.chapterActive(chapterId)) throw new Error(`Chapter ${chapterId} must be inactive`);
    const collections = await registry.getChapterCollections(chapterId);
    const vrfCollection = address(collections.vrfCollection, `chapter ${chapterId} VRF collection`);
    const publicCollection = address(collections.publicCollection, `chapter ${chapterId} public collection`);
    const ticketHub = address(collections.ticketHub, `chapter ${chapterId} TicketHub`);
    if (!same(ticketHub, A.hub)) throw new Error(`Chapter ${chapterId} uses a different TicketHub`);
    const budget = await collectionRewards.collectionBudgetSnapshot(vrfCollection);
    if (!budget.configured) throw new Error(`Chapter ${chapterId} collection budget is not configured`);
    chapters.push({ chapterId, vrfCollection, publicCollection, ticketHub });
    sources.set(vrfCollection.toLowerCase(), vrfCollection);
    sources.set(publicCollection.toLowerCase(), publicCollection);
  }

  const feePolicy = await feeSnapshot();
  const deployerBalance = await ethers.provider.getBalance(deployerAddress);
  const ownerBalance = await ethers.provider.getBalance(ownerAddress);
  const financialPlan = {
    baselineForkBlock: gasBaseline.forkBlock,
    baselineTestResult: gasBaseline.testResult,
    safetyBps,
    projectedEffectiveFeeGwei: ethers.utils.formatUnits(feePolicy.projectedEffectiveGasPrice, "gwei"),
    deployer: gasBudget(
      gasBaseline.distributor.deployerGas,
      resumeState?.transactions,
      deployerAddress,
      deployerBalance,
      feePolicy.projectedEffectiveGasPrice,
      safetyBps,
    ),
    owner: gasBudget(
      gasBaseline.distributor.ownerGas,
      resumeState?.transactions,
      ownerAddress,
      ownerBalance,
      feePolicy.projectedEffectiveGasPrice,
      safetyBps,
    ),
  };

  console.log(JSON.stringify({
    mode: execute ? (resume ? "resume" : "execute") : "dry-run",
    network: network.name,
    chainId,
    deployer: deployerAddress,
    owner: ownerAddress,
    oldDistributor: A.oldDistributor,
    recipients: A,
    chapters,
    sourceCount: sources.size,
    maxFeeGwei: ethers.utils.formatUnits(feePolicy.overrides.maxFeePerGas, "gwei"),
    priorityFeeGwei: ethers.utils.formatUnits(feePolicy.overrides.maxPriorityFeePerGas, "gwei"),
    financialPlan,
  }, null, 2));

  if (!execute) {
    console.log("Preflight PASS. No transactions sent. Add --execute with the explicit confirmation only after review.");
    return;
  }
  if (!same(ownerSignerAddress, ownerAddress)) {
    throw new Error(`OWNER_PRIVATE_KEY signer ${ownerSignerAddress} does not match owner ${ownerAddress}`);
  }
  if (env("CONFIRM_DISTRIBUTOR_V2_MIGRATION") !== CONFIRMATION) {
    throw new Error(`Set CONFIRM_DISTRIBUTOR_V2_MIGRATION=${CONFIRMATION}`);
  }
  const insufficientRoles = Object.entries({
    deployer: financialPlan.deployer,
    owner: financialPlan.owner,
  }).filter(([, budget]) => !budget.sufficient);
  if (insufficientRoles.length) {
    const detail = insufficientRoles
      .map(([role, budget]) => `${role} requires ${budget.requiredPOL} POL, balance ${budget.balancePOL} POL`)
      .join("; ");
    throw new Error(`Distributor V2 financial gate failed: ${detail}`);
  }

  const distributorFactory = await ethers.getContractFactory("BiggiMultiCollectionDistributor", deployer);
  const readerFactory = await ethers.getContractFactory("BiggiMultiCollectionDistributorReaderV2", deployer);
  if (!resumeState) {
    resumeState = {
      schemaVersion: 1,
      chainId,
      owner: ownerAddress,
      deployer: deployerAddress,
      previousDistributor: A.oldDistributor,
      status: "initialized",
      transactions: [],
      updatedAt: new Date().toISOString(),
    };
    writeJson(resumeFile, resumeState);
  }
  if (Number(resumeState.chainId) !== 137 || !same(resumeState.owner, ownerAddress) ||
      !same(resumeState.previousDistributor, A.oldDistributor)) {
    throw new Error("Distributor V2 resume state mismatch");
  }

  function persist(status = resumeState.status) {
    resumeState.status = status;
    resumeState.updatedAt = new Date().toISOString();
    writeJson(resumeFile, resumeState);
  }

  async function resolvePending() {
    if (!resumeState.pending) return;
    const receipt = await ethers.provider.getTransactionReceipt(resumeState.pending.hash);
    if (!receipt) throw new Error(`Pending transaction ${resumeState.pending.hash} is not mined; resume later, do not resend`);
    if (receipt.status !== 1) throw new Error(`Pending transaction failed: ${resumeState.pending.hash}`);
    if (resumeState.pending.assign) {
      if (!receipt.contractAddress) throw new Error("Deployment receipt does not contain a contract address");
      resumeState[resumeState.pending.assign] = receipt.contractAddress;
    }
    resumeState.transactions.push({
      label: resumeState.pending.label,
      hash: resumeState.pending.hash,
      from: receipt.from,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });
    delete resumeState.pending;
    persist();
  }

  async function send(label, transactionFactory, assign = "") {
    if (resumeState.pending) await resolvePending();
    const currentFees = (await feeSnapshot()).overrides;
    const result = await transactionFactory(currentFees);
    const tx = result.deployTransaction || result;
    if (!tx?.hash || typeof tx.wait !== "function") throw new Error(`${label} did not return a transaction response`);
    resumeState.pending = { label, hash: tx.hash, assign };
    persist(`pending:${label}`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error(`${label} failed: ${tx.hash}`);
    await resolvePending();
    console.log(`${label}: ${tx.hash} (block ${receipt.blockNumber})`);
    return receipt;
  }
  await resolvePending();

  if (!resumeState.DISTRIBUTOR || !(await hasCode(resumeState.DISTRIBUTOR))) {
    await send("deploy BiggiMultiCollectionDistributor V2", (txFees) =>
      distributorFactory.deploy(ownerAddress, txFees), "DISTRIBUTOR");
  }
  const replacement = distributorFactory.attach(resumeState.DISTRIBUTOR);
  const replacementOwner = replacement.connect(ownerSigner);
  await requireOwner("replacement distributor", replacement, ownerAddress);
  console.log(`BiggiMultiCollectionDistributor V2: ${replacement.address}`);

  if (!same(await replacement.registry(), A.registry)) {
    await send("setRegistry", (txFees) => replacementOwner.setRegistry(A.registry, txFees));
  }
  if (!same(await replacement.collectionRewards(), A.collectionRewards)) {
    await send("setCollectionRewards", (txFees) => replacementOwner.setCollectionRewards(A.collectionRewards, txFees));
  }
  if (!same(await replacement.reserve(), A.reserve)) {
    await send("setReserve", (txFees) => replacementOwner.setReserve(A.reserve, txFees));
  }
  if (!same(await replacement.buybackAgent(), A.buyback)) {
    await send("setBuybackAgent", (txFees) => replacementOwner.setBuybackAgent(A.buyback, txFees));
  }
  if (!same(await replacement.treasury(), A.treasury)) {
    await send("setTreasury", (txFees) => replacementOwner.setTreasury(A.treasury, txFees));
  }
  if (!same(await replacement.communityCenter(), A.community)) {
    await send("setCommunityCenter", (txFees) => replacementOwner.setCommunityCenter(A.community, txFees));
  }
  for (const source of sources.values()) {
    if (!(await replacement.collections(source))) {
      await send(`addCollection(${source})`, (txFees) => replacementOwner.addCollection(source, txFees));
    }
  }

  if (!resumeState.MULTI_COLLECTION_READER || !(await hasCode(resumeState.MULTI_COLLECTION_READER))) {
    await send(
      "deploy BiggiMultiCollectionDistributorReaderV2",
      (txFees) => readerFactory.deploy(replacement.address, txFees),
      "MULTI_COLLECTION_READER",
    );
  }
  const reader = readerFactory.attach(resumeState.MULTI_COLLECTION_READER);
  console.log(`BiggiMultiCollectionDistributorReaderV2: ${reader.address}`);

  // All chapters are inactive. Rewire recipients first and TicketHub last so
  // no new mint can enter a partially configured route.
  for (const [label, contract] of Object.entries({ collectionRewards, reserve, buyback, treasury, community })) {
    if (!same(await contract.distributor(), replacement.address)) {
      await send(`${label}.setDistributor`, (txFees) =>
        contract.connect(ownerSigner).setDistributor(replacement.address, txFees));
    }
  }
  if (!same(await hub.distributor(), replacement.address)) {
    await send("TicketHub.setDistributor", (txFees) =>
      hub.connect(ownerSigner).setDistributor(replacement.address, txFees));
  }

  if (!(await replacement.distributorVersion()).eq(2)) throw new Error("Replacement distributor version mismatch");
  if (!(await replacement.supportsChapterMintShare())) throw new Error("Chapter-aware selector is disabled");
  if (!same(await reader.distributor(), replacement.address)) throw new Error("Reader binding mismatch");
  for (const chapter of chapters) {
    if (!same(await replacement.rewardCollectionForChapter(chapter.chapterId), chapter.vrfCollection)) {
      throw new Error(`Chapter ${chapter.chapterId} reward target mismatch`);
    }
  }
  if (!same(await hub.distributor(), replacement.address)) throw new Error("TicketHub cutover failed");

  resumeState.status = "complete";
  resumeState.completedAt = new Date().toISOString();
  persist("complete");
  writeJson(reportFile, {
    network: network.name,
    chainId,
    previousDistributor: A.oldDistributor,
    DISTRIBUTOR: replacement.address,
    MULTI_COLLECTION_READER: reader.address,
    owner: ownerAddress,
    chapters,
    transactions: resumeState.transactions,
    migratedAt: resumeState.completedAt,
  });
  console.log(`Migration report: ${reportFile}`);
  console.log("PASS: chapter-aware distributor cutover completed. Address books are intentionally not modified by this script.");
}

main().catch((error) => {
  console.error(safeErrorMessage(error));
  process.exitCode = 1;
});
