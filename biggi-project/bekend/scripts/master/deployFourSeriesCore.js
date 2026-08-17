// Deploys the current central TicketHub CORE topology for N one-chapter series.
//
// Default mode is dry-run/preflight. Execution uses separate deployer and
// owner wallets: deployer pays contract creation gas, owner performs wiring.
//
// Mainnet intent:
// - keep existing chapter-1 BiggiMain + BiggiMain2
// - deploy a new current-source central BiggiTicketHub
// - deploy a new current-source BiggiSeriesRegistry + BiggiChapterController
// - deploy chapters 2-N as new BiggiMain + BiggiMain2 pairs
// - wire all chapters to the central hub and chapter controller

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const TOTAL_TICKETS = 550;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name);
  if (!raw) return fallback;
  const lowered = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(lowered)) return true;
  if (["0", "false", "no", "off"].includes(lowered)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function envInt(name, fallback) {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return value;
}

function rangeFromOne(count) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function resolveFile(inputPath) {
  if (!inputPath) return "";
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonWithBackup(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const backup = `${filePath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(filePath, backup);
    console.log(`Backup written: ${backup}`);
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Address report written: ${filePath}`);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAddress(value) {
  try {
    return !!value && ethers.utils.getAddress(value) !== ZERO;
  } catch {
    return false;
  }
}

function normalizeAddress(value, fallback = ZERO) {
  if (!value) return fallback;
  if (!ethers.utils.isAddress(value)) throw new Error(`Invalid address: ${value}`);
  return ethers.utils.getAddress(value);
}

function same(a, b) {
  return isAddress(a) && isAddress(b) && ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

function maxBigNumber(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.gte(b) ? a : b;
}

function asNumber(value) {
  return ethers.BigNumber.isBigNumber(value) ? value.toNumber() : Number(value);
}

async function polygonFeeOverrides(provider) {
  if (network.name !== "polygon") return {};
  const minimumPriorityFee = ethers.utils.parseUnits(env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"), "gwei");
  const [feeData, latestBlock] = await Promise.all([provider.getFeeData(), provider.getBlock("latest")]);
  const priorityFee = maxBigNumber(feeData.maxPriorityFeePerGas, minimumPriorityFee);
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
  const safeMaxFee = baseFee.mul(2).add(priorityFee);
  const maxFee = maxBigNumber(feeData.maxFeePerGas || feeData.gasPrice, safeMaxFee);
  return { type: 2, maxPriorityFeePerGas: priorityFee, maxFeePerGas: maxFee };
}

class PolygonFeeWallet extends ethers.Wallet {
  async sendTransaction(transaction) {
    const request = { ...transaction, ...(await polygonFeeOverrides(this.provider)) };
    delete request.gasPrice;
    return super.sendTransaction(request);
  }
}

function parseArgs(argv) {
  const opts = {
    execute: env("DEPLOY_SERIES_CORE_EXECUTE")
      ? envBool("DEPLOY_SERIES_CORE_EXECUTE")
      : envBool("DEPLOY_FOUR_SERIES_EXECUTE", false),
    updateMaster: envBool("UPDATE_MASTER_ADDRESSES", false),
    mintMarketing: env("MINT_MARKETING_TICKETS")
      ? envBool("MINT_MARKETING_TICKETS")
      : envBool("MINT_FUTURE_MARKETING_TICKETS", false),
    preflightOnly: envBool("DEPLOY_SERIES_CORE_PREFLIGHT_ONLY", false),
    resume: envBool("DEPLOY_SERIES_CORE_RESUME", false),
    output: env("SERIES_CORE_OUTPUT_FILE", env("FOUR_SERIES_OUTPUT_FILE", "./addresses.core.polygon.json")),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") opts.execute = true;
    else if (arg === "--dry-run") opts.execute = false;
    else if (arg === "--preflight-only") opts.preflightOnly = true;
    else if (arg === "--resume") opts.resume = true;
    else if (arg === "--update-master") opts.updateMaster = true;
    else if (arg === "--mint-marketing") opts.mintMarketing = true;
    else if (arg === "--output") {
      const next = argv[i + 1];
      if (!next) throw new Error("--output requires a file path");
      opts.output = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node scripts/master/runDeploySeriesCorePolygon.js [--preflight-only] [--resume] [--execute] [--update-master] [--mint-marketing]

Default is dry-run. Required env/address-book inputs:
  MAIN, MAIN2, COMPUTE, VRF_ROUTER, BIGGI_NAMES_LIB, BIGGI_NAMES_LIB2

Recommended env:
  DEPLOYER_PRIVATE_KEY, OWNER_PRIVATE_KEY, DEV_WALLET, DISTRIBUTOR,
  BIGGI_TOKEN, TREASURY, RESERVE, COLLECTION_REWARDS,
  TOKEN_REWARDS, NFT_REWARDS, DRIP_DISTRIBUTOR, TICKET_BASE_URI,
  CHAPTER_COUNT, CHAPTER_N_TICKET_BASE_URI, SERIES_N_NAME
`);
}

async function hasCode(address) {
  if (!isAddress(address)) return false;
  return (await ethers.provider.getCode(address)) !== "0x";
}

async function requireCode(label, address) {
  if (!isAddress(address)) throw new Error(`${label} is missing`);
  if (!(await hasCode(address))) throw new Error(`${label} has no code at ${address} on ${network.name}`);
}

async function safeRead(label, fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`WARN ${label}: ${err.reason || err.message}`);
    return fallback;
  }
}

async function ownerOf(label, address) {
  if (!isAddress(address) || !(await hasCode(address))) return ZERO;
  const c = new ethers.Contract(address, ["function owner() view returns (address)"], ethers.provider);
  return safeRead(`${label}.owner`, () => c.owner(), ZERO);
}

async function assertSignerOwns(label, address, signerAddress) {
  const owner = await ownerOf(label, address);
  if (!same(owner, signerAddress)) {
    throw new Error(`${label} owner mismatch: owner=${owner}, signer=${signerAddress}`);
  }
}

function walletFromKey(primaryName, fallbackName = "") {
  const privateKey = env(primaryName) || (fallbackName ? env(fallbackName) : "");
  if (!privateKey) return null;
  try {
    return new PolygonFeeWallet(privateKey, ethers.provider);
  } catch {
    throw new Error(`${primaryName} is invalid`);
  }
}

async function maybeTx(opts, label, txFactory) {
  if (!opts.execute) {
    console.log(`PLAN ${label}`);
    return null;
  }
  const tx = await txFactory();
  console.log(`${label}: ${tx.hash}`);
  return tx.wait();
}

async function recoverDeployment(factory, predictedAddress, nonce, transactionHash) {
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const code = await ethers.provider.getCode(predictedAddress).catch(() => "0x");
    if (code !== "0x") return factory.attach(predictedAddress);

    if (transactionHash) {
      const receipt = await ethers.provider.getTransactionReceipt(transactionHash).catch(() => null);
      if (receipt && receipt.status === 0) {
        throw new Error(`Deployment transaction reverted: ${transactionHash}`);
      }
    }

    const [latestNonce, pendingNonce] = await Promise.all([
      ethers.provider.getTransactionCount(factory.signer.address, "latest"),
      ethers.provider.getTransactionCount(factory.signer.address, "pending"),
    ]);
    if (attempt >= 2 && latestNonce <= nonce && pendingNonce <= nonce) return null;
    await sleep(5000);
  }
  throw new Error(`Deployment status unresolved at predicted address ${predictedAddress}`);
}

async function deployWithFactory(opts, name, factory, args, signer) {
  if (!opts.execute) {
    console.log(`PLAN deploy ${name}`);
    return null;
  }
  const connectedFactory = factory.connect(signer);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const nonce = await signer.getTransactionCount("pending");
    const predictedAddress = ethers.utils.getContractAddress({ from: signer.address, nonce });
    let transactionHash = "";
    try {
      const contract = await connectedFactory.deploy(...args, { nonce });
      transactionHash = contract.deployTransaction.hash;
      await contract.deployTransaction.wait();
      console.log(`${name}: ${contract.address}`);
      return contract;
    } catch (error) {
      transactionHash = error.transactionHash || error.transaction?.hash || transactionHash;
      console.warn(`WARN ${name} deployment attempt ${attempt}: ${error.code || error.message}`);
      const recovered = await recoverDeployment(connectedFactory, predictedAddress, nonce, transactionHash);
      if (recovered) {
        console.log(`${name} recovered: ${predictedAddress}`);
        return recovered;
      }
    }
  }
  throw new Error(`Failed to deploy ${name} after 3 attempts`);
}

async function deploy(opts, name, args = [], signer, options = undefined) {
  const factory = await ethers.getContractFactory(name, options);
  return deployWithFactory(opts, name, factory, args, signer);
}

async function setAddressIfDifferent(opts, label, readFn, expected, txFn) {
  const current = await safeRead(`${label}.read`, readFn, ZERO);
  if (same(current, expected)) {
    console.log(`OK ${label}: ${expected}`);
    return;
  }
  await maybeTx(opts, `${label} -> ${expected}`, txFn);
}

async function setBoolIfDifferent(opts, label, readFn, expected, txFn) {
  const current = await safeRead(`${label}.read`, readFn, null);
  if (current === expected) {
    console.log(`OK ${label}: ${expected}`);
    return;
  }
  await maybeTx(opts, `${label} -> ${expected}`, txFn);
}

function pick(base, key, fallback = "") {
  return env(key, base[key] == null ? fallback : String(base[key]));
}

function pickAddress(base, keys, fallback = ZERO) {
  for (const key of keys) {
    const value = env(key, base[key] == null ? "" : String(base[key]));
    if (value) return normalizeAddress(value);
  }
  return fallback;
}

function chapterTicketBaseUri(chapterId, base) {
  const chapterSpecific =
    env(`CHAPTER_${chapterId}_TICKET_BASE_URI`) ||
    env(`SERIES_${chapterId}_TICKET_BASE_URI`);
  if (chapterSpecific) return chapterSpecific;
  if (chapterId !== 1) return "";
  return (
    env("TICKET_BASE_URI") ||
    pick(base, "TICKET_BASE_URI") ||
    env("MINT_TICKET") ||
    pick(base, "MINT_TICKET")
  );
}

function inspectChapterTicketBaseUris(base, chapterCount) {
  const entries = rangeFromOne(chapterCount).map((chapterId) => ({
    chapterId,
    uri: chapterTicketBaseUri(chapterId, base),
  }));
  const issues = [];
  const missing = entries.filter((entry) => !entry.uri).map((entry) => entry.chapterId);
  if (missing.length > 0) {
    issues.push(
      `Missing unique ticket metadata URI for chapter(s): ${missing.join(", ")}. ` +
      "Set CHAPTER_N_TICKET_BASE_URI; only chapter 1 may use TICKET_BASE_URI."
    );
  }
  for (const { chapterId, uri } of entries) {
    if (!uri) continue;
    if (!(uri.startsWith("ipfs://") || uri.startsWith("https://")) || !uri.endsWith("/")) {
      issues.push(`CHAPTER_${chapterId}_TICKET_BASE_URI must be an ipfs:// or https:// base URI ending in /`);
    }
  }
  const normalized = entries.filter((entry) => entry.uri).map((entry) => entry.uri.toLowerCase());
  if (new Set(normalized).size !== entries.length) {
    if (normalized.length === entries.length) {
      issues.push("Each chapter must use a different ticket metadata base URI.");
    }
  }
  return {
    uris: Object.fromEntries(entries.map((entry) => [entry.chapterId, entry.uri])),
    issues,
  };
}

function chapterSeriesName(chapterId) {
  return env(`SERIES_${chapterId}_NAME`, chapterId === 1 ? env("SERIES_NAME", "BIGGI Series 1") : `BIGGI Series ${chapterId}`);
}

async function preflight(
  opts,
  A,
  deployerAddress,
  ownerSignerAddress,
  chapterCount,
  ticketBaseUris,
  ticketMetadataIssues
) {
  console.log("Network:", network.name);
  const chain = await ethers.provider.getNetwork();
  console.log("Chain ID:", chain.chainId);
  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Refusing deploy: expected Polygon chainId 137, got ${chain.chainId}`);
  }

  for (const [label, address] of Object.entries({
    MAIN: A.MAIN,
    MAIN2: A.MAIN2,
    COMPUTE: A.COMPUTE,
    VRF_ROUTER: A.VRF_ROUTER,
    BIGGI_NAMES_LIB: A.BIGGI_NAMES_LIB,
    BIGGI_NAMES_LIB2: A.BIGGI_NAMES_LIB2,
  })) {
    await requireCode(label, address);
  }

  if (opts.execute || opts.preflightOnly) {
    if (!deployerAddress) {
      throw new Error("DEPLOYER_PRIVATE_KEY is missing; cannot deploy contracts.");
    }
    if (!ownerSignerAddress) {
      throw new Error("OWNER_PRIVATE_KEY is missing; cannot wire owner-controlled contracts.");
    }
    if (isAddress(A.DEPLOYER) && !same(A.DEPLOYER, deployerAddress)) {
      throw new Error(`Deployer mismatch: signer=${deployerAddress}, expected=${A.DEPLOYER}`);
    }
    if (isAddress(A.OWNER) && !same(A.OWNER, ownerSignerAddress)) {
      throw new Error(`Owner signer mismatch: signer=${ownerSignerAddress}, OWNER=${A.OWNER}`);
    }
    await assertSignerOwns("MAIN", A.MAIN, ownerSignerAddress);
    await assertSignerOwns("MAIN2", A.MAIN2, ownerSignerAddress);
    await assertSignerOwns("VRF_ROUTER", A.VRF_ROUTER, ownerSignerAddress);
    for (const [label, address] of Object.entries({
      DISTRIBUTOR: A.DISTRIBUTOR,
      TREASURY: A.TREASURY,
      RESERVE: A.RESERVE,
      COLLECTION_REWARDS: A.COLLECTION_REWARDS,
      TOKEN_REWARDS: A.TOKEN_REWARDS,
      NFT_REWARDS: A.NFT_REWARDS,
      DRIP_DISTRIBUTOR: A.DRIP_DISTRIBUTOR,
    })) {
      if (isAddress(address) && await hasCode(address)) {
        await assertSignerOwns(label, address, ownerSignerAddress);
      }
    }
  }

  console.log("Existing chapter 1 MAIN:", A.MAIN);
  console.log("Existing chapter 1 MAIN2:", A.MAIN2);
  console.log("Will deploy: BiggiTicketHub, BiggiSeriesRegistry, BiggiChapterController");
  console.log(`Will deploy: BiggiEyesMain + BiggiEyesMain2 for chapters 2-${chapterCount}`);
  console.log("Will deploy: BiggiMainReader + BiggiChapterSeriesReader");
  for (const chapterId of rangeFromOne(chapterCount)) {
    console.log(`Chapter ${chapterId} ticket metadata:`, ticketBaseUris[chapterId] || "MISSING");
  }
  for (const issue of ticketMetadataIssues) {
    console.warn("BLOCKER:", issue);
  }
  if ((opts.execute || opts.preflightOnly) && ticketMetadataIssues.length > 0) {
    throw new Error("Refusing deployment: chapter ticket metadata preflight failed.");
  }
  if (opts.mintMarketing) {
    console.log(`Will mint: 50 prelaunch marketing tickets for chapters 1-${chapterCount}`);
    console.log("Paid mint and redemption stay disabled until setChapterActive(chapterId, true)");
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  const outputFile = resolveFile(opts.output);
  const resumeFile = resolveFile(env("RESUME_CORE_ADDRESSES_FILE", "./addresses.core.resume.polygon.json"));
  const resumeState = opts.resume ? readJson(resumeFile, {}) : {};

  const addressesPath = resolveFile(env("MASTER_ADDRESSES_FILE", "./addresses.master.json"));
  const base = readJson(addressesPath, {});
  const A = {
    DEPLOYER: pickAddress(base, ["DEPLOYER", "deployer"]),
    OWNER: pickAddress(base, ["OWNER", "DEV_WALLET"]),
    DEV_WALLET: pickAddress(base, ["DEV_WALLET", "OWNER"]),
    MAIN: pickAddress(base, ["MAIN", "COLLECTION", "COLLECTION_VRF"]),
    MAIN2: pickAddress(base, ["MAIN2", "COLLECTION2", "COLLECTION_PUBLIC"]),
    COMPUTE: pickAddress(base, ["COMPUTE"]),
    VRF_ROUTER: pickAddress(base, ["VRF_ROUTER"]),
    BIGGI_NAMES_LIB: pickAddress(base, ["BIGGI_NAMES_LIB"]),
    BIGGI_NAMES_LIB2: pickAddress(base, ["BIGGI_NAMES_LIB2"]),
    DISTRIBUTOR: pickAddress(base, ["DISTRIBUTOR", "MULTI_COLLECTION_DISTRIBUTOR"]),
    BIGGI_TOKEN: pickAddress(base, ["BIGGI_TOKEN", "BIGGI"]),
    TREASURY: pickAddress(base, ["TREASURY"]),
    RESERVE: pickAddress(base, ["RESERVE", "RESERVE_ADDRESS"]),
    COLLECTION_REWARDS: pickAddress(base, ["COLLECTION_REWARDS"]),
    TOKEN_REWARDS: pickAddress(base, ["TOKEN_REWARDS"]),
    NFT_REWARDS: pickAddress(base, ["NFT_REWARDS", "BIGGI_NFT_REWARDS"]),
    DRIP_DISTRIBUTOR: pickAddress(base, ["DRIP_DISTRIBUTOR"]),
    TOKEN_SINK: pickAddress(base, ["TOKEN_SINK"], ZERO),
  };

  const saleCap = envInt("SALE_CAP", Number(base.SALE_CAP || 500));
  const marketingCap = envInt("MARKETING_CAP", Number(base.MARKETING_CAP || 50));
  const chapterCount = envInt("CHAPTER_COUNT", Number(base.CHAPTER_COUNT || 5));
  if (chapterCount < 1) {
    throw new Error("CHAPTER_COUNT must be at least 1");
  }
  if (saleCap + marketingCap !== TOTAL_TICKETS) {
    throw new Error(`SALE_CAP + MARKETING_CAP must equal ${TOTAL_TICKETS}`);
  }
  const ticketPrice = env("TICKET_PRICE");
  const priceIncreaseBps = envInt("PRICE_INCREASE_PER_MINT_BPS", Number(base.PRICE_INCREASE_PER_MINT_BPS || 10033));
  const biggiRate = env("BIGGI_RATE", base.BIGGI_RATE || "");
  const tokenSink = isAddress(A.TOKEN_SINK) ? A.TOKEN_SINK : A.TREASURY;
  const tokenSinkDepositMode = envBool("TOKEN_SINK_DEPOSIT_MODE", isAddress(A.TREASURY));
  const tokenSinkBps = envInt("TOKEN_SINK_BPS", 10_000);
  const recipient = pickAddress(base, ["MARKETING_TICKET_RECIPIENT", "MARKETING_SUPPORT", "OWNER", "DEV_WALLET"], A.OWNER);
  const ticketMetadata = inspectChapterTicketBaseUris(base, chapterCount);
  const ticketBaseUris = ticketMetadata.uris;

  const deployerSigner = walletFromKey("DEPLOYER_PRIVATE_KEY", "PRIVATE_KEY");
  const ownerSigner = walletFromKey("OWNER_PRIVATE_KEY");
  const deployerAddress = deployerSigner ? deployerSigner.address : "";
  const ownerSignerAddress = ownerSigner ? ownerSigner.address : "";
  console.log("Mode:", opts.execute ? "EXECUTE" : opts.preflightOnly ? "PREFLIGHT-ONLY" : "DRY-RUN");
  console.log("Expected deployer:", A.DEPLOYER);
  console.log("Expected owner:", A.OWNER);
  if (deployerAddress) {
    const balance = await ethers.provider.getBalance(deployerAddress);
    console.log("Deployer signer:", deployerAddress);
    console.log("Deployer balance POL:", ethers.utils.formatEther(balance));
  } else {
    console.log("Deployer signer: missing (DEPLOYER_PRIVATE_KEY not configured)");
  }
  if (ownerSignerAddress) {
    const balance = await ethers.provider.getBalance(ownerSignerAddress);
    console.log("Owner signer:", ownerSignerAddress);
    console.log("Owner balance POL:", ethers.utils.formatEther(balance));
  } else {
    console.log("Owner signer: missing (OWNER_PRIVATE_KEY not configured)");
  }
  const currentFees = await polygonFeeOverrides(ethers.provider);
  if (currentFees.maxFeePerGas) {
    console.log("Fee policy max fee gwei:", ethers.utils.formatUnits(currentFees.maxFeePerGas, "gwei"));
    console.log("Fee policy priority fee gwei:", ethers.utils.formatUnits(currentFees.maxPriorityFeePerGas, "gwei"));
  }

  await preflight(
    opts,
    A,
    deployerAddress,
    ownerSignerAddress,
    chapterCount,
    ticketBaseUris,
    ticketMetadata.issues
  );

  if (opts.resume) {
    for (const key of ["TICKET_HUB", "REGISTRY", "CHAPTER_CONTROLLER", "MAIN_READER", "CHAPTER_SERIES_READER"]) {
      await requireCode(`resume ${key}`, resumeState[key]);
    }
    if (opts.preflightOnly) {
      await assertSignerOwns("resume TicketHub", resumeState.TICKET_HUB, ownerSignerAddress);
      await assertSignerOwns("resume Registry", resumeState.REGISTRY, ownerSignerAddress);
      await assertSignerOwns("resume ChapterController", resumeState.CHAPTER_CONTROLLER, ownerSignerAddress);
    }
  }

  if (!opts.execute) {
    const dryRunReport = {
      network: network.name,
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      mode: opts.preflightOnly ? "preflight-only" : "dry-run",
      expectedDeployer: A.DEPLOYER,
      expectedOwner: A.OWNER,
      deployerSigner: deployerAddress || null,
      ownerSigner: ownerSignerAddress || null,
      existingChapter1: {
        MAIN: A.MAIN,
        MAIN2: A.MAIN2,
      },
      plannedDeployments: {
        centralTicketHub: !opts.resume,
        registry: !opts.resume,
        chapterController: !opts.resume,
        futureVrfCollections: chapterCount - 1,
        futurePublicCollections: chapterCount - 1,
        mainReader: !opts.resume,
        chapterSeriesReader: !opts.resume,
      },
      chapters: rangeFromOne(chapterCount).map((chapterId) => ({
        chapterId,
        seriesName: chapterSeriesName(chapterId),
        ticketBaseURI: ticketBaseUris[chapterId] || null,
        active: false,
      })),
      mintMarketing: opts.mintMarketing,
      blockers: ticketMetadata.issues,
      checkedAt: new Date().toISOString(),
    };
    writeJsonWithBackup(outputFile, dryRunReport);
    return;
  }

  const owner = ownerSignerAddress;
  const existingMain = await ethers.getContractAt("BiggiEyesMain", A.MAIN, ownerSigner);
  const existingMain2 = await ethers.getContractAt("BiggiEyesMain2", A.MAIN2, ownerSigner);
  const vrfRouter = await ethers.getContractAt("BiggiVRFRouter", A.VRF_ROUTER, ownerSigner);

  let ticketHub;
  let registry;
  let chapterController;
  let mainReader;
  let chapterSeriesReader;
  if (opts.resume) {
    for (const key of ["TICKET_HUB", "REGISTRY", "CHAPTER_CONTROLLER", "MAIN_READER", "CHAPTER_SERIES_READER"]) {
      await requireCode(`resume ${key}`, resumeState[key]);
    }
    ticketHub = (await ethers.getContractAt("BiggiTicketHub", resumeState.TICKET_HUB, ownerSigner));
    registry = (await ethers.getContractAt("BiggiSeriesRegistry", resumeState.REGISTRY, ownerSigner));
    chapterController = (await ethers.getContractAt("BiggiChapterController", resumeState.CHAPTER_CONTROLLER, ownerSigner));
    mainReader = await ethers.getContractAt("BiggiMainReader", resumeState.MAIN_READER, deployerSigner);
    chapterSeriesReader = await ethers.getContractAt("BiggiChapterSeriesReader", resumeState.CHAPTER_SERIES_READER, deployerSigner);
    await assertSignerOwns("resume TicketHub", ticketHub.address, owner);
    await assertSignerOwns("resume Registry", registry.address, owner);
    await assertSignerOwns("resume ChapterController", chapterController.address, owner);
    console.log("Resuming central CORE:", ticketHub.address, registry.address, chapterController.address);
  } else {
    ticketHub = (await deploy(opts, "BiggiTicketHub", [owner, A.MAIN], deployerSigner)).connect(ownerSigner);
    registry = (await deploy(opts, "BiggiSeriesRegistry", [owner], deployerSigner)).connect(ownerSigner);
    chapterController = (await deploy(
      opts,
      "BiggiChapterController",
      [owner, registry.address],
      deployerSigner
    )).connect(ownerSigner);
    mainReader = await deploy(
      opts,
      "BiggiMainReader",
      [A.MAIN, ticketHub.address, A.COLLECTION_REWARDS],
      deployerSigner
    );
    chapterSeriesReader = await deploy(opts, "BiggiChapterSeriesReader", [
      chapterController.address,
      registry.address,
    ], deployerSigner);
  }

  const resumeChapters = Array.isArray(resumeState.chapters) ? [...resumeState.chapters] : [];
  const saveResume = (status) => writeJson(resumeFile, {
    network: network.name,
    chainId: 137,
    status,
    OWNER: owner,
    TICKET_HUB: ticketHub.address,
    REGISTRY: registry.address,
    CHAPTER_CONTROLLER: chapterController.address,
    MAIN_READER: mainReader.address,
    CHAPTER_SERIES_READER: chapterSeriesReader.address,
    CHAPTER_COUNT: chapterCount,
    chapters: resumeChapters,
    updatedAt: new Date().toISOString(),
  });
  saveResume("central-core-ready");

  if (!opts.resume) {
    await maybeTx(opts, "TicketHub.setDevWallet", () => ticketHub.setDevWallet(A.DEV_WALLET));
    await maybeTx(opts, "TicketHub.setTicketCaps chapter1", () => ticketHub.setTicketCaps(saleCap, marketingCap));
    const chapter1TicketBase = ticketBaseUris[1];
    if (chapter1TicketBase) {
      await maybeTx(opts, "TicketHub.setTicketBaseURI chapter1", () => ticketHub.setTicketBaseURI(chapter1TicketBase));
    }
    await maybeTx(opts, "TicketHub.setPriceIncreasePerMint", () => ticketHub.setPriceIncreasePerMint(priceIncreaseBps));
    if (ticketPrice) {
      await maybeTx(opts, "TicketHub.setTicketPrice", () => ticketHub.setTicketPrice(ethers.utils.parseEther(ticketPrice)));
    }
    if (isAddress(A.DISTRIBUTOR)) {
      await maybeTx(opts, "TicketHub.setDistributor", () => ticketHub.setDistributor(A.DISTRIBUTOR));
    }
    if (isAddress(A.BIGGI_TOKEN)) {
      await maybeTx(opts, "TicketHub.setBiggiToken", () => ticketHub.setBiggiToken(A.BIGGI_TOKEN));
    }
    if (biggiRate) {
      await maybeTx(opts, "TicketHub.setBiggiRate", () => ticketHub.setBiggiRate(ethers.BigNumber.from(biggiRate)));
    }
    if (isAddress(tokenSink)) {
      await maybeTx(opts, "TicketHub.setTokenSink", () => ticketHub.setTokenSink(tokenSink, tokenSinkBps));
      await maybeTx(opts, "TicketHub.setTokenSinkDepositMode", () => ticketHub.setTokenSinkDepositMode(tokenSinkDepositMode));
    }
    if (isAddress(A.RESERVE)) {
      await maybeTx(opts, "TicketHub.setReserveAddress", () => ticketHub.setReserveAddress(A.RESERVE));
    }
    for (let chapterId = 1; chapterId <= chapterCount; chapterId += 1) {
      await maybeTx(opts, `Registry.createSeries ${chapterId}`, () => registry.createSeries(chapterSeriesName(chapterId)));
      await maybeTx(opts, `Registry.createChapter ${chapterId}`, () => registry.createChapter(chapterId));
    }
  } else {
    const [seriesCountOnChain, chapterCountOnChain] = await Promise.all([registry.seriesCount(), registry.chapterCount()]);
    if (!seriesCountOnChain.eq(chapterCount) || !chapterCountOnChain.eq(chapterCount)) {
      throw new Error(`Resume Registry count mismatch: series=${seriesCountOnChain}, chapters=${chapterCountOnChain}, expected=${chapterCount}`);
    }
  }

  const chapters = [];

  const mainFactory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: { BiggiNamesLib: A.BIGGI_NAMES_LIB },
  });
  const main2Factory = await ethers.getContractFactory("BiggiEyesMain2", {
    libraries: { BiggiNamesLib2: A.BIGGI_NAMES_LIB2 },
  });

  chapters.push({ chapterId: 1, seriesId: 1, main: existingMain, main2: existingMain2 });

  for (let chapterId = 2; chapterId <= chapterCount; chapterId += 1) {
    let resumeChapter = resumeChapters.find((item) => Number(item.chapterId) === chapterId);
    if (!resumeChapter) {
      resumeChapter = { chapterId, seriesId: chapterId };
      resumeChapters.push(resumeChapter);
    }

    let mainDeployment;
    if (isAddress(resumeChapter.MAIN) && await hasCode(resumeChapter.MAIN)) {
      mainDeployment = mainFactory.attach(resumeChapter.MAIN).connect(deployerSigner);
      console.log(`Chapter ${chapterId} BiggiEyesMain resumed: ${mainDeployment.address}`);
    } else {
      mainDeployment = await deployWithFactory(opts, `Chapter ${chapterId} BiggiEyesMain`, mainFactory, [owner], deployerSigner);
      resumeChapter.MAIN = mainDeployment.address;
      saveResume(`chapter-${chapterId}-vrf-deployed`);
    }
    const mainCollection = mainDeployment.connect(ownerSigner);

    let publicDeployment;
    if (isAddress(resumeChapter.MAIN2) && await hasCode(resumeChapter.MAIN2)) {
      publicDeployment = main2Factory.attach(resumeChapter.MAIN2).connect(deployerSigner);
      console.log(`Chapter ${chapterId} BiggiEyesMain2 resumed: ${publicDeployment.address}`);
    } else {
      publicDeployment = await deployWithFactory(opts, `Chapter ${chapterId} BiggiEyesMain2`, main2Factory, [owner], deployerSigner);
      resumeChapter.MAIN2 = publicDeployment.address;
      saveResume(`chapter-${chapterId}-pair-deployed`);
    }
    const publicCollection = publicDeployment.connect(ownerSigner);

    if (resumeChapter.configured) {
      const [configuredChapterId, configuredHub, configuredMain, configuredProvider] = await Promise.all([
        mainCollection.chapterId(),
        mainCollection.ticketHub(),
        ticketHub.chapterMainCollection(chapterId),
        publicCollection.priceProvider(),
      ]);
      if (!configuredChapterId.eq(chapterId) ||
          !same(configuredHub, ticketHub.address) ||
          !same(configuredMain, mainCollection.address) ||
          !same(configuredProvider, mainCollection.address)) {
        throw new Error(`Resume chapter ${chapterId} configuration mismatch`);
      }
      console.log(`Chapter ${chapterId} pair configuration resumed and verified`);
    } else {
      await maybeTx(opts, `Main chapter ${chapterId}.setChapterId`, () => mainCollection.setChapterId(chapterId));
      await maybeTx(opts, `Main chapter ${chapterId}.setModules`, () => mainCollection.setModules(A.COMPUTE, A.VRF_ROUTER));
      await maybeTx(opts, `TicketHub.configureChapter ${chapterId}`, () =>
        ticketHub.configureChapter(chapterId, mainCollection.address, saleCap, marketingCap, ticketBaseUris[chapterId])
      );
      await maybeTx(opts, `Main chapter ${chapterId}.setTicketHub`, () => mainCollection.setTicketHub(ticketHub.address));
      await maybeTx(opts, `VRFRouter.setMainApproval chapter ${chapterId}`, () =>
        vrfRouter.setMainApproval(mainCollection.address, true)
      );

      await maybeTx(opts, `Main2 chapter ${chapterId}.setDevWallet`, () => publicCollection.setDevWallet(A.DEV_WALLET));
      await maybeTx(opts, `Main2 chapter ${chapterId}.setPriceProvider`, () =>
        publicCollection.setPriceProvider(mainCollection.address)
      );
      if (isAddress(A.DISTRIBUTOR)) {
        await maybeTx(opts, `Main2 chapter ${chapterId}.setDistributor`, () => publicCollection.setDistributor(A.DISTRIBUTOR));
      }
      if (isAddress(A.BIGGI_TOKEN)) {
        await maybeTx(opts, `Main2 chapter ${chapterId}.setBiggiToken`, () => publicCollection.setBiggiToken(A.BIGGI_TOKEN));
      }
      if (biggiRate) {
        await maybeTx(opts, `Main2 chapter ${chapterId}.setBiggiRate`, () =>
          publicCollection.setBiggiRate(ethers.BigNumber.from(biggiRate))
        );
      }
      if (isAddress(tokenSink)) {
        await maybeTx(opts, `Main2 chapter ${chapterId}.setTokenSink`, () =>
          publicCollection.setTokenSink(tokenSink, tokenSinkBps)
        );
        await maybeTx(opts, `Main2 chapter ${chapterId}.setTokenSinkDepositMode`, () =>
          publicCollection.setTokenSinkDepositMode(tokenSinkDepositMode)
        );
      }
      if (isAddress(A.RESERVE)) {
        await maybeTx(opts, `Main2 chapter ${chapterId}.setReserveAddress`, () =>
          publicCollection.setReserveAddress(A.RESERVE)
        );
      }
      resumeChapter.configured = true;
      saveResume(`chapter-${chapterId}-pair-configured`);
    }

    chapters.push({ chapterId, seriesId: chapterId, main: mainCollection, main2: publicCollection });
  }

  await setAddressIfDifferent(
    opts,
    "MAIN.ticketHub",
    () => existingMain.ticketHub(),
    ticketHub.address,
    () => existingMain.setTicketHub(ticketHub.address)
  );

  for (const ch of chapters) {
    const currentCollections = await registry.getChapterCollections(ch.chapterId);
    if (same(currentCollections[0], ch.main.address) &&
        same(currentCollections[1], ch.main2.address) &&
        same(currentCollections[2], ticketHub.address)) {
      console.log(`OK Registry chapter collections ${ch.chapterId}`);
    } else {
      await maybeTx(opts, `Registry.setChapterCollections ${ch.chapterId}`, () =>
        registry.setChapterCollections(ch.chapterId, ch.main.address, ch.main2.address, ticketHub.address)
      );
    }
    const eligibility = await registry.chapterInfo(ch.chapterId);
    if (eligibility[6] && eligibility[7] && eligibility[8]) {
      console.log(`OK Registry rewards eligibility chapter ${ch.chapterId}: VRF token + Public token + VRF collection`);
    } else {
      await maybeTx(opts, `Registry.setRewardsEligibility ${ch.chapterId}`, () =>
        registry.setRewardsEligibility(ch.chapterId, true, true, true)
      );
    }
    const controllerConfig = await chapterController.chapterConfig(ch.chapterId);
    const controllerReady = controllerConfig[0] &&
      asNumber(controllerConfig[1]) === saleCap &&
      asNumber(controllerConfig[2]) === marketingCap &&
      asNumber(controllerConfig[3]) === TOTAL_TICKETS &&
      await chapterController.isChapterStackConsistent(ch.chapterId) &&
      await chapterController.isChapterCapConsistent(ch.chapterId);
    if (controllerReady) {
      console.log(`OK ChapterController chapter ${ch.chapterId}`);
    } else {
      await maybeTx(opts, `ChapterController.configureChapter ${ch.chapterId}`, () =>
        chapterController.configureChapter(
          ch.chapterId,
          ch.seriesId,
          ch.main.address,
          ch.main2.address,
          ticketHub.address,
          saleCap,
          marketingCap,
          TOTAL_TICKETS
        )
      );
    }
    const [currentController, currentChapterId] = await Promise.all([
      ch.main2.chapterController(),
      ch.main2.chapterId(),
    ]);
    if (same(currentController, chapterController.address) && asNumber(currentChapterId) === ch.chapterId) {
      console.log(`OK Main2 chapter controller ${ch.chapterId}`);
    } else {
      await maybeTx(opts, `Main2 chapter ${ch.chapterId}.setChapterController`, () =>
        ch.main2.setChapterController(chapterController.address, ch.chapterId)
      );
    }
  }

  await setAddressIfDifferent(
    opts,
    "MAIN2 chapter1.priceProvider",
    () => existingMain2.priceProvider(),
    A.MAIN,
    () => existingMain2.setPriceProvider(A.MAIN)
  );

  writeJsonWithBackup(outputFile, {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    status: "core-deployed-and-internally-wired",
    deployer: deployerAddress,
    OWNER: owner,
    TICKET_HUB: ticketHub.address,
    REGISTRY: registry.address,
    CHAPTER_CONTROLLER: chapterController.address,
    MAIN_READER: mainReader.address,
    CHAPTER_SERIES_READER: chapterSeriesReader.address,
    CHAPTER_COUNT: chapterCount,
    chapters: chapters.map((ch) => ({
      chapterId: ch.chapterId,
      seriesId: ch.seriesId,
      seriesName: chapterSeriesName(ch.chapterId),
      MAIN: ch.main.address,
      MAIN2: ch.main2.address,
      ticketBaseURI: ticketBaseUris[ch.chapterId],
      active: false,
    })),
    checkpointedAt: new Date().toISOString(),
  });

  if (isAddress(A.DISTRIBUTOR)) {
    const distributor = await ethers.getContractAt("BiggiMultiCollectionDistributor", A.DISTRIBUTOR, ownerSigner);
    await setAddressIfDifferent(
      opts,
      "Distributor.registry",
      () => distributor.registry(),
      registry.address,
      () => distributor.setRegistry(registry.address)
    );
    for (const address of [ticketHub.address, ...chapters.map((ch) => ch.main2.address)]) {
      await setBoolIfDifferent(
        opts,
        `Distributor.collections ${address}`,
        () => distributor.collections(address),
        true,
        () => distributor.addCollection(address)
      );
    }
  }

  if (isAddress(A.TREASURY)) {
    const treasury = await ethers.getContractAt("BiggiTreasury", A.TREASURY, ownerSigner);
    for (const address of [ticketHub.address, ...chapters.map((ch) => ch.main2.address)]) {
      await setBoolIfDifferent(
        opts,
        `Treasury.ecosystemBiggiCallers ${address}`,
        () => treasury.ecosystemBiggiCallers(address),
        true,
        () => treasury.setEcosystemBiggiCaller(address, true)
      );
    }
  }

  if (isAddress(A.RESERVE)) {
    const reserve = await ethers.getContractAt("BiggiReserveV4", A.RESERVE, ownerSigner);
    for (const address of [ticketHub.address, ...chapters.map((ch) => ch.main2.address)]) {
      await setBoolIfDifferent(
        opts,
        `Reserve.notifyCallers ${address}`,
        () => reserve.notifyCallers(address),
        true,
        () => reserve.setNotifyCaller(address, true)
      );
    }
  }

  if (isAddress(A.COLLECTION_REWARDS)) {
    const collectionRewards = await ethers.getContractAt("BiggiCollectionRewards", A.COLLECTION_REWARDS, ownerSigner);
    await setAddressIfDifferent(
      opts,
      "CollectionRewards.registry",
      () => collectionRewards.registry(),
      registry.address,
      () => collectionRewards.setRegistry(registry.address)
    );
  }

  if (isAddress(A.TOKEN_REWARDS)) {
    const tokenRewards = await ethers.getContractAt("BiggiTokenRewards", A.TOKEN_REWARDS, ownerSigner);
    await setAddressIfDifferent(
      opts,
      "TokenRewards.registry",
      () => tokenRewards.registry(),
      registry.address,
      () => tokenRewards.setRegistry(registry.address)
    );
    if (isAddress(A.TREASURY)) {
      await setAddressIfDifferent(
        opts,
        "TokenRewards.treasure",
        () => tokenRewards.treasure(),
        A.TREASURY,
        () => tokenRewards.setTreasure(A.TREASURY)
      );
    }
  }

  if (isAddress(A.NFT_REWARDS)) {
    const nftRewards = await ethers.getContractAt("BiggiNFTRewards", A.NFT_REWARDS, ownerSigner);
    await setAddressIfDifferent(
      opts,
      "NFTRewards.registry",
      () => nftRewards.registry(),
      registry.address,
      () => nftRewards.setRegistry(registry.address)
    );
    for (const address of chapters.flatMap((ch) => [ch.main.address, ch.main2.address])) {
      await setBoolIfDifferent(
        opts,
        `NFTRewards.allowedMainCollections ${address}`,
        () => nftRewards.allowedMainCollections(address),
        true,
        () => nftRewards.setAllowedMainCollection(address, true)
      );
    }
  }

  if (isAddress(A.DRIP_DISTRIBUTOR)) {
    const drip = await ethers.getContractAt("BiggiDripDistributor", A.DRIP_DISTRIBUTOR, ownerSigner);
    for (const address of chapters.flatMap((ch) => [ch.main.address, ch.main2.address])) {
      await setBoolIfDifferent(
        opts,
        `DripDistributor.collections ${address}`,
        () => drip.collections(address),
        true,
        () => drip.setCollection(address, true)
      );
    }
  }

  if (opts.mintMarketing) {
    for (const chapterId of rangeFromOne(chapterCount)) {
      const alreadyMintedRaw = await ticketHub.chapterMarketingMinted(chapterId);
      const alreadyMinted = asNumber(alreadyMintedRaw);
      const remaining = marketingCap - alreadyMinted;
      if (remaining < 0) throw new Error(`Chapter ${chapterId} marketing mint exceeds cap`);
      if (remaining === 0) {
        console.log(`OK TicketHub chapter ${chapterId} marketing tickets: ${marketingCap}`);
      } else {
        await maybeTx(opts, `TicketHub.mintMarketingTicketsForChapter ${chapterId} x${remaining}`, () =>
          ticketHub.mintMarketingTicketsForChapter(chapterId, recipient, remaining)
        );
      }
    }
  }

  const output = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployerAddress,
    OWNER: owner,
    DEV_WALLET: A.DEV_WALLET,
    OLD_TICKET_HUB: pickAddress(base, ["TICKET_HUB"]),
    TICKET_HUB: ticketHub.address,
    REGISTRY: registry.address,
    CHAPTER_CONTROLLER: chapterController.address,
    MAIN_READER: mainReader.address,
    CHAPTER_SERIES_READER: chapterSeriesReader.address,
    COMPUTE: A.COMPUTE,
    VRF_ROUTER: A.VRF_ROUTER,
    BIGGI_NAMES_LIB: A.BIGGI_NAMES_LIB,
    BIGGI_NAMES_LIB2: A.BIGGI_NAMES_LIB2,
    DISTRIBUTOR: A.DISTRIBUTOR,
    BIGGI_TOKEN: A.BIGGI_TOKEN,
    TREASURY: A.TREASURY,
    RESERVE: A.RESERVE,
    SALE_CAP: saleCap,
    MARKETING_CAP: marketingCap,
    chapters: chapters.map((ch) => ({
      chapterId: ch.chapterId,
      seriesId: ch.seriesId,
      seriesName: chapterSeriesName(ch.chapterId),
      MAIN: ch.main.address,
      MAIN2: ch.main2.address,
      ticketBaseURI: ticketBaseUris[ch.chapterId],
      active: false,
    })),
    MAIN: A.MAIN,
    MAIN2: A.MAIN2,
    CHAPTER_ID: 1,
    SERIES_ID: 1,
    CHAPTER_COUNT: chapterCount,
    marketingTicketsMintedPerChapter: opts.mintMarketing ? marketingCap : 0,
    createdAt: new Date().toISOString(),
  };

  writeJsonWithBackup(outputFile, output);
  saveResume("complete");

  if (opts.updateMaster) {
    const masterNext = {
      ...base,
      ...output,
      CORE_ADDRESS_FILE: path.relative(process.cwd(), outputFile),
      updatedAt: new Date().toISOString(),
    };
    writeJsonWithBackup(addressesPath, masterNext);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
