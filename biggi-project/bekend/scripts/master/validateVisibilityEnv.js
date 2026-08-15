const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const ZERO = ethers.constants.AddressZero;
const TOTAL_TICKETS = 550;

function parseArgs(argv) {
  const opts = {
    network: process.env.DEPLOY_NETWORK || "polygon",
    strict: false,
    envFile: path.resolve(__dirname, "../../.env"),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") {
      const next = argv[i + 1];
      if (!next) throw new Error("--network requires value");
      opts.network = next;
      i++;
    } else if (a === "--strict") {
      opts.strict = true;
    } else if (a === "--env") {
      const next = argv[i + 1];
      if (!next) throw new Error("--env requires path");
      opts.envFile = path.resolve(process.cwd(), next);
      i++;
    }
  }

  const normalized = String(opts.network || "").trim().toLowerCase();
  if (normalized !== "polygon") {
    throw new Error(`Unsupported network: ${opts.network}`);
  }
  opts.network = normalized;
  return opts;
}

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function isAddress(value) {
  try {
    return !!value && ethers.utils.getAddress(value) !== ZERO;
  } catch {
    return false;
  }
}

function isAddressOrZero(value) {
  try {
    return !!value && ethers.utils.isAddress(value);
  } catch {
    return false;
  }
}

function isHexPrivateKey(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value || ""));
}

