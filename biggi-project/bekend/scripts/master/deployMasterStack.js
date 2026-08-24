// Deploy + wire BIGGI_MASTER stack focused on:
// - scaling collections (registry/controller/main/main2/ticketHub/distributor)
// - token/drip/tokenRewards
// - critical-point guard (BiggiDexReserveGuard)
//
// Usage:
//   npx hardhat run --config hardhat.biggi-master.cjs scripts/master/deployMasterStack.js --network <net>
//
// Optional env:
//   SALE_CAP, MARKETING_CAP, SERIES_NAME
//   VRF_COORDINATOR, VRF_KEY_HASH, VRF_SUB_ID, VRF_ROUTER
//   PAIR, QUOTE_TOKEN (required on non-local unless DEPLOY_MOCK_PAIR=1)
//   ALLOW_PENDING_PAIR (1 allows tokenomics deploy before final DEX pair exists)
//   CIRCUIT_BREAKER_ENABLED, CB_DEX_CRITICAL_FLOOR, CB_REWARDS_CRITICAL_FLOOR
//   SUPPLY_DEX_RESERVE_DROP_BPS, SUPPLY_DEX_REFILL_AMOUNT, SUPPLY_DEX_COOLDOWN_SEC, SUPPLY_MIN_RESERVE_FLOOR, SUPPLY_AUTO_REFRESH_BASELINE
//   SUPPLY_REWARDS_THRESHOLD, SUPPLY_REWARDS_REFILL_AMOUNT, SUPPLY_REWARDS_COOLDOWN_SEC
//   TOKEN_REWARDS_EMISSION_CONTROLLER, DEPLOY_TOKEN_REWARDS_EMISSION_CONTROLLER, TOKEN_REWARDS_EMISSION_ENABLED
//   TOKEN_REWARDS_TARGET_WEEKLY_UNITS, TOKEN_REWARDS_MIN_WEEKLY_BUDGET, TOKEN_REWARDS_WEAK_WEEKLY_BUDGET
//   TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET, TOKEN_REWARDS_STRONG_WEEKLY_BUDGET, TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET
//   TOKEN_REWARDS_MAX_WEEKLY_BUDGET, TOKEN_REWARDS_BALANCE_BUDGET_BPS, TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD
//   TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD
//   DEX_GUARD_MIN_RESERVE_RATIO_BPS, DEX_GUARD_REFILL_AMOUNT, DEX_GUARD_COOLDOWN_SEC, DEX_GUARD_AUTO_REFRESH_BASELINE
//   DEX_GUARD_PRICE_CHECK_ENABLED, DEX_GUARD_MAX_DEVIATION_BPS, DEX_GUARD_QUOTE_ORACLE
//   DEX_GUARD_MAX_ORACLE_STALENESS_SEC, DEX_GUARD_REQUIRE_QUOTE_ORACLE
//   POLICY_SWAP_SLIPPAGE_BPS, POLICY_TX_DEADLINE_SEC, POLICY_MIN_BUYBACK_INTERVAL_SEC, POLICY_BUYBACKS_PAUSED, POLICY_MAX_DAILY_BUYBACK_NATIVE
//   BUYBACK_FALLBACK_SLIPPAGE_BPS, BUYBACK_FALLBACK_DEADLINE_SEC, BUYBACK_FALLBACK_COOLDOWN_SEC
//   MARKETING_SUPPORT, DEV_WALLET
//   NFT_REWARDS, DEPLOY_NFT_REWARDS
//   DRIP_LM, MODERATOR_CENTER, BUYBACK_AGENT, BUYBACK_ROUTER, COMMUNITY_CENTER, POLICY
//   DEPLOY_BUYBACK_BRANCH, DEPLOY_DRIP_LM, DEPLOY_MODERATOR_CENTER, DEPLOY_BUYBACK_AGENT, DEPLOY_BUYBACK_ROUTER, DEPLOY_COMMUNITY_CENTER, DEPLOY_POLICY
//   ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK (default 1; local fallback BUYBACK/COMMUNITY -> TREASURY)
//   LIQUIDITY_MANAGER, LIQUIDITY_VAULT, ROUTER, FACTORY, WETH
//   LIQUIDITY_PATH (keeper_proxy|automation|none; fallback EXPECT_LIQUIDITY_PATH, default keeper_proxy)
//   MAIN_READER, MULTI_COLLECTION_READER, CHAPTER_SERIES_READER, NFT_REWARDS_READER, MULTICALL
//   RESERVE_TREASURY_READER, BUYBACK_READER, LIQUIDITY_BRANCH_READER, LIQUIDITY_HELPER_READER
//   SUPPLY_CONTROLLER_READER, SUPPLY_GUARDIAN_READER, DEX_RESERVE_GUARD_READER
//   SYSTEM_READER, TOKENOMICS_SYSTEM_ADDON_READER, BIGGI_TOKENOMICS_READER, TOKEN_REWARDS_READER
//   DEPLOY_MAIN_READER, DEPLOY_MULTI_COLLECTION_READER, DEPLOY_CHAPTER_SERIES_READER, DEPLOY_NFT_REWARDS_READER, DEPLOY_MULTICALL
//   DEPLOY_TOKENOMIC_READERS or individual DEPLOY_*_READER flags for the tokenomic reader layer
//   SEED_MAIN_METADATA (default 1 on local networks, 0 otherwise)
//
// Output:
//   ./addresses.master.json

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function envAddr(name) {
  const v = process.env[name];
  if (!v) return ZERO;
  return ethers.utils.getAddress(v);
}

function envOrHintAddr(envName, hints, ...hintKeys) {
  const fromEnv = envAddr(envName);
  if (fromEnv !== ZERO) return fromEnv;
  return hintAddr(hints, ...(hintKeys.length ? hintKeys : [envName]));
}

function mustHex32(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${name} must be bytes32`);
  return v;
}

function asInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid integer for ${name}: ${raw}`);
  return n;
}

