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
    expectedLiquidityPath: process.env.EXPECT_LIQUIDITY_PATH || process.env.LIQUIDITY_PATH || "",
    expectedOwner: process.env.EXPECT_OWNER || "",
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") {
      const next = argv[i + 1];
      if (!next) throw new Error("--network requires value: polygon");
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
    } else if (a === "--expect-owner") {
      const next = argv[i + 1];
      if (!next) throw new Error("--expect-owner requires address");
      opts.expectedOwner = next;
      i++;
    }
  }

  const n = String(opts.network || "").toLowerCase();
  if (n !== "polygon") {
    throw new Error(`Unsupported network: ${opts.network}. Use polygon.`);
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

function parseTokenAmount(name, raw, fallback, errors) {
  const value = raw == null || raw === "" ? String(fallback) : String(raw);
  if (value.startsWith("-")) {
    errors.push(`${name} must be a non-negative token amount (got: ${raw})`);
    return ethers.constants.Zero;
  }
  try {
    return ethers.utils.parseUnits(value, 18);
  } catch {
    errors.push(`${name} must be a valid token amount with up to 18 decimals (got: ${raw})`);
    return ethers.constants.Zero;
  }
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

  // Values from the selected env file are available only after dotenv.config().
  if (!opts.expectedOwner) opts.expectedOwner = process.env.EXPECT_OWNER || "";
  if (!opts.expectedLiquidityPath) {
    opts.expectedLiquidityPath = process.env.EXPECT_LIQUIDITY_PATH || process.env.LIQUIDITY_PATH || "";
  }

  const errors = [];
  const warnings = [];
  const infos = [];

  if (!isHexPrivateKey(process.env.PRIVATE_KEY)) {
    errors.push("PRIVATE_KEY is missing or invalid (must be 0x + 64 hex chars).");
  }

  const rpcKey = "POLYGON_RPC_URL";
  const rpc = process.env[rpcKey];
  if (!rpc || isPlaceholder(rpc)) {
    errors.push(`${rpcKey} is missing or placeholder.`);
  }

  const saleCap = parseNonNegativeInt("SALE_CAP", process.env.SALE_CAP, 500, errors);
  const marketingCap = parseNonNegativeInt("MARKETING_CAP", process.env.MARKETING_CAP, 50, errors);
  if (saleCap + marketingCap !== 550) {
    errors.push(`SALE_CAP + MARKETING_CAP must equal 550 (got ${saleCap + marketingCap}).`);
  }

  const allowPendingPair = parseBool("ALLOW_PENDING_PAIR", process.env.ALLOW_PENDING_PAIR, false, errors);
  if (!allowPendingPair && !isAddress(process.env.PAIR)) {
    errors.push("PAIR must be a non-zero address.");
  }
  if (!allowPendingPair && !isAddress(process.env.QUOTE_TOKEN)) {
    errors.push("QUOTE_TOKEN must be a non-zero address.");
  }
  if (allowPendingPair) {
    warnings.push("ALLOW_PENDING_PAIR=1: tokenomics can deploy with PAIR unset, but DEX guard/supply baseline/buyback/liquidity activation must be completed later with a real pair.");
    if (isAddress(process.env.PAIR) && !isAddress(process.env.QUOTE_TOKEN)) {
      errors.push("QUOTE_TOKEN must be a non-zero address when PAIR is set.");
    }
  }

  if (process.env.MARKETING_SUPPORT && !isAddress(process.env.MARKETING_SUPPORT)) {
    errors.push("MARKETING_SUPPORT is set but invalid.");
  }
  if (process.env.DEV_WALLET && !isAddress(process.env.DEV_WALLET)) {
    errors.push("DEV_WALLET is set but invalid.");
  }
  if (process.env.TOKEN_REWARDS_EMISSION_CONTROLLER && !isAddress(process.env.TOKEN_REWARDS_EMISSION_CONTROLLER)) {
    errors.push("TOKEN_REWARDS_EMISSION_CONTROLLER is set but invalid.");
  }
  if (opts.expectedOwner && !isAddress(opts.expectedOwner)) {
    errors.push("EXPECT_OWNER is set but invalid.");
  }

  parseBps("SUPPLY_DEX_RESERVE_DROP_BPS", process.env.SUPPLY_DEX_RESERVE_DROP_BPS, 5000, errors);
  parseBps("DEX_GUARD_MIN_RESERVE_RATIO_BPS", process.env.DEX_GUARD_MIN_RESERVE_RATIO_BPS, 5000, errors);
  parseBps("DEX_GUARD_MAX_DEVIATION_BPS", process.env.DEX_GUARD_MAX_DEVIATION_BPS, 2000, errors);
  parseBps("POLICY_SWAP_SLIPPAGE_BPS", process.env.POLICY_SWAP_SLIPPAGE_BPS, 500, errors);
  parseBps("BUYBACK_FALLBACK_SLIPPAGE_BPS", process.env.BUYBACK_FALLBACK_SLIPPAGE_BPS, 200, errors);
  parseBps("TOKEN_REWARDS_BALANCE_BUDGET_BPS", process.env.TOKEN_REWARDS_BALANCE_BUDGET_BPS, 100, errors);

  parseBool(
    "DEPLOY_TOKEN_REWARDS_EMISSION_CONTROLLER",
    process.env.DEPLOY_TOKEN_REWARDS_EMISSION_CONTROLLER,
    true,
    errors
  );
  parseBool(
    "TOKEN_REWARDS_EMISSION_ENABLED",
    process.env.TOKEN_REWARDS_EMISSION_ENABLED,
    true,
    errors
  );
  const tokenRewardsTargetWeeklyUnits = parseNonNegativeInt(
    "TOKEN_REWARDS_TARGET_WEEKLY_UNITS",
    process.env.TOKEN_REWARDS_TARGET_WEEKLY_UNITS,
    100000,
    errors
  );
  if (tokenRewardsTargetWeeklyUnits === 0) {
    errors.push("TOKEN_REWARDS_TARGET_WEEKLY_UNITS must be greater than zero.");
  }
  const tokenRewardsMinWeeklyBudget = parseTokenAmount("TOKEN_REWARDS_MIN_WEEKLY_BUDGET", process.env.TOKEN_REWARDS_MIN_WEEKLY_BUDGET, "50000", errors);
  const tokenRewardsWeakWeeklyBudget = parseTokenAmount("TOKEN_REWARDS_WEAK_WEEKLY_BUDGET", process.env.TOKEN_REWARDS_WEAK_WEEKLY_BUDGET, "100000", errors);
  const tokenRewardsNormalWeeklyBudget = parseTokenAmount("TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET", process.env.TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET, "500000", errors);
  const tokenRewardsStrongWeeklyBudget = parseTokenAmount("TOKEN_REWARDS_STRONG_WEEKLY_BUDGET", process.env.TOKEN_REWARDS_STRONG_WEEKLY_BUDGET, "1000000", errors);
  const tokenRewardsEmergencyWeeklyBudget = parseTokenAmount("TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET", process.env.TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET, "25000", errors);
  const tokenRewardsMaxWeeklyBudget = parseTokenAmount("TOKEN_REWARDS_MAX_WEEKLY_BUDGET", process.env.TOKEN_REWARDS_MAX_WEEKLY_BUDGET, "1000000", errors);
  const tokenRewardsWeakInflowThreshold = parseTokenAmount("TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD", process.env.TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD, "10000", errors);
  const tokenRewardsStrongInflowThreshold = parseTokenAmount("TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD", process.env.TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD, "200000", errors);
  if (tokenRewardsMinWeeklyBudget.isZero()) errors.push("TOKEN_REWARDS_MIN_WEEKLY_BUDGET must be greater than zero.");
  if (tokenRewardsWeakWeeklyBudget.isZero()) errors.push("TOKEN_REWARDS_WEAK_WEEKLY_BUDGET must be greater than zero.");
  if (tokenRewardsNormalWeeklyBudget.isZero()) errors.push("TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET must be greater than zero.");
  if (tokenRewardsStrongWeeklyBudget.isZero()) errors.push("TOKEN_REWARDS_STRONG_WEEKLY_BUDGET must be greater than zero.");
  if (tokenRewardsEmergencyWeeklyBudget.isZero()) errors.push("TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET must be greater than zero.");
  if (tokenRewardsMaxWeeklyBudget.isZero()) errors.push("TOKEN_REWARDS_MAX_WEEKLY_BUDGET must be greater than zero.");
  if (tokenRewardsWeakInflowThreshold.gt(tokenRewardsStrongInflowThreshold)) {
    errors.push("TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD must be <= TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD.");
  }
  if (tokenRewardsMinWeeklyBudget.gt(tokenRewardsMaxWeeklyBudget)) {
    errors.push("TOKEN_REWARDS_MIN_WEEKLY_BUDGET must be <= TOKEN_REWARDS_MAX_WEEKLY_BUDGET.");
  }
  if (tokenRewardsEmergencyWeeklyBudget.gt(tokenRewardsMaxWeeklyBudget)) {
    errors.push("TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET must be <= TOKEN_REWARDS_MAX_WEEKLY_BUDGET.");
  }

  parseNonNegativeInt("SUPPLY_DEX_COOLDOWN_SEC", process.env.SUPPLY_DEX_COOLDOWN_SEC, 1800, errors);
  parseNonNegativeInt("SUPPLY_REWARDS_COOLDOWN_SEC", process.env.SUPPLY_REWARDS_COOLDOWN_SEC, 43200, errors);
  parseNonNegativeInt("DEX_GUARD_COOLDOWN_SEC", process.env.DEX_GUARD_COOLDOWN_SEC, 1800, errors);
  parseNonNegativeInt("DEX_GUARD_MAX_ORACLE_STALENESS_SEC", process.env.DEX_GUARD_MAX_ORACLE_STALENESS_SEC, 86400, errors);
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
  const requireQuoteOracle = parseBool(
    "DEX_GUARD_REQUIRE_QUOTE_ORACLE",
    process.env.DEX_GUARD_REQUIRE_QUOTE_ORACLE,
    false,
    errors
  );
  if ((priceCheckEnabled && requireQuoteOracle) && !isAddress(process.env.DEX_GUARD_QUOTE_ORACLE)) {
    errors.push("DEX_GUARD_QUOTE_ORACLE must be set when DEX_GUARD_PRICE_CHECK_ENABLED=1 and DEX_GUARD_REQUIRE_QUOTE_ORACLE=1.");
  }
  if (priceCheckEnabled && !isAddress(process.env.DEX_GUARD_QUOTE_ORACLE)) {
    warnings.push("DEX_GUARD_PRICE_CHECK_ENABLED=1 without DEX_GUARD_QUOTE_ORACLE: guard will only compare against its local price anchor.");
  }

  const expectedPathVal = String(opts.expectedLiquidityPath || "").trim().toLowerCase();
  const deployPathVal = String(process.env.LIQUIDITY_PATH || "").trim().toLowerCase();
  if (expectedPathVal && !["keeper_proxy", "automation", "none"].includes(expectedPathVal)) {
    errors.push(`Invalid expected liquidity path: ${expectedPathVal} (use keeper_proxy|automation|none).`);
  }
  if (deployPathVal && !["keeper_proxy", "automation", "none"].includes(deployPathVal)) {
    errors.push(`Invalid LIQUIDITY_PATH: ${deployPathVal} (use keeper_proxy|automation|none).`);
  }
  if (expectedPathVal && deployPathVal && expectedPathVal !== deployPathVal) {
    warnings.push(`LIQUIDITY_PATH (${deployPathVal}) and EXPECT_LIQUIDITY_PATH (${expectedPathVal}) differ.`);
  }
  const effectivePathVal = deployPathVal || expectedPathVal;
  const deployLiquidityBranch = parseBool(
    "DEPLOY_LIQUIDITY_BRANCH",
    process.env.DEPLOY_LIQUIDITY_BRANCH,
    false,
    errors
  );
  const deployBuybackBranch = parseBool(
    "DEPLOY_BUYBACK_BRANCH",
    process.env.DEPLOY_BUYBACK_BRANCH,
    false,
    errors
  );
  const deployDripLm = parseBool(
    "DEPLOY_DRIP_LM",
    process.env.DEPLOY_DRIP_LM,
    deployBuybackBranch,
    errors
  );
  const deployModeratorCenter = parseBool(
    "DEPLOY_MODERATOR_CENTER",
    process.env.DEPLOY_MODERATOR_CENTER,
    deployBuybackBranch,
    errors
  );

  const keeperProxy = isAddress(process.env.LIQUIDITY_KEEPER_PROXY);
  const automation = isAddress(process.env.LIQUIDITY_AUTOMATION);
  if (keeperProxy && automation) {
    warnings.push("Both LIQUIDITY_KEEPER_PROXY and LIQUIDITY_AUTOMATION are set.");
  }
  if (effectivePathVal === "keeper_proxy" && automation) {
    warnings.push("Expected keeper_proxy, but LIQUIDITY_AUTOMATION is also configured.");
  }
  if (effectivePathVal === "automation" && keeperProxy) {
    warnings.push("Expected automation, but LIQUIDITY_KEEPER_PROXY is also configured.");
  }
  if (effectivePathVal === "none" && (keeperProxy || automation)) {
    warnings.push("Liquidity path is none, but liquidity automation addresses are still configured.");
  }
  if (deployLiquidityBranch && effectivePathVal === "none") {
    warnings.push("DEPLOY_LIQUIDITY_BRANCH=1, but effective LIQUIDITY_PATH is none.");
  }
  if (deployLiquidityBranch) {
    if (!isAddress(process.env.ROUTER)) {
      errors.push("ROUTER must be a non-zero address when DEPLOY_LIQUIDITY_BRANCH=1 on non-local network.");
    }
    if (!isAddress(process.env.FACTORY)) {
      errors.push("FACTORY must be a non-zero address when DEPLOY_LIQUIDITY_BRANCH=1 on non-local network.");
    }
    if (!isAddress(process.env.WETH)) {
      errors.push("WETH must be a non-zero address when DEPLOY_LIQUIDITY_BRANCH=1 on non-local network.");
    }
  }
  if (deployBuybackBranch && !isAddress(process.env.BUYBACK_ROUTER) && !isAddress(process.env.ROUTER)) {
    warnings.push("DEPLOY_BUYBACK_BRANCH=1, but neither BUYBACK_ROUTER nor ROUTER is configured.");
  }
  if (deployDripLm && !isAddress(process.env.DRIP_LM) && !isAddress(process.env.BUYBACK_ROUTER) && !isAddress(process.env.ROUTER)) {
    errors.push("BUYBACK_ROUTER or ROUTER must be set when DEPLOY_DRIP_LM=1 and DRIP_LM is not predeployed.");
  }
  if (deployModeratorCenter && isAddress(process.env.MODERATOR_CENTER) && process.env.DEPLOY_MODERATOR_CENTER === "1") {
    infos.push("MODERATOR_CENTER is set; deploy script will reuse it instead of deploying a new ModeratorCenter.");
  }
  if (opts.network === "polygon" && !deployDripLm && !isAddress(process.env.DRIP_LM)) {
    warnings.push("Polygon mainnet: DRIP_LM is not configured; buyback drip-sell branch will stay inactive.");
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
  if (!process.env.DEV_WALLET) {
    infos.push("DEV_WALLET not set: TicketHub/Main2 sales routing defaults to deployer/initial owner.");
  }
  if (!opts.expectedOwner) {
    infos.push("EXPECT_OWNER not set: validator will not confirm final multisig ownership target.");
  }
  const strictNotifyCallers = parseBool("STRICT_NOTIFY_CALLERS", process.env.STRICT_NOTIFY_CALLERS, true, errors);
  if (!strictNotifyCallers) {
    warnings.push("STRICT_NOTIFY_CALLERS=0 weakens reserve notify protection.");
  }
  const circuitBreakerEnabled = parseBool(
    "CIRCUIT_BREAKER_ENABLED",
    process.env.CIRCUIT_BREAKER_ENABLED,
    true,
    errors
  );
  if (!circuitBreakerEnabled) {
    warnings.push("CIRCUIT_BREAKER_ENABLED=0 disables circuit-breaker protection.");
  }
  if (opts.network === "polygon" && !process.env.DEV_WALLET) {
    warnings.push("Polygon mainnet: DEV_WALLET should be set explicitly instead of falling back to deployer.");
  }
  if (opts.network === "polygon" && !opts.expectedOwner) {
    warnings.push("Polygon mainnet: EXPECT_OWNER should point to the final Safe for post-deploy owner verification.");
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