function parseIntStrict(name, raw, fallback, errors) {
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${name} must be a non-negative integer (got: ${raw})`);
    return fallback;
  }
  return value;
}

function parseBoolStrict(name, raw, fallback, errors) {
  if (raw == null || raw === "") return fallback;
  const value = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  errors.push(`${name} must be boolean-like (got: ${raw})`);
  return fallback;
}

function resolveFile(inputPath) {
  if (!inputPath) return "";
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

function printList(title, values) {
  if (!values.length) return;
  console.log(`\n${title}`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

function validateMetadataFile(filePath, label, errors, warnings) {
  if (!filePath) {
    warnings.push(`${label} is not set.`);
    return 0;
  }

  const resolved = resolveFile(filePath);
  if (!fs.existsSync(resolved)) {
    errors.push(`${label} file not found: ${resolved}`);
    return 0;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (err) {
    errors.push(`${label} is not valid JSON: ${err.message}`);
    return 0;
  }

  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
  if (!Array.isArray(list)) {
    errors.push(`${label} must be a JSON array or { items: [] }`);
    return 0;
  }

  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    const idx = Number(item.idx ?? item.index ?? item.nftIndex ?? item.id ?? item.tokenIndex);
    const background = Number(
      item.background ?? item.bg ?? item.backgroundCode ?? item.bgCode ?? item.bgIdx
    );
    const blockIdx = Number(item.blockIdx ?? item.block ?? item.blockIndex);
    const mainId = Number(item.mainId ?? item.mainID ?? item.main ?? item.main_id);

    if (!Number.isInteger(idx) || idx < 1 || idx > TOTAL_TICKETS) {
      errors.push(`${label}[${i}] has invalid idx`);
    } else if (seen.has(idx)) {
      errors.push(`${label}[${i}] duplicates idx ${idx}`);
    } else {
      seen.add(idx);
    }
    if (!Number.isInteger(background) || background < 1 || background > 10) {
      errors.push(`${label}[${i}] has invalid background`);
    }
    if (!Number.isInteger(blockIdx) || blockIdx < 1 || blockIdx > 10) {
      errors.push(`${label}[${i}] has invalid blockIdx`);
    }
    if (!Number.isInteger(mainId) || mainId < 1) {
      errors.push(`${label}[${i}] has invalid mainId`);
    }
  }

  return list.length;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (fs.existsSync(opts.envFile)) {
    dotenv.config({ path: opts.envFile });
    console.log(`Loaded env: ${opts.envFile}`);
  } else {
    console.log(`Env file not found, using process env only: ${opts.envFile}`);
  }

  const errors = [];
  const warnings = [];
  const infos = [];

  if (!isHexPrivateKey(env("PRIVATE_KEY"))) {
    errors.push("PRIVATE_KEY is missing or invalid.");
  }

  const rpcKey = "POLYGON_RPC_URL";
  if (!env(rpcKey)) {
    errors.push(`${rpcKey} is missing.`);
  }

  const saleCap = parseIntStrict("SALE_CAP", env("SALE_CAP"), 500, errors);
  const marketingCap = parseIntStrict("MARKETING_CAP", env("MARKETING_CAP"), 50, errors);
  if (saleCap + marketingCap !== TOTAL_TICKETS) {
    errors.push(`SALE_CAP + MARKETING_CAP must equal ${TOTAL_TICKETS}.`);
  }
  if (saleCap > 0 && !isAddress(env("DISTRIBUTOR"))) {
    errors.push("DISTRIBUTOR is required when SALE_CAP > 0, otherwise 60% of paid mint revenue stays stranded in TicketHub.");
  }

  if (!isAddress(env("DEV_WALLET"))) {
    warnings.push("DEV_WALLET is not set; deploy script will fall back to deployer.");
  }

  const biggiToken = env("BIGGI_TOKEN");
  const reserveAddress = env("RESERVE_ADDRESS");
  const tokenSink = env("TOKEN_SINK");
  const nftRewards = env("NFT_REWARDS");
  const tokenSinkBps = env("TOKEN_SINK_BPS");
  const tokenSinkDepositMode = parseBoolStrict("TOKEN_SINK_DEPOSIT_MODE", env("TOKEN_SINK_DEPOSIT_MODE"), false, errors);
  const biggiRate = env("BIGGI_RATE");

  if (biggiToken && !isAddressOrZero(biggiToken)) {
    errors.push("BIGGI_TOKEN is invalid.");
  }
  if (reserveAddress && !isAddressOrZero(reserveAddress)) {
    errors.push("RESERVE_ADDRESS is invalid.");
  }
  if (tokenSink && !isAddressOrZero(tokenSink)) {
    errors.push("TOKEN_SINK is invalid.");
  }
  if (nftRewards && !isAddressOrZero(nftRewards)) {
    errors.push("NFT_REWARDS is invalid.");
  }
  const parsedSinkBps = parseIntStrict("TOKEN_SINK_BPS", tokenSinkBps, 10_000, errors);
  if (parsedSinkBps > 10_000) {
    errors.push("TOKEN_SINK_BPS must be <= 10000.");
  }
  if (tokenSinkDepositMode && !tokenSink) {
    errors.push("TOKEN_SINK_DEPOSIT_MODE requires TOKEN_SINK.");
  }
  if (tokenSinkDepositMode) {
    warnings.push("TOKEN_SINK_DEPOSIT_MODE requires TOKEN_SINK to implement receiveEcosystemBiggi(uint256) and allowlist the deployed caller.");
  }
  if (biggiRate && !/^\d+$/.test(biggiRate)) {
    errors.push("BIGGI_RATE must be an integer string in token wei per 1 native coin.");
  }
  if (biggiToken && !reserveAddress) {
    warnings.push("BIGGI_TOKEN is set but RESERVE_ADDRESS is missing; mintTicketWithBiggi() would revert.");
  }

  const existingVrfRouter = env("VRF_ROUTER");
  const hasExistingVrf = isAddress(existingVrfRouter);
  const hasNewVrf =
    isAddress(env("VRF_COORDINATOR")) &&
    /^0x[0-9a-fA-F]{64}$/.test(env("VRF_KEY_HASH")) &&
    /^\d+$/.test(env("VRF_SUB_ID"));

  if (!hasExistingVrf && !hasNewVrf) {
    errors.push(
      "Set either existing VRF_ROUTER or full VRF_COORDINATOR + VRF_KEY_HASH + VRF_SUB_ID."
    );
  }

  const retryDelay = parseIntStrict("PENDING_RETRY_DELAY_SEC", env("PENDING_RETRY_DELAY_SEC"), 900, errors);
  if (retryDelay === 0) {
    errors.push("PENDING_RETRY_DELAY_SEC must be greater than 0.");
  }

  const ticketPrice = env("TICKET_PRICE");
  if (ticketPrice) {
    try {
      ethers.utils.parseEther(ticketPrice);
    } catch {
      errors.push(`TICKET_PRICE must be parseable as ether value (got: ${ticketPrice})`);
    }
  }

  parseIntStrict("PRICE_INCREASE_PER_MINT_BPS", env("PRICE_INCREASE_PER_MINT_BPS"), 10033, errors);

  const mainMetadataCount = validateMetadataFile(
    env("MAIN_METADATA_FILE"),
    "MAIN_METADATA_FILE",
    errors,
    warnings
  );
  if (mainMetadataCount === 0) {
    warnings.push("MAIN metadata is missing; VRF redeem will not work until metadata is seeded.");
  }

  const ticketBaseUri = env("TICKET_BASE_URI");
  if (!ticketBaseUri) {
    warnings.push("TICKET_BASE_URI is not set.");
  }

  const missingMainBlockUris = [];
  for (let i = 1; i <= 10; i++) {
    if (!env(`MAIN_BLOCK_URI_${i}`)) missingMainBlockUris.push(i);
  }
  if (missingMainBlockUris.length) {
    warnings.push(`Missing MAIN_BLOCK_URI_* for blocks: ${missingMainBlockUris.join(", ")}`);
  }
  if (!env("MAIN_REWARDS_BASE_URI")) {
    warnings.push("MAIN_REWARDS_BASE_URI is not set.");
  }
  if (!env("MAIN_CHARACTERS_BASE_URI")) {
    warnings.push("MAIN_CHARACTERS_BASE_URI is not set.");
  }

  const deployPublicBranch = parseBoolStrict(
    "DEPLOY_PUBLIC_BRANCH",
    env("DEPLOY_PUBLIC_BRANCH"),
    false,
    errors
  );
  parseBoolStrict("DEPLOY_COLLECTION_REWARDS", env("DEPLOY_COLLECTION_REWARDS"), true, errors);
  const deployNftRewards = parseBoolStrict("DEPLOY_NFT_REWARDS", env("DEPLOY_NFT_REWARDS"), true, errors);
  const deployCoreReaders = parseBoolStrict("DEPLOY_CORE_READERS", env("DEPLOY_CORE_READERS"), true, errors);
  parseBoolStrict("DEPLOY_MAIN_READER", env("DEPLOY_MAIN_READER"), deployCoreReaders, errors);
  const deployChapterSeriesReader = parseBoolStrict(
    "DEPLOY_CHAPTER_SERIES_READER",
    env("DEPLOY_CHAPTER_SERIES_READER"),
    deployCoreReaders && deployPublicBranch,
    errors
  );
  const deployMultiCollectionReader = parseBoolStrict(
    "DEPLOY_MULTI_COLLECTION_READER",
    env("DEPLOY_MULTI_COLLECTION_READER"),
    false,
    errors
  );
  const deployNftRewardsReader = parseBoolStrict(
    "DEPLOY_NFT_REWARDS_READER",
    env("DEPLOY_NFT_REWARDS_READER"),
    false,
    errors
  );
  if (deployPublicBranch) {
    infos.push("Public branch deploy is enabled.");
    const publicMetadataCount = validateMetadataFile(
      env("PUBLIC_METADATA_FILE"),
      "PUBLIC_METADATA_FILE",
      errors,
      warnings
    );
    if (publicMetadataCount === 0) {
      warnings.push("PUBLIC metadata is missing; Main2 public collection will have no seeded NFT layout.");
    }
  }
  if (deployChapterSeriesReader && !deployPublicBranch) {
    warnings.push("DEPLOY_CHAPTER_SERIES_READER requires DEPLOY_PUBLIC_BRANCH=1.");
  }
  if (deployMultiCollectionReader && !isAddress(env("DISTRIBUTOR"))) {
    warnings.push("DEPLOY_MULTI_COLLECTION_READER requires DISTRIBUTOR.");
  }
  if (deployNftRewardsReader && !deployNftRewards && !isAddress(env("NFT_REWARDS"))) {
    warnings.push("DEPLOY_NFT_REWARDS_READER requires NFT_REWARDS when DEPLOY_NFT_REWARDS=0.");
  }

  printList("INFO", infos);
  printList("WARNINGS", warnings);
  printList("ERRORS", errors);

  if (errors.length) {
    console.error(`\nVisibility env validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  if (opts.strict && warnings.length) {
    console.error(`\nStrict mode: treating ${warnings.length} warning(s) as failure.`);
    process.exit(1);
  }

  console.log("\nVisibility env validation: OK");
}

main();