function asBool(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const v = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function asTokenAmount(name, fallbackTokens) {
  const raw = process.env[name];
  const v = raw == null || raw === "" ? String(fallbackTokens) : String(raw);
  return ethers.utils.parseUnits(v, 18);
}

function hintAddr(hints, ...keys) {
  for (const key of keys) {
    const v = hints[key];
    if (!v) continue;
    try {
      const a = ethers.utils.getAddress(v);
      if (a !== ZERO) return a;
    } catch {
      // ignore invalid hint values
    }
  }
  return ZERO;
}

function loadAddressHints() {
  const p = path.resolve(__dirname, "../../addresses.json");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function isForkedHardhatNetwork() {
  return network.name === "hardhat" && !!(network.config && network.config.forking && network.config.forking.url);
}

function isLocalNetwork() {
  if (network.name === "localhost") return true;
  return network.name === "hardhat" && !isForkedHardhatNetwork();
}

async function deploy(name, args = [], options = undefined) {
  const factory = await ethers.getContractFactory(name, options);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  console.log(`${name}: ${contract.address}`);
  return contract;
}

async function seedFullMainMetadata(main) {
  let nextIndex = 1;
  let indices = [];
  let backgrounds = [];
  let blocks = [];
  let mainIds = [];

  async function flush() {
    if (indices.length === 0) return;
    await (await main.batchSetNFTBackgroundAndBlock(indices, backgrounds, blocks, mainIds)).wait();
    indices = [];
    backgrounds = [];
    blocks = [];
    mainIds = [];
  }

  for (let blockIdx = 1; blockIdx <= 10; blockIdx += 1) {
    const backgroundCount = 11 - blockIdx;
    const minMainId = (blockIdx - 1) * 10 + 1;
    const maxMainId = blockIdx * 10;
    for (let mainId = minMainId; mainId <= maxMainId; mainId += 1) {
      for (let background = 1; background <= backgroundCount; background += 1) {
        indices.push(nextIndex);
        backgrounds.push(background);
        blocks.push(blockIdx);
        mainIds.push(mainId);
        nextIndex += 1;
        if (indices.length === 55) {
          await flush();
        }
      }
    }
  }

  await flush();
  const [configuredCount, fullyConfigured, rewardMatrixConsistent] = await main.metadataConsistency();
  console.log(
    `BiggiEyesMain metadata: configured=${configuredCount.toString()} fully=${fullyConfigured} rewards=${rewardMatrixConsistent}`
  );
}

async function contractAddrOrZero(label, addr) {
  if (addr === ZERO) return ZERO;
  const code = await ethers.provider.getCode(addr);
  if (code !== "0x") return addr;
  console.warn(`WARN: ${label} ${addr} has no code on ${network.name}; treating as unset.`);
  return ZERO;
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  try {
    return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
  } catch {
    return false;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const saleCap = asInt("SALE_CAP", 500);
  const marketingCap = asInt("MARKETING_CAP", 50);
  const totalCap = 550;
  const circuitBreakerEnabled = process.env.CIRCUIT_BREAKER_ENABLED !== "0";
  const cbDexCriticalFloor = asTokenAmount("CB_DEX_CRITICAL_FLOOR", "500");
  const cbRewardsCriticalFloor = asTokenAmount("CB_REWARDS_CRITICAL_FLOOR", "500");
  const supplyDexReserveDropBps = asInt("SUPPLY_DEX_RESERVE_DROP_BPS", 5000);
  const supplyDexRefillAmount = asTokenAmount("SUPPLY_DEX_REFILL_AMOUNT", "20000000");
  const supplyDexCooldownSec = asInt("SUPPLY_DEX_COOLDOWN_SEC", 1800);
  const supplyMinimumReserveFloor = asTokenAmount("SUPPLY_MIN_RESERVE_FLOOR", "0");
  const supplyAutoRefreshBaseline = asBool("SUPPLY_AUTO_REFRESH_BASELINE", false);
  const supplyRewardsThreshold = asTokenAmount("SUPPLY_REWARDS_THRESHOLD", "5000000");
  const supplyRewardsRefillAmount = asTokenAmount("SUPPLY_REWARDS_REFILL_AMOUNT", "200000000");
  const supplyRewardsCooldownSec = asInt("SUPPLY_REWARDS_COOLDOWN_SEC", 43200);
  const tokenRewardsEmissionEnabled = asBool("TOKEN_REWARDS_EMISSION_ENABLED", true);
  const tokenRewardsTargetWeeklyUnits = asInt("TOKEN_REWARDS_TARGET_WEEKLY_UNITS", 100000);
  const tokenRewardsMinWeeklyBudget = asTokenAmount("TOKEN_REWARDS_MIN_WEEKLY_BUDGET", "50000");
  const tokenRewardsWeakWeeklyBudget = asTokenAmount("TOKEN_REWARDS_WEAK_WEEKLY_BUDGET", "100000");
  const tokenRewardsNormalWeeklyBudget = asTokenAmount("TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET", "500000");
  const tokenRewardsStrongWeeklyBudget = asTokenAmount("TOKEN_REWARDS_STRONG_WEEKLY_BUDGET", "1000000");
  const tokenRewardsEmergencyWeeklyBudget = asTokenAmount("TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET", "25000");
  const tokenRewardsMaxWeeklyBudget = asTokenAmount("TOKEN_REWARDS_MAX_WEEKLY_BUDGET", "1000000");
  const tokenRewardsBalanceBudgetBps = asInt("TOKEN_REWARDS_BALANCE_BUDGET_BPS", 100);
  const tokenRewardsWeakInflowThreshold = asTokenAmount("TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD", "10000");
  const tokenRewardsStrongInflowThreshold = asTokenAmount("TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD", "200000");

  const dexGuardMinReserveRatioBps = asInt("DEX_GUARD_MIN_RESERVE_RATIO_BPS", 5000);
  const dexGuardRefillAmount = asTokenAmount("DEX_GUARD_REFILL_AMOUNT", "20000000");
  const dexGuardCooldownSec = asInt("DEX_GUARD_COOLDOWN_SEC", 1800);
  const dexGuardAutoRefreshBaseline = asBool("DEX_GUARD_AUTO_REFRESH_BASELINE", true);
  const dexGuardPriceCheckEnabled = asBool("DEX_GUARD_PRICE_CHECK_ENABLED", false);
  const dexGuardMaxDeviationBps = asInt("DEX_GUARD_MAX_DEVIATION_BPS", 2000);
  const dexGuardQuoteOracle = envAddr("DEX_GUARD_QUOTE_ORACLE");
  const dexGuardMaxOracleStalenessSec = asInt("DEX_GUARD_MAX_ORACLE_STALENESS_SEC", 86400);
  const dexGuardRequireQuoteOracle = asBool("DEX_GUARD_REQUIRE_QUOTE_ORACLE", false);
  const dexGuardRefreshPriceAnchor = asBool("DEX_GUARD_REFRESH_PRICE_ANCHOR", dexGuardPriceCheckEnabled);

  const policySwapSlippageBps = asInt("POLICY_SWAP_SLIPPAGE_BPS", 500);
  const policyTxDeadlineSec = asInt("POLICY_TX_DEADLINE_SEC", 600);
  const policyMinBuybackIntervalSec = asInt("POLICY_MIN_BUYBACK_INTERVAL_SEC", 300);
  const policyBuybacksPaused = asBool("POLICY_BUYBACKS_PAUSED", false);
  const policyMaxDailyBuybackNative = asTokenAmount("POLICY_MAX_DAILY_BUYBACK_NATIVE", "0");

  const buybackFallbackSlipBps = asInt("BUYBACK_FALLBACK_SLIPPAGE_BPS", 200);
  const buybackFallbackDeadlineSec = asInt("BUYBACK_FALLBACK_DEADLINE_SEC", 600);
  const buybackFallbackCooldownSec = asInt("BUYBACK_FALLBACK_COOLDOWN_SEC", 300);

  const addressHints = loadAddressHints();
  if (saleCap + marketingCap !== totalCap) {
    throw new Error(`Invalid caps: sale(${saleCap}) + marketing(${marketingCap}) must equal ${totalCap}`);
  }
  if (tokenRewardsTargetWeeklyUnits <= 0) {
    throw new Error("TOKEN_REWARDS_TARGET_WEEKLY_UNITS must be greater than zero.");
  }
  if (tokenRewardsBalanceBudgetBps > 10000) {
    throw new Error("TOKEN_REWARDS_BALANCE_BUDGET_BPS must be in range 0..10000.");
  }
  if (
    tokenRewardsMinWeeklyBudget.isZero() ||
    tokenRewardsWeakWeeklyBudget.isZero() ||
    tokenRewardsNormalWeeklyBudget.isZero() ||
    tokenRewardsStrongWeeklyBudget.isZero() ||
    tokenRewardsEmergencyWeeklyBudget.isZero() ||
    tokenRewardsMaxWeeklyBudget.isZero()
  ) {
    throw new Error("TOKEN_REWARDS weekly budgets must be greater than zero.");
  }
  if (tokenRewardsWeakInflowThreshold.gt(tokenRewardsStrongInflowThreshold)) {
    throw new Error("TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD must be <= TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD.");
  }
  if (tokenRewardsMinWeeklyBudget.gt(tokenRewardsMaxWeeklyBudget)) {
    throw new Error("TOKEN_REWARDS_MIN_WEEKLY_BUDGET must be <= TOKEN_REWARDS_MAX_WEEKLY_BUDGET.");
  }
  if (tokenRewardsEmergencyWeeklyBudget.gt(tokenRewardsMaxWeeklyBudget)) {
    throw new Error("TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET must be <= TOKEN_REWARDS_MAX_WEEKLY_BUDGET.");
  }

  const seriesName = process.env.SERIES_NAME || "BIGGI MASTER Series";
  const deployMockPair = process.env.DEPLOY_MOCK_PAIR === "1" || isLocalNetwork();
  const allowPendingPair = asBool("ALLOW_PENDING_PAIR", false);
  const liquidityPath = String(
    process.env.LIQUIDITY_PATH || process.env.EXPECT_LIQUIDITY_PATH || "keeper_proxy"
  )
    .trim()
    .toLowerCase();
  const seedMainMetadata = asBool("SEED_MAIN_METADATA", isLocalNetwork());
  if (!["keeper_proxy", "automation", "none"].includes(liquidityPath)) {
    throw new Error(`Invalid LIQUIDITY_PATH: ${liquidityPath}. Use keeper_proxy|automation|none.`);
  }

  const namesLib = await deploy("BiggiNamesLib");
  const namesLib2 = await deploy("BiggiNamesLib2");

  const registry = await deploy("BiggiSeriesRegistry", [deployer.address]);
  const chapterController = await deploy("BiggiChapterController", [deployer.address, registry.address]);
  const compute = await deploy("BiggiCompute");
  const distributor = await deploy("BiggiMultiCollectionDistributor", [deployer.address]);

  const mainFactory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: { BiggiNamesLib: namesLib.address },
  });
  const mainCollection = await mainFactory.deploy(deployer.address);
  await mainCollection.deployed();
  console.log(`BiggiEyesMain: ${mainCollection.address}`);
  if (seedMainMetadata) {
    await seedFullMainMetadata(mainCollection);
  }

  const main2Factory = await ethers.getContractFactory("BiggiEyesMain2", {
    libraries: { BiggiNamesLib2: namesLib2.address },
  });
  const publicCollection = await main2Factory.deploy(deployer.address);
  await publicCollection.deployed();
  console.log(`BiggiEyesMain2: ${publicCollection.address}`);

  const ticketHub = await deploy("BiggiTicketHub", [deployer.address, mainCollection.address]);
  const collectionRewards = await deploy("BiggiCollectionRewards", [mainCollection.address, deployer.address]);
  const devWalletConfigured = envOrHintAddr(
    "DEV_WALLET",
    addressHints,
    "DEV_WALLET",
    "SAFE",
    "OWNER",
    "MULTISIG"
  );
  const devWalletFinal = devWalletConfigured !== ZERO ? devWalletConfigured : deployer.address;
  await (await publicCollection.setDevWallet(devWalletFinal)).wait();
  await (await ticketHub.setDevWallet(devWalletFinal)).wait();

  let vrfRouter = null;
  let vrfRouterAddress = await contractAddrOrZero(
    "VRF_ROUTER",
    envOrHintAddr("VRF_ROUTER", addressHints, "VRF_ROUTER")
  );
  if (process.env.VRF_COORDINATOR && process.env.VRF_KEY_HASH && process.env.VRF_SUB_ID) {
    const vrfCoordinator = envAddr("VRF_COORDINATOR");
    const keyHash = mustHex32("VRF_KEY_HASH");
    const subId = ethers.BigNumber.from(process.env.VRF_SUB_ID);
    vrfRouter = await deploy("BiggiVRFRouter", [vrfCoordinator, deployer.address, keyHash, subId]);
    vrfRouterAddress = vrfRouter.address;
  } else {
    console.log("VRF env not fully set. Skipping BiggiVRFRouter deploy.");
  }

  if (vrfRouterAddress === ZERO && !isLocalNetwork()) {
    throw new Error("VRF_ROUTER or full VRF_COORDINATOR + VRF_KEY_HASH + VRF_SUB_ID is required on non-local networks.");
  }

  if (vrfRouterAddress !== ZERO) {
    try {
      const vrfRouterCtl = vrfRouter || (await ethers.getContractAt("BiggiVRFRouter", vrfRouterAddress));
      const currentMain = await vrfRouterCtl.main();
      if (!sameAddress(currentMain, mainCollection.address)) {
        await (await vrfRouterCtl.setMain(mainCollection.address)).wait();
      }
    } catch (e) {
      console.warn(`WARN: VRF_ROUTER wiring skipped for ${vrfRouterAddress}: ${e.message}`);
    }
  }

  const biggiToken = await deploy("BiggiToken", [deployer.address]);
  const reserve = await deploy("BiggiReserveV4", [biggiToken.address, deployer.address]);
  const treasury = await deploy("BiggiTreasury", [biggiToken.address, deployer.address]);
  const dripDistributor = await deploy("BiggiDripDistributor", [biggiToken.address, deployer.address]);
  const tokenRewards = await deploy("BiggiTokenRewards", [
    mainCollection.address,
    publicCollection.address,
    biggiToken.address,
    deployer.address,
  ]);
  const shouldDeployTokenRewardsEmissionController = asBool("DEPLOY_TOKEN_REWARDS_EMISSION_CONTROLLER", true);
  let tokenRewardsEmissionController = await contractAddrOrZero(
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    envOrHintAddr(
      "TOKEN_REWARDS_EMISSION_CONTROLLER",
      addressHints,
      "TOKEN_REWARDS_EMISSION_CONTROLLER",
      "TOKEN_REWARDS_CONTROLLER",
      "EMISSION_CONTROLLER"
    )
  );
  if (tokenRewardsEmissionController === ZERO && shouldDeployTokenRewardsEmissionController) {
    tokenRewardsEmissionController = (
      await deploy("BiggiTokenRewardsEmissionController", [
        tokenRewards.address,
        treasury.address,
        biggiToken.address,
        deployer.address,
      ])
    ).address;
  }
  if (tokenRewardsEmissionController !== ZERO) {
    const emissionController = await ethers.getContractAt(
      "BiggiTokenRewardsEmissionController",
      tokenRewardsEmissionController
    );
    await (await emissionController.setTargetWeeklyUnits(tokenRewardsTargetWeeklyUnits)).wait();
    await (
      await emissionController.setBudgetConfig(
        tokenRewardsMinWeeklyBudget,
        tokenRewardsWeakWeeklyBudget,
        tokenRewardsNormalWeeklyBudget,
        tokenRewardsStrongWeeklyBudget,
        tokenRewardsEmergencyWeeklyBudget,
        tokenRewardsMaxWeeklyBudget,
        tokenRewardsBalanceBudgetBps
      )
    ).wait();
    await (
      await emissionController.setInflowThresholds(
        tokenRewardsWeakInflowThreshold,
        tokenRewardsStrongInflowThreshold
      )
    ).wait();
    await (await tokenRewards.setEmissionController(tokenRewardsEmissionController, tokenRewardsEmissionEnabled)).wait();
  }
  const masterConfig = await deploy("BiggiMasterTokenomicsConfig", [deployer.address]);

  let pairAddress = envOrHintAddr("PAIR", addressHints, "PAIR");
  let quoteTokenAddress = envOrHintAddr("QUOTE_TOKEN", addressHints, "QUOTE_TOKEN");
  let mockQuote = null;
  let mockPair = null;

  if (pairAddress !== ZERO) {
    const pairCode = await ethers.provider.getCode(pairAddress);
    if (pairCode === "0x") {
      if (deployMockPair) {
        console.warn(`WARN: PAIR ${pairAddress} has no code on ${network.name}; deploying mock pair instead.`);
        pairAddress = ZERO;
      } else {
        throw new Error(`PAIR ${pairAddress} has no deployed code on ${network.name}`);
      }
    }
  }

  if (pairAddress === ZERO) {
    if (allowPendingPair) {
      console.warn("WARN: ALLOW_PENDING_PAIR=1; deploying DEX-sensitive contracts with PAIR unset. Activate later with a real pair and baseline.");
    } else if (!deployMockPair) {
      throw new Error("PAIR is required on non-local network. Or set DEPLOY_MOCK_PAIR=1.");
    } else {
      mockQuote = await deploy("MockERC20", ["Wrapped Native", "WNATIVE", 18]);
      quoteTokenAddress = mockQuote.address;
      mockPair = await deploy("MockLpToken");
      pairAddress = mockPair.address;
      await (await mockPair.setPairTokens(biggiToken.address, quoteTokenAddress)).wait();
      await (await mockPair.setReserves(ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"))).wait();
    }
  } else {
    const pairReader = await ethers.getContractAt(
      ["function token0() external view returns (address)", "function token1() external view returns (address)"],
      pairAddress
    );
    const token0 = await pairReader.token0();
    const token1 = await pairReader.token1();
    if (quoteTokenAddress === ZERO) {
      if (token0.toLowerCase() === biggiToken.address.toLowerCase()) quoteTokenAddress = token1;
      else if (token1.toLowerCase() === biggiToken.address.toLowerCase()) quoteTokenAddress = token0;
    }
    if (quoteTokenAddress === ZERO) {
      throw new Error("QUOTE_TOKEN not set and cannot be inferred from PAIR.");
    }
  }

  const supplyController = await deploy("BiggiSupplyController", [
    deployer.address,
    biggiToken.address,
    dripDistributor.address,
    tokenRewards.address,
    pairAddress,
  ]);
  await (
    await supplyController.setDexConfig(
      supplyDexReserveDropBps,
      supplyDexRefillAmount,
      supplyDexCooldownSec,
      supplyMinimumReserveFloor,
      supplyAutoRefreshBaseline
    )
  ).wait();
  await (
    await supplyController.setRewardsConfig(
      supplyRewardsThreshold,
      supplyRewardsRefillAmount,
      supplyRewardsCooldownSec
    )
  ).wait();
  await (
    await supplyController.setCircuitBreakerConfig(
      circuitBreakerEnabled,
      cbDexCriticalFloor,
      cbRewardsCriticalFloor
    )
  ).wait();
  const supplyGuardian = await deploy("BiggiSupplyGuardian", [deployer.address, supplyController.address]);
  const dexReserveGuard = await deploy("BiggiDexReserveGuard", [
    deployer.address,
    pairAddress,
    biggiToken.address,
    quoteTokenAddress,
    supplyController.address,
  ]);
  await (await dexReserveGuard.setReserveRatioBps(dexGuardMinReserveRatioBps)).wait();
  await (await dexReserveGuard.setRefillAmount(dexGuardRefillAmount)).wait();
  await (await dexReserveGuard.setCooldown(dexGuardCooldownSec)).wait();
  await (await dexReserveGuard.setAutoRefreshBaselineOnRefill(dexGuardAutoRefreshBaseline)).wait();
  await (await dexReserveGuard.setPriceCheckConfig(dexGuardPriceCheckEnabled, dexGuardMaxDeviationBps)).wait();
  await (
    await dexReserveGuard.setQuoteOracleConfig(dexGuardMaxOracleStalenessSec, dexGuardRequireQuoteOracle)
  ).wait();
  if (dexGuardQuoteOracle !== ZERO) {
    await (await dexReserveGuard.setQuoteOracle(dexGuardQuoteOracle)).wait();
  }

  await (await mainCollection.setModules(compute.address, vrfRouterAddress)).wait();
  await (await mainCollection.setTicketHub(ticketHub.address)).wait();
  await (await ticketHub.setDistributor(distributor.address)).wait();
  await (await ticketHub.setMainCollection(mainCollection.address)).wait();
  await (await ticketHub.setTicketCaps(saleCap, marketingCap)).wait();
  await (await ticketHub.setBiggiToken(biggiToken.address)).wait();
  await (await ticketHub.setReserveAddress(reserve.address)).wait();

  await (await publicCollection.setDistributor(distributor.address)).wait();
  await (await publicCollection.setPriceProvider(mainCollection.address)).wait();
  await (await publicCollection.setBiggiToken(biggiToken.address)).wait();
  await (await publicCollection.setReserveAddress(reserve.address)).wait();

  await (await registry.createSeries(seriesName)).wait();
  await (await registry.createChapter(1)).wait();
  const chapterId = 1;
  await (
    await registry.setChapterCollections(chapterId, mainCollection.address, publicCollection.address, ticketHub.address)
  ).wait();
  await (
    await chapterController.configureChapter(
      chapterId,
      1,
      mainCollection.address,
      publicCollection.address,
      ticketHub.address,
      saleCap,
      marketingCap,
      totalCap
    )
  ).wait();
  await (await publicCollection.setChapterController(chapterController.address, chapterId)).wait();

  await (await collectionRewards.setRegistry(registry.address)).wait();
  await (await collectionRewards.setDistributor(distributor.address)).wait();
  await (await collectionRewards.configureCollectionBudget(mainCollection.address)).wait();
  await (await collectionRewards.setFundingCollection(mainCollection.address)).wait();

  await (await distributor.addCollection(ticketHub.address)).wait();
  await (await distributor.addCollection(publicCollection.address)).wait();
  await (await distributor.addCollection(mainCollection.address)).wait();
  await (await distributor.setRegistry(registry.address)).wait();
  await (await distributor.setCollectionRewards(collectionRewards.address)).wait();
  await (await distributor.setReserve(reserve.address)).wait();
  await (await distributor.setTreasury(treasury.address)).wait();

  let buybackAgent = envOrHintAddr("BUYBACK_AGENT", addressHints, "BUYBACK_AGENT");
  let buybackRouter = envOrHintAddr("BUYBACK_ROUTER", addressHints, "BUYBACK_ROUTER", "ROUTER");
  let nftRewards = envOrHintAddr("NFT_REWARDS", addressHints, "NFT_REWARDS", "BIGGI_NFT_REWARDS");
  const marketingSupport = envOrHintAddr(
    "MARKETING_SUPPORT",
    addressHints,
    "MARKETING_SUPPORT",
    "MARKETING_SUPPORT_WALLET"
  );
  const marketingSupportFinal = marketingSupport === ZERO ? treasury.address : marketingSupport;
  let communityCenter = envOrHintAddr("COMMUNITY_CENTER", addressHints, "COMMUNITY_CENTER", "COMMUNITY", "COMMUNITYCENTER");
  let moderatorCenter = envOrHintAddr(
    "MODERATOR_CENTER",
    addressHints,
    "MODERATOR_CENTER",
    "MODERATORCENTER",
    "BIGGI_MODERATOR_CENTER",
    "BIGGIMODERATORCENTER"
  );
  let policy = envOrHintAddr("POLICY", addressHints, "POLICY");
  const deployLiquidityBranch = process.env.DEPLOY_LIQUIDITY_BRANCH === "1" || isLocalNetwork();
  const deployBuybackBranch = process.env.DEPLOY_BUYBACK_BRANCH === "1" || isLocalNetwork();
  const shouldDeployDripLm =
    process.env.DEPLOY_DRIP_LM === "1" || (deployBuybackBranch && process.env.DEPLOY_DRIP_LM !== "0");
  const shouldDeployModeratorCenter =
    process.env.DEPLOY_MODERATOR_CENTER === "1" ||
    (deployBuybackBranch && process.env.DEPLOY_MODERATOR_CENTER !== "0");
  const shouldDeployBuybackAgent =
    process.env.DEPLOY_BUYBACK_AGENT === "1" || (deployBuybackBranch && process.env.DEPLOY_BUYBACK_AGENT !== "0");
  const shouldDeployPolicy =
    process.env.DEPLOY_POLICY === "1" || (deployBuybackBranch && process.env.DEPLOY_POLICY !== "0");
  const shouldDeployCommunityCenter =
    process.env.DEPLOY_COMMUNITY_CENTER === "1" ||
    (deployBuybackBranch && process.env.DEPLOY_COMMUNITY_CENTER !== "0");
  const shouldDeployBuybackRouter =
    process.env.DEPLOY_BUYBACK_ROUTER === "1" ||
    (isLocalNetwork() && shouldDeployBuybackAgent && process.env.DEPLOY_BUYBACK_ROUTER !== "0");

  let liquidityManager = envOrHintAddr("LIQUIDITY_MANAGER", addressHints, "LIQUIDITY_MANAGER", "LM");
  let liquidityVault = envOrHintAddr("LIQUIDITY_VAULT", addressHints, "LIQUIDITY_VAULT", "LM_VAULT");
  let liquidityOrchestrator = envOrHintAddr("LIQUIDITY_ORCHESTRATOR", addressHints, "LIQUIDITY_ORCHESTRATOR", "ORCHESTRATOR");
  let liquidityKeeperProxy = envOrHintAddr("LIQUIDITY_KEEPER_PROXY", addressHints, "LIQUIDITY_KEEPER_PROXY", "KEEPER_PROXY");
  let liquidityAutomation = envOrHintAddr("LIQUIDITY_AUTOMATION", addressHints, "LIQUIDITY_AUTOMATION");

  let router = envOrHintAddr("ROUTER", addressHints, "ROUTER");
  let factory = envOrHintAddr("FACTORY", addressHints, "FACTORY");
  let weth = envOrHintAddr("WETH", addressHints, "WETH");
  let mockLiquidityRouter = null;
  let mockLiquidityFactory = null;
  let mockBuybackRouter = null;

  let dripLm = envOrHintAddr("DRIP_LM", addressHints, "DRIP_LM");
  let dripKeeperProxy = envOrHintAddr("DRIP_KEEPER_PROXY", addressHints, "DRIP_KEEPER_PROXY");
  let buybackUpkeepProxy = envOrHintAddr("BUYBACK_UPKEEP_PROXY", addressHints, "BUYBACK_UPKEEP_PROXY", "UPKEEP_PROXY");
  let mainReader = envOrHintAddr("MAIN_READER", addressHints, "MAIN_READER", "READER");
  let multiCollectionReader = envOrHintAddr(
    "MULTI_COLLECTION_READER",
    addressHints,
    "MULTI_COLLECTION_READER",
    "MULTI_COLLECTION_DISTRIBUTOR_READER",
    "MCD_READER"
  );
  let chapterSeriesReader = envOrHintAddr(
    "CHAPTER_SERIES_READER",
    addressHints,
    "CHAPTER_SERIES_READER",
    "CHAPTER_READER",
    "SERIES_READER"
  );
  let nftRewardsReader = envOrHintAddr("NFT_REWARDS_READER", addressHints, "NFT_REWARDS_READER");
  let reserveTreasuryReader = envOrHintAddr(
    "RESERVE_TREASURY_READER",
    addressHints,
    "RESERVE_TREASURY_READER",
    "TREASURY_READER"
  );
  let buybackReader = envOrHintAddr("BUYBACK_READER", addressHints, "BUYBACK_READER", "BIGGI_BUYBACK_READER");
  let liquidityBranchReader = envOrHintAddr(
    "LIQUIDITY_BRANCH_READER",
    addressHints,
    "LIQUIDITY_BRANCH_READER",
    "LIQUIDITY_BRANCH_USER_READER"
  );
  let liquidityHelperReader = envOrHintAddr(
    "LIQUIDITY_HELPER_READER",
    addressHints,
    "LIQUIDITY_HELPER_READER"
  );
  let supplyControllerReader = envOrHintAddr(
    "SUPPLY_CONTROLLER_READER",
    addressHints,
    "SUPPLY_CONTROLLER_READER"
  );
  let supplyGuardianReader = envOrHintAddr(
    "SUPPLY_GUARDIAN_READER",
    addressHints,
    "SUPPLY_GUARDIAN_READER"
  );
  let dexReserveGuardReader = envOrHintAddr(
    "DEX_RESERVE_GUARD_READER",
    addressHints,
    "DEX_RESERVE_GUARD_READER"
  );
  let systemReader = envOrHintAddr("SYSTEM_READER", addressHints, "SYSTEM_READER", "BIGGI_SYSTEM_READER");
  let tokenomicsSystemAddonReader = envOrHintAddr(
    "TOKENOMICS_SYSTEM_ADDON_READER",
    addressHints,
    "TOKENOMICS_SYSTEM_ADDON_READER",
    "TOKENOMIC_SYSTEM_ADDON_READER"
  );
  let biggiTokenomicsReader = envOrHintAddr(
    "BIGGI_TOKENOMICS_READER",
    addressHints,
    "BIGGI_TOKENOMICS_READER",
    "BIGGI_TOKENOMIK_READER",
    "TOKENOMICS_READER",
    "TOKENOMIK_READER"
  );
  let tokenRewardsReader = envOrHintAddr(
    "TOKEN_REWARDS_READER",
    addressHints,
    "TOKEN_REWARDS_READER"
  );
  let multicall = envOrHintAddr("MULTICALL", addressHints, "MULTICALL", "MULTICALL2");

  liquidityManager = await contractAddrOrZero("LIQUIDITY_MANAGER", liquidityManager);
  liquidityVault = await contractAddrOrZero("LIQUIDITY_VAULT", liquidityVault);
  liquidityOrchestrator = await contractAddrOrZero("LIQUIDITY_ORCHESTRATOR", liquidityOrchestrator);
  liquidityKeeperProxy = await contractAddrOrZero("LIQUIDITY_KEEPER_PROXY", liquidityKeeperProxy);
  liquidityAutomation = await contractAddrOrZero("LIQUIDITY_AUTOMATION", liquidityAutomation);
  router = await contractAddrOrZero("ROUTER", router);
  factory = await contractAddrOrZero("FACTORY", factory);
  weth = await contractAddrOrZero("WETH", weth);
  buybackAgent = await contractAddrOrZero("BUYBACK_AGENT", buybackAgent);
  buybackRouter = await contractAddrOrZero("BUYBACK_ROUTER", buybackRouter);
  communityCenter = await contractAddrOrZero("COMMUNITY_CENTER", communityCenter);
  moderatorCenter = await contractAddrOrZero("MODERATOR_CENTER", moderatorCenter);
  policy = await contractAddrOrZero("POLICY", policy);
  dripLm = await contractAddrOrZero("DRIP_LM", dripLm);
  dripKeeperProxy = await contractAddrOrZero("DRIP_KEEPER_PROXY", dripKeeperProxy);
  buybackUpkeepProxy = await contractAddrOrZero("BUYBACK_UPKEEP_PROXY", buybackUpkeepProxy);
  mainReader = await contractAddrOrZero("MAIN_READER", mainReader);
  multiCollectionReader = await contractAddrOrZero("MULTI_COLLECTION_READER", multiCollectionReader);
  chapterSeriesReader = await contractAddrOrZero("CHAPTER_SERIES_READER", chapterSeriesReader);
  nftRewardsReader = await contractAddrOrZero("NFT_REWARDS_READER", nftRewardsReader);
  reserveTreasuryReader = await contractAddrOrZero("RESERVE_TREASURY_READER", reserveTreasuryReader);
  buybackReader = await contractAddrOrZero("BUYBACK_READER", buybackReader);
  liquidityBranchReader = await contractAddrOrZero("LIQUIDITY_BRANCH_READER", liquidityBranchReader);
  liquidityHelperReader = await contractAddrOrZero("LIQUIDITY_HELPER_READER", liquidityHelperReader);
  supplyControllerReader = await contractAddrOrZero("SUPPLY_CONTROLLER_READER", supplyControllerReader);
  supplyGuardianReader = await contractAddrOrZero("SUPPLY_GUARDIAN_READER", supplyGuardianReader);
  dexReserveGuardReader = await contractAddrOrZero("DEX_RESERVE_GUARD_READER", dexReserveGuardReader);
  systemReader = await contractAddrOrZero("SYSTEM_READER", systemReader);
  tokenomicsSystemAddonReader = await contractAddrOrZero(
    "TOKENOMICS_SYSTEM_ADDON_READER",
    tokenomicsSystemAddonReader
  );
  biggiTokenomicsReader = await contractAddrOrZero("BIGGI_TOKENOMICS_READER", biggiTokenomicsReader);
  tokenRewardsReader = await contractAddrOrZero("TOKEN_REWARDS_READER", tokenRewardsReader);
  multicall = await contractAddrOrZero("MULTICALL", multicall);
  nftRewards = await contractAddrOrZero("NFT_REWARDS", nftRewards);

  if (policy === ZERO && shouldDeployPolicy) {
    policy = (await deploy("BiggiPolicy", [deployer.address])).address;
  }
  if (policy !== ZERO) {
    try {
      const policyContract = await ethers.getContractAt("BiggiPolicy", policy);
      await (await policyContract.setSwapSlippageBps(policySwapSlippageBps)).wait();
      await (await policyContract.setTxDeadlineSec(policyTxDeadlineSec)).wait();
      await (await policyContract.setMinBuybackInterval(policyMinBuybackIntervalSec)).wait();
      await (await policyContract.setBuybacksPaused(policyBuybacksPaused)).wait();
      await (await policyContract.setMaxDailyBuybackNative(policyMaxDailyBuybackNative)).wait();
    } catch (e) {
      console.warn(`WARN: POLICY parameter setup skipped for ${policy}: ${e.message}`);
    }
  }
  if (communityCenter === ZERO && shouldDeployCommunityCenter) {
    communityCenter = (await deploy("BiggiCommunityCenter", [deployer.address])).address;
  }
  if (buybackAgent === ZERO && shouldDeployBuybackAgent) {
    buybackAgent = (await deploy("BiggiBuybackAgent", [biggiToken.address, deployer.address])).address;
  }
  if (liquidityPath === "keeper_proxy") {
    liquidityAutomation = ZERO;
  } else if (liquidityPath === "automation") {
    liquidityKeeperProxy = ZERO;
  } else {
    liquidityKeeperProxy = ZERO;
    liquidityAutomation = ZERO;
  }
  const allowDistributorRecipientFallback = process.env.ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK !== "0";
  const fallbackDistributorRecipient = isLocalNetwork() && allowDistributorRecipientFallback ? treasury.address : ZERO;
  const buybackAgentEffective = buybackAgent === ZERO ? fallbackDistributorRecipient : buybackAgent;
  const communityCenterEffective = communityCenter === ZERO ? fallbackDistributorRecipient : communityCenter;
  if (buybackAgentEffective === ZERO || communityCenterEffective === ZERO) {
    throw new Error(
      "Distributor recipients incomplete. Set BUYBACK_AGENT and COMMUNITY_CENTER (or use local fallback)."
    );
  }
  if (buybackAgent === ZERO && buybackAgentEffective !== ZERO) {
    console.warn(`WARN: BUYBACK_AGENT not set, using fallback recipient ${buybackAgentEffective}.`);
  }
  if (communityCenter === ZERO && communityCenterEffective !== ZERO) {
    console.warn(`WARN: COMMUNITY_CENTER not set, using fallback recipient ${communityCenterEffective}.`);
  }
  await (await distributor.setBuybackAgent(buybackAgentEffective)).wait();
  await (await distributor.setCommunityCenter(communityCenterEffective)).wait();
  if (communityCenter !== ZERO) {
    try {
      const communityCenterContract = await ethers.getContractAt("BiggiCommunityCenter", communityCenter);
      await (await communityCenterContract.setDistributor(distributor.address)).wait();
    } catch (e) {
      console.warn(`WARN: COMMUNITY_CENTER.setDistributor skipped: ${e.message}`);
    }
  }

  await (await biggiToken.setReserve(reserve.address)).wait();
  await (await biggiToken.setDripDistributor(dripDistributor.address)).wait();
  await (await biggiToken.setTokenRewards(tokenRewards.address)).wait();
  await (await biggiToken.setMarketingSupport(marketingSupportFinal)).wait();
  await (await biggiToken.setSupplyController(supplyController.address)).wait();
  await (await biggiToken.setSupplyGuardian(supplyGuardian.address)).wait();
  await (await biggiToken.initialDistribute()).wait();

  await (await reserve.setDistributor(distributor.address)).wait();
  if (deployLiquidityBranch) {
    if (weth === ZERO) {
      if (!isLocalNetwork()) {
        throw new Error("WETH is required to deploy liquidity branch on non-local network.");
      }
      weth = quoteTokenAddress;
    }

    if (router === ZERO) {
      if (!isLocalNetwork()) {
        throw new Error("ROUTER is required to deploy liquidity branch on non-local network.");
      }
      mockLiquidityRouter = await deploy("MockLiquidityRouter", [weth, pairAddress]);
      router = mockLiquidityRouter.address;
    }

    if (factory === ZERO) {
      if (!isLocalNetwork()) {
        throw new Error("FACTORY is required to deploy liquidity branch on non-local network.");
      }
      mockLiquidityFactory = await deploy("MockLiquidityFactory");
      await (await mockLiquidityFactory.setPair(pairAddress)).wait();
      factory = mockLiquidityFactory.address;
    }

    if (liquidityVault === ZERO) {
      liquidityVault = (await deploy("LiquidityVault", [deployer.address])).address;
    }
    if (liquidityManager === ZERO) {
      liquidityManager = (
        await deploy("BiggiLiquidityManager", [
          biggiToken.address,
          router,
          liquidityVault,
          deployer.address,
          reserve.address,
        ])
      ).address;
    }
    const useKeeperProxyLiquidity = liquidityPath === "keeper_proxy";
    const useAutomationLiquidity = liquidityPath === "automation";
    const autoMinPol = asTokenAmount("LIQ_AUTO_MIN_POL_WEI", "0.5");
    const autoMaxPol = asTokenAmount("LIQ_AUTO_MAX_POL_WEI", "2");
    const autoMinInterval = asInt("LIQ_AUTO_MIN_INTERVAL_SEC", 900);

    if (useKeeperProxyLiquidity) {
      if (liquidityOrchestrator === ZERO) {
        liquidityOrchestrator = (
          await deploy("BiggiLiquidityOrchestrator", [reserve.address, liquidityManager, deployer.address])
        ).address;
      }
      if (liquidityKeeperProxy === ZERO) {
        liquidityKeeperProxy = (
          await deploy("BiggiLiquidityKeeperProxy", [liquidityOrchestrator, reserve.address, deployer.address])
        ).address;
      }
      liquidityAutomation = ZERO;
    } else if (useAutomationLiquidity) {
      if (liquidityAutomation === ZERO) {
        liquidityAutomation = (
          await deploy("LiquidityAutomation", [
            liquidityManager,
            biggiToken.address,
            autoMinPol,
            autoMaxPol,
            autoMinInterval,
            deployer.address,
          ])
        ).address;
      }
      liquidityKeeperProxy = ZERO;
    }

    const lm = await ethers.getContractAt("BiggiLiquidityManager", liquidityManager);
    const vault = await ethers.getContractAt("LiquidityVault", liquidityVault);

    await (await reserve.setLiquidityManager(liquidityManager)).wait();
    await (await vault.setLiquidityManager(liquidityManager)).wait();
    try {
      await (await vault.addWhitelistedPair(pairAddress)).wait();
    } catch (e) {
      if (!String(e.message || e).toLowerCase().includes("already whitelisted")) throw e;
    }

    await (await lm.setRouter(router)).wait();
    await (await lm.setFactory(factory)).wait();
    await (await lm.setReserve(reserve.address)).wait();
    await (await lm.setLiquidityVault(liquidityVault)).wait();
    await (await lm.setTokenPct(asInt("LIQ_TOKEN_PCT", 100))).wait();
    await (await lm.setSlippageBps(asInt("LIQ_SLIPPAGE_BPS", 300))).wait();
    await (await lm.setTxDeadlineSec(asInt("LIQ_DEADLINE_SEC", 600))).wait();

    if (useKeeperProxyLiquidity) {
      const orchestrator = await ethers.getContractAt("BiggiLiquidityOrchestrator", liquidityOrchestrator);
      const keeperProxy = await ethers.getContractAt("BiggiLiquidityKeeperProxy", liquidityKeeperProxy);

      await (await lm.setKeeper(liquidityOrchestrator)).wait();
      await (await orchestrator.setReserve(reserve.address)).wait();
      await (await orchestrator.setLM(liquidityManager)).wait();
      await (await orchestrator.setKeeper(liquidityKeeperProxy)).wait();
      await (
        await orchestrator.setLimits(
          asTokenAmount("LIQ_ORCH_MIN_POL_PER_TX", "0.5"),
          asTokenAmount("LIQ_ORCH_MAX_POL_PER_TX", "50"),
          asTokenAmount("LIQ_ORCH_MIN_DEX_REFILL_BIGGI", "1"),
          asInt("LIQ_ORCH_COOLDOWN_SEC", 3600),
          asTokenAmount("LIQ_ORCH_DAILY_QUOTA_POL", "0")
        )
      ).wait();

      await (
        await keeperProxy.setStrategy(
          asInt("LIQ_KEEPER_MODE", 1),
          asTokenAmount("LIQ_KEEPER_FIXED_POL", "0.5"),
          asInt("LIQ_KEEPER_PERCENT_BPS", 500)
        )
      ).wait();
      await (
        await keeperProxy.setLimits(
          asInt("LIQ_KEEPER_MIN_INTERVAL_SEC", 900),
          asTokenAmount("LIQ_KEEPER_MIN_RESERVE_POL", "1"),
          asTokenAmount("LIQ_KEEPER_MAX_PER_TX", "20"),
          asTokenAmount("LIQ_KEEPER_MIN_DEX_REFILL_BIGGI", "1")
        )
      ).wait();
    } else if (useAutomationLiquidity) {
      const automation = await ethers.getContractAt("LiquidityAutomation", liquidityAutomation);

      await (await lm.setKeeper(liquidityAutomation)).wait();
      await (await automation.setLM(liquidityManager)).wait();
      await (await automation.setLimits(autoMinPol, autoMaxPol)).wait();
      await (await automation.setMinInterval(autoMinInterval)).wait();
    } else {
      await (await lm.setKeeper(ZERO)).wait();
    }
  } else {
    await (await reserve.setLiquidityManager(liquidityManager === ZERO ? deployer.address : liquidityManager)).wait();
  }

  await (await reserve.setNotifyCaller(ticketHub.address, true)).wait();
  await (await reserve.setNotifyCaller(publicCollection.address, true)).wait();
  await (await reserve.setNotifyCaller(distributor.address, true)).wait();
  await (await reserve.setNotifyCaller(treasury.address, true)).wait();
  const strictNotify = process.env.STRICT_NOTIFY_CALLERS !== "0";
  if (strictNotify) {
    await (await reserve.setNotifyCallerCheck(true)).wait();
  }

  await (await treasury.setDistributor(distributor.address)).wait();
  if (buybackAgent !== ZERO) await (await treasury.setBuybackAgent(buybackAgent)).wait();
  await (await treasury.setTokenRewards(tokenRewards.address)).wait();
  await (await treasury.setReserve(reserve.address)).wait();
  await (await treasury.setDripDistributor(dripDistributor.address)).wait();
  await (await treasury.setEcosystemBiggiCaller(ticketHub.address, true)).wait();
  await (await treasury.setEcosystemBiggiCaller(publicCollection.address, true)).wait();

  await (await ticketHub.setTokenSink(treasury.address, 10_000)).wait();
  await (await ticketHub.setTokenSinkDepositMode(true)).wait();
  await (await publicCollection.setTokenSink(treasury.address, 10_000)).wait();
  await (await publicCollection.setTokenSinkDepositMode(true)).wait();

  await (await dripDistributor.setTreasury(treasury.address)).wait();
  await (await dripDistributor.setCollection(mainCollection.address, true)).wait();
  await (await dripDistributor.setCollection(publicCollection.address, true)).wait();

  if (buybackRouter === ZERO && router !== ZERO && (!mockLiquidityRouter || !sameAddress(router, mockLiquidityRouter.address))) {
    buybackRouter = router;
  }
  if (buybackRouter === ZERO && shouldDeployBuybackRouter) {
    const buybackWeth = weth !== ZERO ? weth : quoteTokenAddress;
    if (buybackWeth === ZERO) {
      throw new Error("Cannot deploy BUYBACK_ROUTER: missing WETH/QUOTE_TOKEN.");
    }
    mockBuybackRouter = await deploy("MockBuybackRouter", [buybackWeth]);
    buybackRouter = mockBuybackRouter.address;
    const mockBuybackRouterSeed = asTokenAmount("MOCK_BUYBACK_ROUTER_SEED_BIGGI", "0");
    if (mockBuybackRouterSeed.gt(0)) {
      try {
        await (await biggiToken.mint(mockBuybackRouter.address, mockBuybackRouterSeed)).wait();
      } catch (e) {
        console.warn(`WARN: funding mock buyback router skipped: ${e.message}`);
      }
    }
  }

  if (moderatorCenter === ZERO && shouldDeployModeratorCenter) {
    moderatorCenter = (await deploy("ModeratorCenter", [deployer.address])).address;
  }

  const dripLmRouter = buybackRouter !== ZERO ? buybackRouter : router;
  if (dripLm === ZERO && shouldDeployDripLm) {
    if (dripLmRouter === ZERO) {
      throw new Error("Cannot deploy DRIP_LM: missing BUYBACK_ROUTER/ROUTER.");
    }
    dripLm = (await deploy("BiggiDripLMToModerator", [biggiToken.address, dripLmRouter, deployer.address])).address;
  }

  if (dripLm !== ZERO) {
    const dripLmContract = await ethers.getContractAt("BiggiDripLMToModerator", dripLm);
    await (await dripDistributor.setDripLM(dripLm)).wait();
    try {
      await (await dripDistributor.setTokensPerMintOperator(dripLm)).wait();
    } catch (e) {
      console.warn(`WARN: DRIP_DISTRIBUTOR.setTokensPerMintOperator skipped: ${e.message}`);
    }
    if (dripLmRouter !== ZERO) {
      await (await dripLmContract.setRouter(dripLmRouter)).wait();
    } else {
      console.warn("WARN: DRIP_LM router not set (BUYBACK_ROUTER/ROUTER missing or invalid).");
    }
    await (await dripLmContract.setDripDistributor(dripDistributor.address)).wait();
    await (await dripLmContract.setReserve(reserve.address)).wait();
    if (buybackAgent !== ZERO) {
      await (await dripLmContract.setBuybackAgent(buybackAgent)).wait();
    }
    if (moderatorCenter !== ZERO) {
      await (await dripLmContract.setModeratorCenter(moderatorCenter)).wait();
      const moderatorContract = await ethers.getContractAt("ModeratorCenter", moderatorCenter);
      await (await moderatorContract.setMultiCollection(dripLm)).wait();
    }
    await (await dripLmContract.setSellPct(asInt("DRIP_LM_SELL_PCT", 70))).wait();
    await (await dripLmContract.setSlippageBps(asInt("DRIP_LM_SLIPPAGE_BPS", asInt("LIQ_SLIPPAGE_BPS", 300)))).wait();
    await (await dripLmContract.setTxDeadlineSec(asInt("DRIP_LM_TX_DEADLINE_SEC", buybackFallbackDeadlineSec))).wait();
    await (
      await dripLmContract.setShares(
        asInt("DRIP_LM_RESERVE_SHARE_BPS", 5000),
        asInt("DRIP_LM_MODERATOR_SHARE_BPS", 5000)
      )
    ).wait();
  }

  if (buybackAgent !== ZERO) {
    try {
      const buybackContract = await ethers.getContractAt("BiggiBuybackAgent", buybackAgent);
      if (buybackRouter !== ZERO) {
        try {
          await (await buybackContract.setRouter(buybackRouter)).wait();
        } catch (e) {
          console.warn(`WARN: BUYBACK_AGENT.setRouter skipped: ${e.message}`);
        }
      } else {
        console.warn("WARN: BUYBACK_AGENT router not set (BUYBACK_ROUTER/ROUTER missing or invalid).");
      }
      try {
        await (await buybackContract.setTreasury(treasury.address)).wait();
      } catch (e) {
        console.warn(`WARN: BUYBACK_AGENT.setTreasury skipped: ${e.message}`);
      }
      if (policy !== ZERO) {
        try {
          await (await buybackContract.setPolicy(policy)).wait();
        } catch (e) {
          console.warn(`WARN: BUYBACK_AGENT.setPolicy skipped: ${e.message}`);
        }
      }
      try {
        await (await buybackContract.setDistributor(distributor.address)).wait();
      } catch (e) {
        console.warn(`WARN: BUYBACK_AGENT.setDistributor skipped: ${e.message}`);
      }
      if (dripLm !== ZERO) {
        try {
          await (await buybackContract.setDripLM(dripLm)).wait();
        } catch (e) {
          console.warn(`WARN: BUYBACK_AGENT.setDripLM skipped: ${e.message}`);
        }
      }
      try {
        await (
          await buybackContract.setFallbacks(
            buybackFallbackSlipBps,
            buybackFallbackDeadlineSec,
            buybackFallbackCooldownSec
          )
        ).wait();
      } catch (e) {
        console.warn(`WARN: BUYBACK_AGENT.setFallbacks skipped: ${e.message}`);
      }
    } catch (e) {
      console.warn(`WARN: BUYBACK_AGENT wiring skipped for ${buybackAgent}: ${e.message}`);
    }
  }
  if (buybackAgent !== ZERO && policy !== ZERO) {
    try {
      const policyContract = await ethers.getContractAt("BiggiPolicy", policy);
      await (await policyContract.setBuybackAgent(buybackAgent)).wait();
    } catch (e) {
      console.warn(`WARN: POLICY.setBuybackAgent skipped: ${e.message}`);
    }
  }

  const shouldDeployDripKeeper = process.env.DEPLOY_DRIP_KEEPER_PROXY === "1" || isLocalNetwork();
  if (dripKeeperProxy === ZERO && shouldDeployDripKeeper) {
    dripKeeperProxy = (await deploy("DripKeeperProxy", [deployer.address])).address;
  }
  if (dripKeeperProxy !== ZERO) {
    const dripProxy = await ethers.getContractAt("DripKeeperProxy", dripKeeperProxy);
    if (dripLm !== ZERO) {
      await (await dripProxy.setDripLM(dripLm)).wait();
    }
    if (process.env.DRIP_KEEPER_ALLOWED !== "0") {
      await (await dripProxy.setKeeper(deployer.address, true)).wait();
    }
  }

  const shouldDeployBuybackProxy = process.env.DEPLOY_BUYBACK_UPKEEP_PROXY === "1" || isLocalNetwork();
  if (buybackUpkeepProxy === ZERO && shouldDeployBuybackProxy) {
    buybackUpkeepProxy = (await deploy("BiggiBuybackUpkeepProxy", [deployer.address])).address;
  }
  if (buybackUpkeepProxy !== ZERO) {
    const upkeepProxy = await ethers.getContractAt("BiggiBuybackUpkeepProxy", buybackUpkeepProxy);
    if (buybackAgent !== ZERO) {
      await (await upkeepProxy.setAgent(buybackAgent)).wait();
      const buybackContract = await ethers.getContractAt("BiggiBuybackAgent", buybackAgent);
      await (await buybackContract.setKeeper(buybackUpkeepProxy)).wait();
      const threshold = process.env.BUYBACK_MIN_NATIVE_WEI || ethers.utils.parseEther("0.5").toString();
      await (await upkeepProxy.setThreshold(threshold)).wait();
    }
    await (await upkeepProxy.setPaused(false)).wait();
  }

  const shouldDeployNftRewards = process.env.DEPLOY_NFT_REWARDS === "1" || isLocalNetwork();
  if (nftRewards === ZERO && shouldDeployNftRewards) {
    nftRewards = (await deploy("BiggiNFTRewards", [deployer.address])).address;
  }
  if (nftRewards !== ZERO) {
    try {
      const nftRewardsContract = await ethers.getContractAt("BiggiNFTRewards", nftRewards);
      try {
        await (await nftRewardsContract.setMainContract(mainCollection.address)).wait();
      } catch (e) {
        console.warn(`WARN: NFT_REWARDS.setMainContract skipped: ${e.message}`);
      }
      if (vrfRouterAddress !== ZERO) {
        try {
          await (await nftRewardsContract.setVrfRouter(vrfRouterAddress)).wait();
        } catch (e) {
          console.warn(`WARN: NFT_REWARDS.setVrfRouter skipped: ${e.message}`);
        }
        try {
          const vrfRouterContract = await ethers.getContractAt("BiggiVRFRouter", vrfRouterAddress);
          await (await vrfRouterContract.setRewardConsumerApproval(nftRewards, true)).wait();
        } catch (e) {
          console.warn(`WARN: VRF_ROUTER.setRewardConsumerApproval skipped: ${e.message}`);
        }
      }
      try {
        await (await nftRewardsContract.setRegistry(registry.address)).wait();
      } catch (e) {
        console.warn(`WARN: NFT_REWARDS.setRegistry skipped: ${e.message}`);
      }
      try {
        await (await nftRewardsContract.setAllowedMainCollection(publicCollection.address, true)).wait();
      } catch (e) {
        console.warn(`WARN: NFT_REWARDS.setAllowedMainCollection skipped: ${e.message}`);
      }
    } catch (e) {
      console.warn(`WARN: NFT_REWARDS wiring skipped for ${nftRewards}: ${e.message}`);
    }
  }

  const shouldDeployMainReader = process.env.DEPLOY_MAIN_READER === "1" || isLocalNetwork();
  if (mainReader === ZERO && shouldDeployMainReader) {
    mainReader = (
      await deploy("BiggiMainReader", [mainCollection.address, ticketHub.address, collectionRewards.address])
    ).address;
  }

  const shouldDeployMultiCollectionReader = process.env.DEPLOY_MULTI_COLLECTION_READER === "1" || isLocalNetwork();
  if (multiCollectionReader === ZERO && shouldDeployMultiCollectionReader) {
    multiCollectionReader = (
      await deploy("BiggiMultiCollectionDistributorReaderV2", [distributor.address])
    ).address;
  }

  const shouldDeployChapterSeriesReader = process.env.DEPLOY_CHAPTER_SERIES_READER === "1" || isLocalNetwork();
  if (chapterSeriesReader === ZERO && shouldDeployChapterSeriesReader) {
    chapterSeriesReader = (
      await deploy("BiggiChapterSeriesReader", [chapterController.address, registry.address])
    ).address;
  }

  const shouldDeployNftRewardsReader = process.env.DEPLOY_NFT_REWARDS_READER === "1" || isLocalNetwork();
  if (nftRewardsReader === ZERO && shouldDeployNftRewardsReader && nftRewards !== ZERO) {
    nftRewardsReader = (await deploy("BiggiNftRewardsReader", [nftRewards])).address;
  }

  const shouldDeployTokenomicReaders = process.env.DEPLOY_TOKENOMIC_READERS === "1" || isLocalNetwork();
  const wantsTokenomicReader = (envName) => process.env[envName] === "1" || shouldDeployTokenomicReaders;

  if (reserveTreasuryReader === ZERO && wantsTokenomicReader("DEPLOY_RESERVE_TREASURY_READER")) {
    reserveTreasuryReader = (await deploy("BiggiReserveTreasuryReader", [reserve.address, treasury.address])).address;
  }
  if (supplyControllerReader === ZERO && wantsTokenomicReader("DEPLOY_SUPPLY_CONTROLLER_READER")) {
    supplyControllerReader = (await deploy("BiggiSupplyControllerReader", [supplyController.address])).address;
  }
  if (supplyGuardianReader === ZERO && wantsTokenomicReader("DEPLOY_SUPPLY_GUARDIAN_READER")) {
    supplyGuardianReader = (await deploy("BiggiSupplyGuardianReader", [supplyGuardian.address])).address;
  }
  if (dexReserveGuardReader === ZERO && wantsTokenomicReader("DEPLOY_DEX_RESERVE_GUARD_READER")) {
    dexReserveGuardReader = (await deploy("BiggiDexReserveGuardReader", [dexReserveGuard.address])).address;
  }
  if (systemReader === ZERO && wantsTokenomicReader("DEPLOY_SYSTEM_READER")) {
    systemReader = (
      await deploy("BiggiSystemReader", [biggiToken.address, supplyController.address, supplyGuardian.address])
    ).address;
  }
  if (
    tokenomicsSystemAddonReader === ZERO &&
    wantsTokenomicReader("DEPLOY_TOKENOMICS_SYSTEM_ADDON_READER")
  ) {
    tokenomicsSystemAddonReader = (
      await deploy("BiggiTokenomicsSystemAddonReader", [masterConfig.address, biggiToken.address])
    ).address;
  }
  if (tokenRewardsReader === ZERO && wantsTokenomicReader("DEPLOY_TOKEN_REWARDS_READER")) {
    tokenRewardsReader = (await deploy("BiggiTokenRewardsReader", [tokenRewards.address])).address;
  }
  if (
    buybackReader === ZERO &&
    wantsTokenomicReader("DEPLOY_BUYBACK_READER") &&
    buybackAgent !== ZERO
  ) {
    buybackReader = (
      await deploy("BiggiBuybackReader", [buybackAgent, treasury.address, policy, buybackUpkeepProxy])
    ).address;
  }
  if (
    liquidityBranchReader === ZERO &&
    wantsTokenomicReader("DEPLOY_LIQUIDITY_BRANCH_READER") &&
    liquidityManager !== ZERO &&
    liquidityVault !== ZERO
  ) {
    liquidityBranchReader = (
      await deploy("BiggiLiquidityBranchUserReader", [reserve.address, liquidityManager, liquidityVault])
    ).address;
  }
  if (
    liquidityHelperReader === ZERO &&
    wantsTokenomicReader("DEPLOY_LIQUIDITY_HELPER_READER") &&
    liquidityManager !== ZERO &&
    liquidityVault !== ZERO &&
    router !== ZERO
  ) {
    liquidityHelperReader = (
      await deploy("BiggiLiquidityHelperReader", [reserve.address, liquidityManager, liquidityVault, router])
    ).address;
  }
  if (
    biggiTokenomicsReader === ZERO &&
    wantsTokenomicReader("DEPLOY_BIGGI_TOKENOMICS_READER") &&
    router !== ZERO &&
    pairAddress !== ZERO
  ) {
    biggiTokenomicsReader = (
      await deploy("BiggiTokenomikReader", [
        biggiToken.address,
        router,
        pairAddress,
        distributor.address,
        buybackAgentEffective,
        reserve.address,
        liquidityManager,
        liquidityVault,
        dripDistributor.address,
        tokenRewards.address,
      ])
    ).address;
  }

  const shouldDeployMulticall = process.env.DEPLOY_MULTICALL === "1" || isLocalNetwork();
  if (multicall === ZERO && shouldDeployMulticall) {
    multicall = (await deploy("Multicall2")).address;
  }

  await (await tokenRewards.setRegistry(registry.address)).wait();
  await (await tokenRewards.setTreasure(treasury.address)).wait();

  try {
    await (await supplyController.snapshotBaseline()).wait();
  } catch (e) {
    console.warn("WARN: supplyController.snapshotBaseline() skipped:", e.message);
  }
  await (await supplyController.setAllowedCaller(dexReserveGuard.address, true)).wait();
  try {
    await (await dexReserveGuard.snapshotBaseline()).wait();
  } catch (e) {
    console.warn("WARN: dexReserveGuard.snapshotBaseline() skipped:", e.message);
  }
  if (dexGuardRefreshPriceAnchor && pairAddress !== ZERO) {
    try {
      await (await dexReserveGuard.refreshPriceAnchor()).wait();
    } catch (e) {
      console.warn("WARN: dexReserveGuard.refreshPriceAnchor() skipped:", e.message);
    }
  }

  await (await masterConfig.setCore(biggiToken.address, reserve.address, treasury.address, distributor.address)).wait();
  await (
    await masterConfig.setRewards(
      collectionRewards.address,
      tokenRewards.address,
      nftRewards,
      communityCenterEffective
    )
  ).wait();
  await (await masterConfig.setPumpBranch(buybackAgent, dripLm, dripDistributor.address, policy)).wait();
  await (
    await masterConfig.setLiquidityBranch(
      liquidityManager,
      liquidityVault,
      router,
      factory,
      weth
    )
  ).wait();
  await (await masterConfig.setSupplyController(supplyController.address)).wait();
  await (await masterConfig.setSupplyGuardian(supplyGuardian.address)).wait();
  await (await masterConfig.setDexReserveGuard(dexReserveGuard.address)).wait();
  await (
    await masterConfig.setCollections(
      mainCollection.address,
      publicCollection.address,
      tokenRewards.address,
      distributor.address
    )
  ).wait();

  const addresses = {
    network: network.name,
    deployer: deployer.address,
    SERIES_ID: 1,
    CHAPTER_ID: chapterId,
    REGISTRY: registry.address,
    CHAPTER_CONTROLLER: chapterController.address,
    COMPUTE: compute.address,
    VRF_ROUTER: vrfRouterAddress,
    MAIN: mainCollection.address,
    MAIN2: publicCollection.address,
    TICKET_HUB: ticketHub.address,
    DISTRIBUTOR: distributor.address,
    COLLECTION_REWARDS: collectionRewards.address,
    BIGGI_TOKEN: biggiToken.address,
    RESERVE: reserve.address,
    TREASURY: treasury.address,
    MARKETING_SUPPORT: marketingSupportFinal,
    DEV_WALLET: devWalletFinal,
    DRIP_DISTRIBUTOR: dripDistributor.address,
    DRIP_LM: dripLm,
    TOKEN_REWARDS: tokenRewards.address,
    TOKEN_REWARDS_EMISSION_CONTROLLER: tokenRewardsEmissionController,
    NFT_REWARDS: nftRewards,
    BUYBACK_AGENT: buybackAgent,
    BUYBACK_ROUTER: buybackRouter,
    BUYBACK_AGENT_EFFECTIVE: buybackAgentEffective,
    POLICY: policy,
    COMMUNITY_CENTER: communityCenter,
    COMMUNITY_CENTER_EFFECTIVE: communityCenterEffective,
    MODERATOR_CENTER: moderatorCenter,
    SUPPLY_CONTROLLER: supplyController.address,
    SUPPLY_GUARDIAN: supplyGuardian.address,
    DEX_RESERVE_GUARD: dexReserveGuard.address,
    MASTER_CONFIG: masterConfig.address,
    LIQUIDITY_MANAGER: liquidityManager,
    LIQUIDITY_VAULT: liquidityVault,
    LIQUIDITY_ORCHESTRATOR: liquidityOrchestrator,
    LIQUIDITY_KEEPER_PROXY: liquidityKeeperProxy,
    LIQUIDITY_AUTOMATION: liquidityAutomation,
    LIQUIDITY_PATH: liquidityPath,
    DRIP_KEEPER_PROXY: dripKeeperProxy,
    BUYBACK_UPKEEP_PROXY: buybackUpkeepProxy,
    MAIN_READER: mainReader,
    MULTI_COLLECTION_READER: multiCollectionReader,
    CHAPTER_SERIES_READER: chapterSeriesReader,
    NFT_REWARDS_READER: nftRewardsReader,
    RESERVE_TREASURY_READER: reserveTreasuryReader,
    BUYBACK_READER: buybackReader,
    LIQUIDITY_BRANCH_READER: liquidityBranchReader,
    LIQUIDITY_HELPER_READER: liquidityHelperReader,
    SUPPLY_CONTROLLER_READER: supplyControllerReader,
    SUPPLY_GUARDIAN_READER: supplyGuardianReader,
    DEX_RESERVE_GUARD_READER: dexReserveGuardReader,
    SYSTEM_READER: systemReader,
    TOKENOMICS_SYSTEM_ADDON_READER: tokenomicsSystemAddonReader,
    BIGGI_TOKENOMICS_READER: biggiTokenomicsReader,
    BIGGI_TOKENOMIK_READER: biggiTokenomicsReader,
    TOKEN_REWARDS_READER: tokenRewardsReader,
    MULTICALL: multicall,
    ROUTER: router,
    FACTORY: factory,
    WETH: weth,
    PAIR: pairAddress,
    QUOTE_TOKEN: quoteTokenAddress,
    MOCK_QUOTE: mockQuote ? mockQuote.address : ZERO,
    MOCK_PAIR: mockPair ? mockPair.address : ZERO,
    MOCK_LIQUIDITY_ROUTER: mockLiquidityRouter ? mockLiquidityRouter.address : ZERO,
    MOCK_LIQUIDITY_FACTORY: mockLiquidityFactory ? mockLiquidityFactory.address : ZERO,
    MOCK_BUYBACK_ROUTER: mockBuybackRouter ? mockBuybackRouter.address : ZERO,
    PARAMS: {
      CIRCUIT_BREAKER_ENABLED: circuitBreakerEnabled,
      CB_DEX_CRITICAL_FLOOR: cbDexCriticalFloor.toString(),
      CB_REWARDS_CRITICAL_FLOOR: cbRewardsCriticalFloor.toString(),

      SUPPLY_DEX_RESERVE_DROP_BPS: supplyDexReserveDropBps,
      SUPPLY_DEX_REFILL_AMOUNT: supplyDexRefillAmount.toString(),
      SUPPLY_DEX_COOLDOWN_SEC: supplyDexCooldownSec,
      SUPPLY_MIN_RESERVE_FLOOR: supplyMinimumReserveFloor.toString(),
      SUPPLY_AUTO_REFRESH_BASELINE: supplyAutoRefreshBaseline,
      SUPPLY_REWARDS_THRESHOLD: supplyRewardsThreshold.toString(),
      SUPPLY_REWARDS_REFILL_AMOUNT: supplyRewardsRefillAmount.toString(),
      SUPPLY_REWARDS_COOLDOWN_SEC: supplyRewardsCooldownSec,

      TOKEN_REWARDS_EMISSION_ENABLED: tokenRewardsEmissionEnabled,
      TOKEN_REWARDS_TARGET_WEEKLY_UNITS: tokenRewardsTargetWeeklyUnits,
      TOKEN_REWARDS_MIN_WEEKLY_BUDGET: tokenRewardsMinWeeklyBudget.toString(),
      TOKEN_REWARDS_WEAK_WEEKLY_BUDGET: tokenRewardsWeakWeeklyBudget.toString(),
      TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET: tokenRewardsNormalWeeklyBudget.toString(),
      TOKEN_REWARDS_STRONG_WEEKLY_BUDGET: tokenRewardsStrongWeeklyBudget.toString(),
      TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET: tokenRewardsEmergencyWeeklyBudget.toString(),
      TOKEN_REWARDS_MAX_WEEKLY_BUDGET: tokenRewardsMaxWeeklyBudget.toString(),
      TOKEN_REWARDS_BALANCE_BUDGET_BPS: tokenRewardsBalanceBudgetBps,
      TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD: tokenRewardsWeakInflowThreshold.toString(),
      TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD: tokenRewardsStrongInflowThreshold.toString(),

      DEX_GUARD_MIN_RESERVE_RATIO_BPS: dexGuardMinReserveRatioBps,
      DEX_GUARD_REFILL_AMOUNT: dexGuardRefillAmount.toString(),
      DEX_GUARD_COOLDOWN_SEC: dexGuardCooldownSec,
      DEX_GUARD_AUTO_REFRESH_BASELINE: dexGuardAutoRefreshBaseline,
      DEX_GUARD_PRICE_CHECK_ENABLED: dexGuardPriceCheckEnabled,
      DEX_GUARD_MAX_DEVIATION_BPS: dexGuardMaxDeviationBps,
      DEX_GUARD_QUOTE_ORACLE: dexGuardQuoteOracle,
      DEX_GUARD_MAX_ORACLE_STALENESS_SEC: dexGuardMaxOracleStalenessSec,
      DEX_GUARD_REQUIRE_QUOTE_ORACLE: dexGuardRequireQuoteOracle,
      DEX_GUARD_REFRESH_PRICE_ANCHOR: dexGuardRefreshPriceAnchor,
      ALLOW_PENDING_PAIR: allowPendingPair,

      POLICY_SWAP_SLIPPAGE_BPS: policySwapSlippageBps,
      POLICY_TX_DEADLINE_SEC: policyTxDeadlineSec,
      POLICY_MIN_BUYBACK_INTERVAL_SEC: policyMinBuybackIntervalSec,
      POLICY_BUYBACKS_PAUSED: policyBuybacksPaused,
      POLICY_MAX_DAILY_BUYBACK_NATIVE: policyMaxDailyBuybackNative.toString(),

      BUYBACK_FALLBACK_SLIPPAGE_BPS: buybackFallbackSlipBps,
      BUYBACK_FALLBACK_DEADLINE_SEC: buybackFallbackDeadlineSec,
      BUYBACK_FALLBACK_COOLDOWN_SEC: buybackFallbackCooldownSec,
    },
  };

  const outPath = path.resolve(__dirname, "../../addresses.master.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("Saved:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
