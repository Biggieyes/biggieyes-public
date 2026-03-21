const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const ZERO = ethers.constants.AddressZero;

function parseArgs(argv) {
  const opts = {
    network: process.env.DEPLOY_NETWORK || "polygon",
    strict: false,
    envFile: path.resolve(__dirname, "../../.env"),
    expectedLiquidityPath: process.env.EXPECT_LIQUIDITY_PATH || "",
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") {
      const next = argv[i + 1];
      if (!next) throw new Error("--network requires value: polygon|amoy");
      opts.network = next;
      i++;
    } else if (a === "--strict") {
      opts.strict = true;
    } else if (a === "--env") {
      const next = argv[i + 1];
      if (!next) throw new Error("--env requires path");
      opts.envFile = path.resolve(process.cwd(), next);
      i++;
    } else if (a === "--expect-liquidity-path") {
      const next = argv[i + 1];
      if (!next) throw new Error("--expect-liquidity-path requires value");
      opts.expectedLiquidityPath = next;
      i++;
    }
  }

  const n = String(opts.network || "").toLowerCase();
  if (!["polygon", "amoy"].includes(n)) {
    throw new Error(`Unsupported network: ${opts.network}. Use polygon|amoy.`);
  }
  opts.network = n;

  return opts;
}

function isAddress(value) {
  try {
    return !!value && ethers.utils.getAddress(value) !== ZERO;
  } catch {
    return false;
  }
}

function isHexPrivateKey(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value || ""));
}

function isPlaceholder(value) {
  const s = String(value || "");
  return s.includes("YOUR_") || s.includes("your_") || s.includes("<") || s.includes(">");
}

function parseNonNegativeInt(name, raw, fallback, errors) {
  const v = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(v) || v < 0) {
    errors.push(`${name} must be a non-negative integer (got: ${raw})`);
    return fallback;
  }
  return v;
}

function parseBps(name, raw, fallback, errors) {
  const v = parseNonNegativeInt(name, raw, fallback, errors);
  if (v < 0 || v > 10000) {
    errors.push(`${name} must be in range 0..10000 (got: ${v})`);
  }
  return v;
}

function parseBool(name, raw, fallback, errors) {
  if (raw == null || raw === "") return fallback;
  const v = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  errors.push(`${name} must be boolean-like (1/0/true/false), got: ${raw}`);
  return fallback;
}

function printList(title, lines) {
  if (!lines.length) return;
  console.log(`\n${title}`);
  for (const line of lines) {
    console.log(`- ${line}`);
  }
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

  if (!isHexPrivateKey(process.env.PRIVATE_KEY)) {
    errors.push("PRIVATE_KEY is missing or invalid (must be 0x + 64 hex chars).");
  }

  const rpcKey = opts.network === "polygon" ? "POLYGON_RPC_URL" : "AMOY_RPC_URL";
  const rpc = process.env[rpcKey];
  if (!rpc || isPlaceholder(rpc)) {
    errors.push(`${rpcKey} is missing or placeholder.`);
  }

  const saleCap = parseNonNegativeInt("SALE_CAP", process.env.SALE_CAP, 550, errors);
  const marketingCap = parseNonNegativeInt("MARKETING_CAP", process.env.MARKETING_CAP, 0, errors);
  if (saleCap + marketingCap !== 550) {
    errors.push(`SALE_CAP + MARKETING_CAP must equal 550 (got ${saleCap + marketingCap}).`);
  }

  if (!isAddress(process.env.PAIR)) {
    errors.push("PAIR must be a non-zero address.");
  }
  if (!isAddress(process.env.QUOTE_TOKEN)) {
    errors.push("QUOTE_TOKEN must be a non-zero address.");
  }

  if (process.env.MARKETING_SUPPORT && !isAddress(process.env.MARKETING_SUPPORT)) {
    errors.push("MARKETING_SUPPORT is set but invalid.");
  }

  parseBps("SUPPLY_DEX_RESERVE_DROP_BPS", process.env.SUPPLY_DEX_RESERVE_DROP_BPS, 5000, errors);
  parseBps("DEX_GUARD_MIN_RESERVE_RATIO_BPS", process.env.DEX_GUARD_MIN_RESERVE_RATIO_BPS, 5000, errors);
  parseBps("DEX_GUARD_MAX_DEVIATION_BPS", process.env.DEX_GUARD_MAX_DEVIATION_BPS, 2000, errors);
  parseBps("POLICY_SWAP_SLIPPAGE_BPS", process.env.POLICY_SWAP_SLIPPAGE_BPS, 500, errors);
  parseBps("BUYBACK_FALLBACK_SLIPPAGE_BPS", process.env.BUYBACK_FALLBACK_SLIPPAGE_BPS, 200, errors);

  parseNonNegativeInt("SUPPLY_DEX_COOLDOWN_SEC", process.env.SUPPLY_DEX_COOLDOWN_SEC, 1800, errors);
  parseNonNegativeInt("SUPPLY_REWARDS_COOLDOWN_SEC", process.env.SUPPLY_REWARDS_COOLDOWN_SEC, 43200, errors);
  parseNonNegativeInt("DEX_GUARD_COOLDOWN_SEC", process.env.DEX_GUARD_COOLDOWN_SEC, 1800, errors);
  parseNonNegativeInt("POLICY_TX_DEADLINE_SEC", process.env.POLICY_TX_DEADLINE_SEC, 600, errors);
  parseNonNegativeInt("POLICY_MIN_BUYBACK_INTERVAL_SEC", process.env.POLICY_MIN_BUYBACK_INTERVAL_SEC, 300, errors);
  parseNonNegativeInt("BUYBACK_FALLBACK_DEADLINE_SEC", process.env.BUYBACK_FALLBACK_DEADLINE_SEC, 600, errors);
  parseNonNegativeInt("BUYBACK_FALLBACK_COOLDOWN_SEC", process.env.BUYBACK_FALLBACK_COOLDOWN_SEC, 300, errors);

  const priceCheckEnabled = parseBool(
    "DEX_GUARD_PRICE_CHECK_ENABLED",
    process.env.DEX_GUARD_PRICE_CHECK_ENABLED,
    false,
    errors
  );
  if (priceCheckEnabled && !isAddress(process.env.DEX_GUARD_QUOTE_ORACLE)) {
    errors.push("DEX_GUARD_QUOTE_ORACLE must be set when DEX_GUARD_PRICE_CHECK_ENABLED=1.");
  }

  const pathVal = String(opts.expectedLiquidityPath || "").trim().toLowerCase();
  if (pathVal && !["keeper_proxy", "automation", "none"].includes(pathVal)) {
    errors.push(`Invalid expected liquidity path: ${pathVal} (use keeper_proxy|automation|none).`);
  }

  const keeperProxy = isAddress(process.env.LIQUIDITY_KEEPER_PROXY);
  const automation = isAddress(process.env.LIQUIDITY_AUTOMATION);
  if (keeperProxy && automation) {
    warnings.push("Both LIQUIDITY_KEEPER_PROXY and LIQUIDITY_AUTOMATION are set.");
  }
  if (pathVal === "keeper_proxy" && automation) {
    warnings.push("Expected keeper_proxy, but LIQUIDITY_AUTOMATION is also configured.");
  }
  if (pathVal === "automation" && keeperProxy) {
    warnings.push("Expected automation, but LIQUIDITY_KEEPER_PROXY is also configured.");
  }

  if (process.env.VRF_COORDINATOR || process.env.VRF_KEY_HASH || process.env.VRF_SUB_ID) {
    if (!isAddress(process.env.VRF_COORDINATOR)) {
      errors.push("VRF_COORDINATOR is invalid (when VRF values are provided).");
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(process.env.VRF_KEY_HASH || ""))) {
      errors.push("VRF_KEY_HASH must be bytes32 (when VRF values are provided).");
    }
    const subRaw = process.env.VRF_SUB_ID;
    const subOk = subRaw != null && subRaw !== "" && /^\d+$/.test(String(subRaw));
    if (!subOk) {
      errors.push("VRF_SUB_ID must be integer string (when VRF values are provided).");
    }
  } else {
    infos.push("VRF env not provided: deploy script will skip BiggiVRFRouter deploy.");
  }

  if (!process.env.MARKETING_SUPPORT) {
    infos.push("MARKETING_SUPPORT not set: 200M marketing support falls back to TREASURY.");
  }

  printList("INFO", infos);
  printList("WARNINGS", warnings);
  printList("ERRORS", errors);

  if (errors.length) {
    console.error(`\nConfig validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  if (opts.strict && warnings.length) {
    console.error(`\nStrict mode: treating ${warnings.length} warning(s) as failure.`);
    process.exit(1);
  }

  console.log("\nConfig validation: OK");
}

main();
