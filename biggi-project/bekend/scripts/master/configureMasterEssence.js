// Idempotent post-deploy configurator for the BIGGI_MASTER stack.
//
// Default mode is dry-run. Use --execute only after the dry-run and strict
// status check show the intended actions.
//
// Usage:
//   node scripts/master/runConfigureMaster.js --network <net>
//   node scripts/master/runConfigureMaster.js --network <net> --execute --require-code
//
// Useful env:
//   MASTER_ADDRESSES_FILE, CONFIGURE_EXECUTE=1, CONFIGURE_STRICT=1, CONFIGURE_REQUIRE_CODE=1
//   EXPECT_LIQUIDITY_PATH=keeper_proxy|automation|none

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const BYTES32_ZERO = ethers.constants.HashZero;

const ABI = {
  MAIN: [
    "function ticketHub() view returns (address)",
    "function compute() view returns (address)",
    "function vrfRouter() view returns (address)",
    "function setModules(address compute_, address vrfRouter_) external",
    "function setTicketHub(address hub) external",
  ],
  VRF_ROUTER: [
    "function main() view returns (address)",
    "function approvedMains(address) view returns (bool)",
    "function approvedRewardConsumers(address) view returns (bool)",
    "function keyHash() view returns (bytes32)",
    "function subId() view returns (uint256)",
    "function callbackGasLimit() view returns (uint32)",
    "function requestConfirmations() view returns (uint16)",
    "function numWords() view returns (uint32)",
    "function setMain(address main_) external",
    "function setMainApproval(address main_, bool approved) external",
    "function setRewardConsumerApproval(address consumer, bool approved) external",
    "function setVrfParams(bytes32 keyHash_, uint256 subId_, uint32 gas_, uint16 conf_, uint32 numWords_) external",
  ],
  MAIN2: [
    "function distributor() view returns (address)",
    "function priceProvider() view returns (address)",
    "function chapterController() view returns (address)",
    "function chapterId() view returns (uint256)",
    "function devWallet() view returns (address)",
    "function BIGGI() view returns (address)",
    "function reserveAddress() view returns (address)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
    "function setDistributor(address dist) external",
    "function setDevWallet(address wallet_) external",
    "function setPriceProvider(address provider_) external",
    "function setChapterController(address controller_, uint256 chapterId_) external",
    "function setBiggiToken(address token) external",
    "function setReserveAddress(address _reserve) external",
    "function setTokenSink(address sink, uint256 bps) external",
    "function setTokenSinkDepositMode(bool enabled) external",
  ],
  TICKET_HUB: [
    "function mainCollection() view returns (address)",
    "function distributor() view returns (address)",
    "function devWallet() view returns (address)",
    "function BIGGI() view returns (address)",
    "function reserveAddress() view returns (address)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
    "function saleCap() view returns (uint16)",
    "function marketingCap() view returns (uint16)",
    "function setMainCollection(address main_) external",
    "function setDevWallet(address wallet_) external",
    "function setTicketCaps(uint16 saleCap_, uint16 marketingCap_) external",
    "function setDistributor(address dist) external",
    "function setBiggiToken(address token) external",
    "function setReserveAddress(address _reserve) external",
    "function setTokenSink(address sink, uint256 bps) external",
    "function setTokenSinkDepositMode(bool enabled) external",
  ],
  REGISTRY: [
    "function seriesCount() view returns (uint256)",
    "function chapterCount() view returns (uint256)",
    "function chapterByCollection(address collection) view returns (uint256)",
    "function getChapterCollections(uint256 chapterId) view returns (address vrfCollection, address publicCollection, address ticketHub)",
    "function getChapterMeta(uint256 chapterId) view returns (uint256 seriesId, uint256 chapterNumber)",
    "function isTokenRewardsCollection(address collection) view returns (bool)",
    "function isCollectionRewardsCollection(address collection) view returns (bool)",
    "function createSeries(string calldata name) external returns (uint256 seriesId)",
    "function createChapter(uint256 seriesId) external returns (uint256 chapterId)",
    "function setChapterCollections(uint256 chapterId, address vrfCollection, address publicCollection, address ticketHub) external",
    "function setRewardsEligibility(uint256 chapterId, bool tokenRewardsVRF, bool tokenRewardsPublic, bool collectionRewardsVRF) external",
  ],
  CHAPTER_CONTROLLER: [
    "function chapterConfig(uint256 chapterId) view returns (bool exists, uint16 saleCap, uint16 marketingCap, uint16 totalCap)",
    "function getChapterCollections(uint256 chapterId) view returns (address vrfCollection, address publicCollection, address ticketHub)",
    "function isChapterStackConsistent(uint256 chapterId) view returns (bool)",
    "function isChapterCapConsistent(uint256 chapterId) view returns (bool)",
    "function configureChapter(uint256 chapterId, uint256 seriesId, address vrfCollection, address publicCollection, address ticketHub, uint16 saleCap, uint16 marketingCap, uint16 totalCap) external",
  ],
  COLLECTION_REWARDS: [
    "function defaultMain() view returns (address)",
    "function registry() view returns (address)",
    "function distributor() view returns (address)",
    "function setMain(address main_) external",
    "function setRegistry(address registry_) external",
    "function setDistributor(address d) external",
  ],
  DISTRIBUTOR: [
    "function collectionRewards() view returns (address)",
    "function reserve() view returns (address)",
    "function buybackAgent() view returns (address)",
    "function treasury() view returns (address)",
    "function communityCenter() view returns (address)",
    "function registry() view returns (address)",
    "function collections(address) view returns (bool)",
    "function addCollection(address coll) external",
    "function setRegistry(address registry_) external",
    "function setCollectionRewards(address addr) external",
    "function setReserve(address addr) external",
    "function setBuybackAgent(address addr) external",
    "function setTreasury(address addr) external",
    "function setCommunityCenter(address addr) external",
  ],
  TOKEN_REWARDS: [
    "function treasure() view returns (address)",
    "function registry() view returns (address)",
    "function emissionController() view returns (address)",
    "function emissionControllerEnabled() view returns (bool)",
    "function isAllowedCollection(address coll) view returns (bool)",
    "function isRegistryModeEnabled() view returns (bool)",
    "function setTreasure(address treasure_) external",
    "function setRegistry(address registry_) external",
    "function setEmissionController(address controller, bool enabled) external",
    "function setEmissionControllerEnabled(bool enabled) external",
    "function setCollectionAllowed(address coll, bool allowed) external",
  ],
  TOKEN_REWARDS_EMISSION_CONTROLLER: [
    "function tokenRewards() view returns (address)",
    "function treasury() view returns (address)",
    "function targetWeeklyUnits() view returns (uint256)",
    "function minWeeklyBudget() view returns (uint256)",
    "function weakWeeklyBudget() view returns (uint256)",
    "function normalWeeklyBudget() view returns (uint256)",
    "function strongWeeklyBudget() view returns (uint256)",
    "function emergencyWeeklyBudget() view returns (uint256)",
    "function maxWeeklyBudget() view returns (uint256)",
    "function balanceBudgetBps() view returns (uint256)",
    "function weakInflowThreshold() view returns (uint256)",
    "function strongInflowThreshold() view returns (uint256)",
    "function setTokenRewards(address tokenRewards_) external",
    "function setTreasury(address treasury_) external",
    "function setTargetWeeklyUnits(uint256 units) external",
    "function setBudgetConfig(uint256,uint256,uint256,uint256,uint256,uint256,uint256) external",
    "function setInflowThresholds(uint256,uint256) external",
  ],
  NFT_REWARDS: [
    "function mainContract() view returns (address)",
    "function vrfRouter() view returns (address)",
    "function registry() view returns (address)",
    "function allowedMainCollections(address coll) view returns (bool)",
    "function setMainContract(address main_) external",
    "function setVrfRouter(address router_) external",
    "function setRegistry(address registry_) external",
    "function setAllowedMainCollection(address collection, bool approved) external",
  ],
  BIGGI_TOKEN: [
    "function reserveAddr() view returns (address)",
    "function dripDistributorAddr() view returns (address)",
    "function tokenRewardsAddr() view returns (address)",
    "function marketingSupportAddr() view returns (address)",
    "function supplyController() view returns (address)",
    "function supplyGuardian() view returns (address)",
    "function distributed() view returns (bool)",
    "function reserveLocked() view returns (bool)",
    "function setReserve(address _reserve) external",
    "function setDripDistributor(address _drip) external",
    "function setTokenRewards(address _rewards) external",
    "function setMarketingSupport(address _marketingSupport) external",
    "function setSupplyController(address controller) external",
    "function setSupplyGuardian(address g) external",
    "function initialDistribute() external",
  ],
  RESERVE: [
    "function liquidityManager() view returns (address)",
    "function distributor() view returns (address)",
    "function notifyCallerCheckEnabled() view returns (bool)",
    "function notifyCallers(address caller) view returns (bool)",
    "function setLiquidityManager(address lm) external",
    "function setDistributor(address d) external",
    "function setNotifyCaller(address caller, bool allowed) external",
    "function setNotifyCallerCheck(bool enabled) external",
  ],
  TREASURY: [
    "function distributor() view returns (address)",
    "function buybackAgent() view returns (address)",
    "function tokenRewards() view returns (address)",
    "function reserveAddr() view returns (address)",
    "function dripDistributor() view returns (address)",
    "function ecosystemBiggiCallers(address caller) view returns (bool)",
    "function setDistributor(address d) external",
    "function setBuybackAgent(address b) external",
    "function setTokenRewards(address r) external",
    "function setReserve(address r) external",
    "function setDripDistributor(address d) external",
    "function setEcosystemBiggiCaller(address caller, bool allowed) external",
  ],
  DRIP_DISTRIBUTOR: [
    "function dripLM() view returns (address)",
    "function treasury() view returns (address)",
    "function tokensPerMintOperator() view returns (address)",
    "function tokensPerMint() view returns (uint256)",
    "function collections(address) view returns (bool)",
    "function setCollection(address coll, bool allowed) external",
    "function setDripLM(address lm) external",
    "function setTreasury(address t) external",
    "function setTokensPerMintOperator(address op) external",
    "function setTokensPerMint(uint256 v) external",
  ],
  SUPPLY_CONTROLLER: [
    "function pair() view returns (address)",
    "function reserveDropBps() view returns (uint256)",
    "function dexRefillAmount() view returns (uint256)",
    "function dexCooldown() view returns (uint256)",
    "function minimumReserveFloor() view returns (uint256)",
    "function autoRefreshBaselineOnDexRefill() view returns (bool)",
    "function rewardsThreshold() view returns (uint256)",
    "function rewardsRefillAmount() view returns (uint256)",
    "function rewardsCooldown() view returns (uint256)",
    "function circuitBreakerEnabled() view returns (bool)",
    "function dexCriticalFloor() view returns (uint256)",
    "function rewardsCriticalFloor() view returns (uint256)",
    "function keepers(address) view returns (bool)",
    "function allowedCallers(address) view returns (bool)",
    "function setKeeper(address keeper, bool allowed) external",
    "function setAllowedCaller(address caller, bool allowed) external",
    "function setPair(address pair_) external",
    "function setDexConfig(uint256 reserveDropBps_, uint256 dexRefillAmount_, uint256 dexCooldown_, uint256 minimumReserveFloor_, bool autoRefreshBaseline_) external",
    "function setRewardsConfig(uint256 rewardsThreshold_, uint256 rewardsRefillAmount_, uint256 rewardsCooldown_) external",
    "function setCircuitBreakerConfig(bool enabled, uint256 dexCriticalFloor_, uint256 rewardsCriticalFloor_) external",
    "function snapshotBaseline() external",
  ],
  SUPPLY_GUARDIAN: [
    "function controller() view returns (address)",
    "function setController(address controller_) external",
  ],
  DEX_RESERVE_GUARD: [
    "function pair() view returns (address)",
    "function quoteToken() view returns (address)",
    "function quoteOracle() view returns (address)",
    "function minReserveRatioBps() view returns (uint256)",
    "function refillAmount() view returns (uint256)",
    "function cooldown() view returns (uint256)",
    "function autoRefreshBaselineOnRefill() view returns (bool)",
    "function priceCheckEnabled() view returns (bool)",
    "function maxPriceDeviationBps() view returns (uint256)",
    "function maxOracleStaleness() view returns (uint256)",
    "function requireQuoteOracleForPriceCheck() view returns (bool)",
    "function keepers(address) view returns (bool)",
    "function setKeeper(address keeper, bool allowed) external",
    "function setPair(address pair_) external",
    "function setQuoteToken(address quoteToken_) external",
    "function setQuoteOracle(address oracle_) external",
    "function setQuoteOracleConfig(uint256 maxStalenessSec, bool requireOracle) external",
    "function setReserveRatioBps(uint256 ratioBps) external",
    "function setRefillAmount(uint256 amount) external",
    "function setCooldown(uint256 cooldownSec) external",
    "function setAutoRefreshBaselineOnRefill(bool enabled) external",
    "function setPriceCheckConfig(bool enabled, uint256 deviationBps) external",
    "function snapshotBaseline() external",
  ],
  POLICY: [
    "function swapSlippageBps() view returns (uint256)",
    "function txDeadlineSec() view returns (uint256)",
    "function minBuybackInterval() view returns (uint256)",
    "function buybacksPaused() view returns (bool)",
    "function maxDailyBuybackNative() view returns (uint256)",
    "function buybackAgent() view returns (address)",
    "function setSwapSlippageBps(uint256 newBps) external",
    "function setTxDeadlineSec(uint256 newDeadline) external",
    "function setMinBuybackInterval(uint256 newInterval) external",
    "function setBuybacksPaused(bool paused_) external",
    "function setMaxDailyBuybackNative(uint256 newMax) external",
    "function setBuybackAgent(address agent) external",
  ],
  BUYBACK_AGENT: [
    "function router() view returns (address)",
    "function treasury() view returns (address)",
    "function policy() view returns (address)",
    "function dripLM() view returns (address)",
    "function distributor() view returns (address)",
    "function keeper() view returns (address)",
    "function fallbackSwapSlippageBps() view returns (uint256)",
    "function fallbackTxDeadlineSec() view returns (uint256)",
    "function fallbackMinIntervalSec() view returns (uint256)",
    "function setRouter(address router_) external",
    "function setTreasury(address treasury_) external",
    "function setPolicy(address policy_) external",
    "function setDripLM(address dripLM_) external",
    "function setDistributor(address distributor_) external",
    "function setKeeper(address keeper_) external",
    "function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external",
  ],
  DRIP_LM: [
    "function router() view returns (address)",
    "function dripDistributor() view returns (address)",
    "function reserve() view returns (address)",
    "function buybackAgent() view returns (address)",
    "function moderatorCenter() view returns (address)",
    "function sellPct() view returns (uint8)",
    "function slippageBps() view returns (uint256)",
    "function txDeadlineSec() view returns (uint256)",
    "function reserveShareBps() view returns (uint16)",
    "function moderatorShareBps() view returns (uint16)",
    "function setRouter(address r) external",
    "function setDripDistributor(address d) external",
    "function setReserve(address r) external",
    "function setBuybackAgent(address a) external",
    "function setModeratorCenter(address m) external",
    "function setSellPct(uint8 pct) external",
    "function setShares(uint16 reserveBps_, uint16 moderatorBps_) external",
    "function setSlippageBps(uint256 bps) external",
    "function setTxDeadlineSec(uint256 sec_) external",
  ],
  LIQUIDITY_MANAGER: [
    "function router() view returns (address)",
    "function factory() view returns (address)",
    "function reserve() view returns (address)",
    "function liquidityVault() view returns (address)",
    "function keeper() view returns (address)",
    "function tokenPct() view returns (uint8)",
    "function slippageBps() view returns (uint256)",
    "function txDeadlineSec() view returns (uint256)",
    "function autoTopUpEnabled() view returns (bool)",
    "function autoTriggerMinPolWei() view returns (uint256)",
    "function autoRequestPolWei() view returns (uint256)",
    "function setRouter(address r) external",
    "function setFactory(address f) external",
    "function setReserve(address r) external",
    "function setLiquidityVault(address v) external",
    "function setKeeper(address k) external",
    "function setTokenPct(uint8 pct) external",
    "function setSlippageBps(uint256 bps) external",
    "function setTxDeadlineSec(uint256 sec_) external",
    "function setAutoTopUpConfig(bool enabled, uint256 triggerMinPolWei, uint256 requestPolWei) external",
  ],
  LIQUIDITY_VAULT: [
    "function liquidityManager() view returns (address)",
    "function whitelistedPairs(address) view returns (bool)",
    "function setLiquidityManager(address lm) external",
    "function addWhitelistedPair(address lpPair) external",
  ],
  LIQUIDITY_ORCHESTRATOR: [
    "function reserve() view returns (address)",
    "function lm() view returns (address)",
    "function keeper() view returns (address)",
    "function minPolPerTx() view returns (uint256)",
    "function maxPolPerTx() view returns (uint256)",
    "function minDexRefillBiggi() view returns (uint256)",
    "function cooldownSec() view returns (uint256)",
    "function dailyQuotaPol() view returns (uint256)",
    "function setKeeper(address k) external",
    "function setReserve(address r) external",
    "function setLM(address l) external",
    "function setLimits(uint256 minPolPerTx_, uint256 maxPolPerTx_, uint256 minDexRefillBiggi_, uint256 cooldownSec_, uint256 dailyQuotaPol_) external",
  ],
  LIQUIDITY_KEEPER_PROXY: [
    "function orchestrator() view returns (address)",
    "function reserve() view returns (address)",
    "function allowedCaller() view returns (address)",
    "function amountMode() view returns (uint8)",
    "function fixedAmount() view returns (uint256)",
    "function percentBps() view returns (uint256)",
    "function minIntervalSec() view returns (uint256)",
    "function minReservePol() view returns (uint256)",
    "function maxPerTx() view returns (uint256)",
    "function minDexRefillBiggi() view returns (uint256)",
    "function setOrchestrator(address o) external",
    "function setReserve(address r) external",
    "function setAllowedCaller(address a) external",
    "function setStrategy(uint8 mode, uint256 fixedAmount_, uint256 percentBps_) external",
    "function setLimits(uint256 minIntervalSec_, uint256 minReservePol_, uint256 maxPerTx_, uint256 minDexRefillBiggi_) external",
  ],
  LIQUIDITY_AUTOMATION: [
    "function lm() view returns (address)",
    "function minPolWei() view returns (uint256)",
    "function maxPolWei() view returns (uint256)",
    "function minIntervalSec() view returns (uint256)",
    "function setLM(address lm_) external",
    "function setLimits(uint256 minWei, uint256 maxWei) external",
    "function setMinInterval(uint256 sec_) external",
  ],
  DRIP_KEEPER_PROXY: [
    "function dripLM() view returns (address)",
    "function keepers(address) view returns (bool)",
    "function setDripLM(address _dripLM) external",
    "function setKeeper(address who, bool allowed) external",
  ],
  BUYBACK_UPKEEP_PROXY: [
    "function agent() view returns (address)",
    "function minNativeThresholdWei() view returns (uint256)",
    "function paused() view returns (bool)",
    "function setAgent(address a) external",
    "function setThreshold(uint256 t) external",
    "function setPaused(bool p) external",
  ],
  MASTER_CONFIG: [
    "function coreBundle() view returns (address, address, address, address)",
    "function rewardsBundle() view returns (address, address, address, address)",
    "function pumpBundle() view returns (address, address, address, address)",
    "function liquidityBundle() view returns (address, address, address, address, address)",
    "function collectionsBundle() view returns (address, address, address, address)",
    "function supplyController() view returns (address)",
    "function supplyGuardian() view returns (address)",
    "function dexReserveGuard() view returns (address)",
    "function setCore(address biggi, address reserve, address treasury, address distributor) external",
    "function setRewards(address collectionRewards, address tokenRewards, address nftRewards, address communityCenter) external",
    "function setPumpBranch(address buybackAgent, address dripLM, address dripDistributor, address policy) external",
    "function setLiquidityBranch(address liquidityManager, address liquidityVault, address router, address factory, address weth) external",
    "function setSupplyController(address supplyController_) external",
    "function setSupplyGuardian(address supplyGuardian_) external",
    "function setDexReserveGuard(address dexReserveGuard_) external",
    "function setCollections(address collection1, address collection2, address rewardsReader, address distributor) external",
  ],
};

function isAddress(v) {
  try {
    return !!v && ethers.utils.getAddress(v) !== ZERO;
  } catch {
    return false;
  }
}

function toAddr(v) {
  return isAddress(v) ? ethers.utils.getAddress(v) : ZERO;
}

function eqAddress(a, b) {
  return isAddress(a) && isAddress(b) && ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

function sameBn(a, b) {
  return ethers.BigNumber.from(a).eq(ethers.BigNumber.from(b));
}

function display(v) {
  if (v == null) return "<null>";
  if (ethers.BigNumber.isBigNumber(v)) return v.toString();
  if (Array.isArray(v)) return `[${v.map(display).join(", ")}]`;
  return String(v);
}

function parseArgs(argv) {
  const opts = {
    execute: process.env.CONFIGURE_EXECUTE === "1",
    strict: process.env.CONFIGURE_STRICT === "1",
    requireCode: process.env.CONFIGURE_REQUIRE_CODE === "1" || process.env.CHECK_REQUIRE_CODE === "1",
    addressesFile: process.env.MASTER_ADDRESSES_FILE || null,
    expectLiquidityPath: process.env.EXPECT_LIQUIDITY_PATH || process.env.LIQUIDITY_PATH || null,
    report: process.env.CONFIGURE_REPORT || null,
    initialDistribute: process.env.CONFIGURE_INITIAL_DISTRIBUTE === "1",
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a === "--execute") opts.execute = true;
    else if (a === "--dry-run") opts.execute = false;
    else if (a === "--strict") opts.strict = true;
    else if (a === "--require-code") opts.requireCode = true;
    else if (a === "--initial-distribute") opts.initialDistribute = true;
    else if (a === "--addresses" || a === "--addresses-file") {
      if (!argv[i + 1]) throw new Error(`${a} requires a file path`);
      opts.addressesFile = argv[++i];
    } else if (a === "--expect-liquidity-path") {
      if (!argv[i + 1]) throw new Error(`${a} requires keeper_proxy|automation|none`);
      opts.expectLiquidityPath = argv[++i];
    } else if (a === "--report") {
      if (!argv[i + 1]) throw new Error(`${a} requires a file path`);
      opts.report = argv[++i];
    }
  }

  if (opts.expectLiquidityPath) {
    opts.expectLiquidityPath = String(opts.expectLiquidityPath).trim().toLowerCase();
    if (!["keeper_proxy", "automation", "none"].includes(opts.expectLiquidityPath)) {
      throw new Error(`Invalid liquidity path: ${opts.expectLiquidityPath}`);
    }
  }

  return opts;
}

function resolveAddressesPath(explicitPath) {
  if (explicitPath) {
    const p = path.resolve(process.cwd(), explicitPath);
    if (!fs.existsSync(p)) throw new Error(`Addresses file not found: ${p}`);
    return p;
  }

  const masterPath = path.resolve(__dirname, "../../addresses.master.json");
  if (fs.existsSync(masterPath)) return masterPath;

  const legacyPath = path.resolve(__dirname, "../../addresses.json");
  if (fs.existsSync(legacyPath)) return legacyPath;

  throw new Error("Missing addresses file. Expected ./addresses.master.json or ./addresses.json");
}

function pickAddress(raw, keys) {
  let sawRawValue = false;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] != null && raw[key] !== "") {
      sawRawValue = true;
    }
    if (isAddress(raw[key])) return ethers.utils.getAddress(raw[key]);
  }
  if (sawRawValue) return ZERO;
  for (const key of keys) {
    if (process.env[key]) {
      if (!isAddress(process.env[key])) throw new Error(`Invalid address env ${key}: ${process.env[key]}`);
      return ethers.utils.getAddress(process.env[key]);
    }
  }
  return ZERO;
}

function pickNumber(raw, keys, fallback) {
  for (const key of keys) {
    if (process.env[key] != null && process.env[key] !== "") return asIntValue(key, process.env[key]);
  }
  for (const key of keys) {
    if (raw[key] != null && raw[key] !== "") return Number(raw[key]);
  }
  return fallback;
}

function normalizeAddresses(raw) {
  return {
    MAIN: pickAddress(raw, ["MAIN", "COLLECTION", "COLLECTION_VRF"]),
    MAIN2: pickAddress(raw, ["MAIN2", "COLLECTION2", "COLLECTION_PUBLIC"]),
    TICKET_HUB: pickAddress(raw, ["TICKET_HUB"]),
    COMPUTE: pickAddress(raw, ["COMPUTE"]),
    VRF_ROUTER: pickAddress(raw, ["VRF_ROUTER"]),
    REGISTRY: pickAddress(raw, ["REGISTRY"]),
    CHAPTER_CONTROLLER: pickAddress(raw, ["CHAPTER_CONTROLLER"]),
    SERIES_ID: pickNumber(raw, ["SERIES_ID"], 1),
    CHAPTER_ID: pickNumber(raw, ["CHAPTER_ID"], 1),

    BIGGI_TOKEN: pickAddress(raw, ["BIGGI_TOKEN", "BIGGI"]),
    RESERVE: pickAddress(raw, ["RESERVE"]),
    TREASURY: pickAddress(raw, ["TREASURY"]),
    DEV_WALLET: pickAddress(raw, ["DEV_WALLET", "SAFE", "OWNER", "MULTISIG"]),
    MARKETING_SUPPORT: pickAddress(raw, ["MARKETING_SUPPORT", "MARKETING_SUPPORT_WALLET"]),
    DRIP_DISTRIBUTOR: pickAddress(raw, ["DRIP_DISTRIBUTOR"]),
    DRIP_LM: pickAddress(raw, ["DRIP_LM"]),
    TOKEN_REWARDS: pickAddress(raw, ["TOKEN_REWARDS"]),
    TOKEN_REWARDS_EMISSION_CONTROLLER: pickAddress(raw, [
      "TOKEN_REWARDS_EMISSION_CONTROLLER",
      "TOKEN_REWARDS_CONTROLLER",
      "EMISSION_CONTROLLER",
    ]),
    NFT_REWARDS: pickAddress(raw, ["NFT_REWARDS", "BIGGI_NFT_REWARDS"]),
    COLLECTION_REWARDS: pickAddress(raw, ["COLLECTION_REWARDS"]),
    DISTRIBUTOR: pickAddress(raw, ["DISTRIBUTOR", "MULTI_COLLECTION_DISTRIBUTOR"]),
    COMMUNITY_CENTER: pickAddress(raw, ["COMMUNITY_CENTER", "COMMUNITY", "COMMUNITYCENTER"]),
    COMMUNITY_CENTER_EFFECTIVE: pickAddress(raw, [
      "COMMUNITY_CENTER_EFFECTIVE",
      "COMMUNITY_CENTER",
      "COMMUNITY",
      "COMMUNITYCENTER",
    ]),
    MODERATOR_CENTER: pickAddress(raw, ["MODERATOR_CENTER"]),
    BUYBACK_AGENT: pickAddress(raw, ["BUYBACK_AGENT", "BUYBACK"]),
    BUYBACK_AGENT_EFFECTIVE: pickAddress(raw, ["BUYBACK_AGENT_EFFECTIVE", "BUYBACK_AGENT", "BUYBACK"]),
    BUYBACK_ROUTER: pickAddress(raw, ["BUYBACK_ROUTER", "ROUTER"]),
    POLICY: pickAddress(raw, ["POLICY"]),
    MASTER_CONFIG: pickAddress(raw, ["MASTER_CONFIG"]),
    SUPPLY_CONTROLLER: pickAddress(raw, ["SUPPLY_CONTROLLER"]),
    SUPPLY_GUARDIAN: pickAddress(raw, ["SUPPLY_GUARDIAN"]),
    DEX_RESERVE_GUARD: pickAddress(raw, ["DEX_RESERVE_GUARD"]),
    PAIR: pickAddress(raw, ["PAIR"]),
    QUOTE_TOKEN: pickAddress(raw, ["QUOTE_TOKEN"]),
    ROUTER: pickAddress(raw, ["ROUTER"]),
    FACTORY: pickAddress(raw, ["FACTORY"]),
    WETH: pickAddress(raw, ["WETH"]),
    LIQUIDITY_MANAGER: pickAddress(raw, ["LIQUIDITY_MANAGER", "LM"]),
    LIQUIDITY_VAULT: pickAddress(raw, ["LIQUIDITY_VAULT", "LM_VAULT"]),
    LIQUIDITY_ORCHESTRATOR: pickAddress(raw, ["LIQUIDITY_ORCHESTRATOR", "ORCHESTRATOR"]),
    LIQUIDITY_KEEPER_PROXY: pickAddress(raw, ["LIQUIDITY_KEEPER_PROXY", "KEEPER_PROXY"]),
    LIQUIDITY_AUTOMATION: pickAddress(raw, ["LIQUIDITY_AUTOMATION"]),
    DRIP_KEEPER_PROXY: pickAddress(raw, ["DRIP_KEEPER_PROXY"]),
    BUYBACK_UPKEEP_PROXY: pickAddress(raw, ["BUYBACK_UPKEEP_PROXY", "UPKEEP_PROXY"]),
    TOKEN_REWARDS_READER: pickAddress(raw, ["TOKEN_REWARDS_READER"]),
    BIGGI_TOKENOMICS_READER: pickAddress(raw, [
      "BIGGI_TOKENOMICS_READER",
      "BIGGI_TOKENOMIK_READER",
      "TOKENOMICS_READER",
      "TOKENOMIK_READER",
    ]),
  };
}

function isForkedHardhatNetwork() {
  return network.name === "hardhat" && !!(network.config && network.config.forking && network.config.forking.url);
}

function isLocalLikeNetwork() {
  return network.name === "localhost" || (network.name === "hardhat" && !isForkedHardhatNetwork());
}

function asIntValue(name, raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid integer ${name}: ${raw}`);
  return n;
}

function asBoolValue(name, raw) {
  if (raw == null || raw === "") return null;
  const v = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  throw new Error(`Invalid boolean ${name}: ${raw}`);
}

function paramRaw(raw, name) {
  if (process.env[name] != null && process.env[name] !== "") return process.env[name];
  if (raw.PARAMS && raw.PARAMS[name] != null && raw.PARAMS[name] !== "") return raw.PARAMS[name];
  return null;
}

function paramInt(raw, name, fallback) {
  const v = paramRaw(raw, name);
  return v == null ? fallback : asIntValue(name, v);
}

function paramBool(raw, name, fallback) {
  const v = paramRaw(raw, name);
  return v == null ? fallback : asBoolValue(name, v);
}

function paramToken(raw, name, fallbackTokens) {
  if (process.env[name] != null && process.env[name] !== "") {
    return ethers.utils.parseUnits(String(process.env[name]), 18);
  }
  if (raw.PARAMS && raw.PARAMS[name] != null && raw.PARAMS[name] !== "") {
    return ethers.BigNumber.from(raw.PARAMS[name]);
  }
  return ethers.utils.parseUnits(String(fallbackTokens), 18);
}

function paramWei(raw, name, fallbackWei) {
  if (process.env[name] != null && process.env[name] !== "") return ethers.BigNumber.from(process.env[name]);
  if (raw.PARAMS && raw.PARAMS[name] != null && raw.PARAMS[name] !== "") return ethers.BigNumber.from(raw.PARAMS[name]);
  return ethers.BigNumber.from(fallbackWei);
}

function envAddress(name) {
  if (!process.env[name]) return ZERO;
  if (!isAddress(process.env[name])) throw new Error(`Invalid address env ${name}: ${process.env[name]}`);
  return ethers.utils.getAddress(process.env[name]);
}

function envHex32(name) {
  const v = process.env[name];
  if (!v) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${name} must be bytes32`);
  return v;
}

function reportPath(opts) {
  if (opts.report) return path.resolve(process.cwd(), opts.report);
  const outDir = path.resolve(__dirname, "../../reports");
  return path.join(outDir, `master-configure-${network.name}.json`);
}

function tupleEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (typeof e === "string" && e.startsWith("0x") && e.length === 42) {
      try {
        if (ethers.utils.getAddress(a) !== ethers.utils.getAddress(e)) return false;
      } catch {
        return false;
      }
    } else if (ethers.BigNumber.isBigNumber(a) || ethers.BigNumber.isBigNumber(e)) {
      if (!sameBn(a, e)) return false;
    } else if (String(a) !== String(e)) {
      return false;
    }
  }
  return true;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const addressesPath = resolveAddressesPath(opts.addressesFile);
  const raw = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const A = normalizeAddresses(raw);
  const [signer] = await ethers.getSigners();
  if (opts.execute && !signer) {
    throw new Error("Execute mode requires a configured signer");
  }

  const local = isLocalLikeNetwork();
  const productionLike = !local;
  const requireContractCode = opts.requireCode || productionLike;
  const liquidityPath = opts.expectLiquidityPath || String(raw.LIQUIDITY_PATH || "keeper_proxy").toLowerCase();
  const allowDistributorFallback =
    process.env.ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK == null
      ? local
      : asBoolValue("ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK", process.env.ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK);

  const params = {
    saleCap: paramInt(raw, "SALE_CAP", 500),
    marketingCap: paramInt(raw, "MARKETING_CAP", 50),
    totalCap: 550,
    seriesName: process.env.SERIES_NAME || raw.SERIES_NAME || "BIGGI MASTER Series",

    strictNotify: process.env.STRICT_NOTIFY_CALLERS == null
      ? true
      : asBoolValue("STRICT_NOTIFY_CALLERS", process.env.STRICT_NOTIFY_CALLERS),

    circuitBreakerEnabled: paramBool(raw, "CIRCUIT_BREAKER_ENABLED", true),
    cbDexCriticalFloor: paramToken(raw, "CB_DEX_CRITICAL_FLOOR", "500"),
    cbRewardsCriticalFloor: paramToken(raw, "CB_REWARDS_CRITICAL_FLOOR", "500"),
    supplyDexReserveDropBps: paramInt(raw, "SUPPLY_DEX_RESERVE_DROP_BPS", 5000),
    supplyDexRefillAmount: paramToken(raw, "SUPPLY_DEX_REFILL_AMOUNT", "20000000"),
    supplyDexCooldownSec: paramInt(raw, "SUPPLY_DEX_COOLDOWN_SEC", 1800),
    supplyMinimumReserveFloor: paramToken(raw, "SUPPLY_MIN_RESERVE_FLOOR", "0"),
    supplyAutoRefreshBaseline: paramBool(raw, "SUPPLY_AUTO_REFRESH_BASELINE", false),
    supplyRewardsThreshold: paramToken(raw, "SUPPLY_REWARDS_THRESHOLD", "5000000"),
    supplyRewardsRefillAmount: paramToken(raw, "SUPPLY_REWARDS_REFILL_AMOUNT", "200000000"),
    supplyRewardsCooldownSec: paramInt(raw, "SUPPLY_REWARDS_COOLDOWN_SEC", 43200),
    tokenRewardsEmissionEnabled: paramBool(raw, "TOKEN_REWARDS_EMISSION_ENABLED", true),
    tokenRewardsTargetWeeklyUnits: paramInt(raw, "TOKEN_REWARDS_TARGET_WEEKLY_UNITS", 100000),
    tokenRewardsMinWeeklyBudget: paramToken(raw, "TOKEN_REWARDS_MIN_WEEKLY_BUDGET", "50000"),
    tokenRewardsWeakWeeklyBudget: paramToken(raw, "TOKEN_REWARDS_WEAK_WEEKLY_BUDGET", "100000"),
    tokenRewardsNormalWeeklyBudget: paramToken(raw, "TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET", "500000"),
    tokenRewardsStrongWeeklyBudget: paramToken(raw, "TOKEN_REWARDS_STRONG_WEEKLY_BUDGET", "1000000"),
    tokenRewardsEmergencyWeeklyBudget: paramToken(raw, "TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET", "25000"),
    tokenRewardsMaxWeeklyBudget: paramToken(raw, "TOKEN_REWARDS_MAX_WEEKLY_BUDGET", "1000000"),
    tokenRewardsBalanceBudgetBps: paramInt(raw, "TOKEN_REWARDS_BALANCE_BUDGET_BPS", 100),
    tokenRewardsWeakInflowThreshold: paramToken(raw, "TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD", "10000"),
    tokenRewardsStrongInflowThreshold: paramToken(raw, "TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD", "200000"),

    dexGuardMinReserveRatioBps: paramInt(raw, "DEX_GUARD_MIN_RESERVE_RATIO_BPS", 5000),
    dexGuardRefillAmount: paramToken(raw, "DEX_GUARD_REFILL_AMOUNT", "20000000"),
    dexGuardCooldownSec: paramInt(raw, "DEX_GUARD_COOLDOWN_SEC", 1800),
    dexGuardAutoRefreshBaseline: paramBool(raw, "DEX_GUARD_AUTO_REFRESH_BASELINE", true),
    dexGuardPriceCheckEnabled: paramBool(raw, "DEX_GUARD_PRICE_CHECK_ENABLED", false),
    dexGuardMaxDeviationBps: paramInt(raw, "DEX_GUARD_MAX_DEVIATION_BPS", 2000),
    dexGuardQuoteOracle: toAddr(paramRaw(raw, "DEX_GUARD_QUOTE_ORACLE") || envAddress("DEX_GUARD_QUOTE_ORACLE")),
    dexGuardMaxOracleStalenessSec: paramInt(raw, "DEX_GUARD_MAX_ORACLE_STALENESS_SEC", 86400),
    dexGuardRequireQuoteOracle: paramBool(raw, "DEX_GUARD_REQUIRE_QUOTE_ORACLE", false),

    policySwapSlippageBps: paramInt(raw, "POLICY_SWAP_SLIPPAGE_BPS", 500),
    policyTxDeadlineSec: paramInt(raw, "POLICY_TX_DEADLINE_SEC", 600),
    policyMinBuybackIntervalSec: paramInt(raw, "POLICY_MIN_BUYBACK_INTERVAL_SEC", 300),
    policyBuybacksPaused: paramBool(raw, "POLICY_BUYBACKS_PAUSED", false),
    policyMaxDailyBuybackNative: paramToken(raw, "POLICY_MAX_DAILY_BUYBACK_NATIVE", "0"),
    buybackFallbackSlipBps: paramInt(raw, "BUYBACK_FALLBACK_SLIPPAGE_BPS", 200),
    buybackFallbackDeadlineSec: paramInt(raw, "BUYBACK_FALLBACK_DEADLINE_SEC", 600),
    buybackFallbackCooldownSec: paramInt(raw, "BUYBACK_FALLBACK_COOLDOWN_SEC", 300),

    liqTokenPct: paramInt(raw, "LIQ_TOKEN_PCT", 100),
    liqSlippageBps: paramInt(raw, "LIQ_SLIPPAGE_BPS", 300),
    liqDeadlineSec: paramInt(raw, "LIQ_DEADLINE_SEC", 600),
    liqAutoEnabled: paramBool(raw, "LIQ_AUTO_TOP_UP_ENABLED", true),
    liqAutoTriggerMinPolWei: paramToken(raw, "LIQ_AUTO_TRIGGER_MIN_POL", "5"),
    liqAutoRequestPolWei: paramToken(raw, "LIQ_AUTO_REQUEST_POL", "5"),
    liqOrchMinPolPerTx: paramToken(raw, "LIQ_ORCH_MIN_POL_PER_TX", "0.5"),
    liqOrchMaxPolPerTx: paramToken(raw, "LIQ_ORCH_MAX_POL_PER_TX", "50"),
    liqOrchMinDexRefillBiggi: paramToken(raw, "LIQ_ORCH_MIN_DEX_REFILL_BIGGI", "1"),
    liqOrchCooldownSec: paramInt(raw, "LIQ_ORCH_COOLDOWN_SEC", 3600),
    liqOrchDailyQuotaPol: paramToken(raw, "LIQ_ORCH_DAILY_QUOTA_POL", "0"),
    liqKeeperMode: paramInt(raw, "LIQ_KEEPER_MODE", 1),
    liqKeeperFixedPol: paramToken(raw, "LIQ_KEEPER_FIXED_POL", "0.5"),
    liqKeeperPercentBps: paramInt(raw, "LIQ_KEEPER_PERCENT_BPS", 500),
    liqKeeperMinIntervalSec: paramInt(raw, "LIQ_KEEPER_MIN_INTERVAL_SEC", 900),
    liqKeeperMinReservePol: paramToken(raw, "LIQ_KEEPER_MIN_RESERVE_POL", "1"),
    liqKeeperMaxPerTx: paramToken(raw, "LIQ_KEEPER_MAX_PER_TX", "20"),
    liqKeeperMinDexRefillBiggi: paramToken(raw, "LIQ_KEEPER_MIN_DEX_REFILL_BIGGI", "1"),
    liqAutoMinPolWei: paramToken(raw, "LIQ_AUTO_MIN_POL_WEI", "0.5"),
    liqAutoMaxPolWei: paramToken(raw, "LIQ_AUTO_MAX_POL_WEI", "2"),
    liqAutoMinIntervalSec: paramInt(raw, "LIQ_AUTO_MIN_INTERVAL_SEC", 900),
    buybackMinNativeWei: paramWei(raw, "BUYBACK_MIN_NATIVE_WEI", ethers.utils.parseEther("0.5").toString()),
  };

  if (params.saleCap + params.marketingCap !== params.totalCap) {
    throw new Error(`Invalid caps: SALE_CAP + MARKETING_CAP must equal ${params.totalCap}`);
  }

  const buybackRecipient =
    isAddress(A.BUYBACK_AGENT_EFFECTIVE) ? A.BUYBACK_AGENT_EFFECTIVE :
    isAddress(A.BUYBACK_AGENT) ? A.BUYBACK_AGENT :
    allowDistributorFallback ? A.TREASURY : ZERO;
  const communityRecipient =
    isAddress(A.COMMUNITY_CENTER_EFFECTIVE) ? A.COMMUNITY_CENTER_EFFECTIVE :
    isAddress(A.COMMUNITY_CENTER) ? A.COMMUNITY_CENTER :
    allowDistributorFallback ? A.TREASURY : ZERO;
  const marketingSupport = isAddress(A.MARKETING_SUPPORT) ? A.MARKETING_SUPPORT : A.TREASURY;
  const buybackRouter = isAddress(A.BUYBACK_ROUTER) ? A.BUYBACK_ROUTER : A.ROUTER;
  const buybackKeeper = isAddress(envAddress("BUYBACK_KEEPER")) ? envAddress("BUYBACK_KEEPER") : A.BUYBACK_UPKEEP_PROXY;
  const supplyKeeper = envAddress("SUPPLY_KEEPER");
  const dexGuardKeeper = envAddress("DEX_GUARD_KEEPER");
  const dripKeeperAllowed = envAddress("DRIP_KEEPER_ALLOWED");
  const liqKeeperAllowedCaller = envAddress("LIQ_KEEPER_ALLOWED_CALLER");
  const moderatorCenter = isAddress(A.MODERATOR_CENTER) ? A.MODERATOR_CENTER : communityRecipient;
  const rewardsReaderForConfig = A.TOKEN_REWARDS;

  const report = {
    network: network.name,
    signer: signer ? signer.address : null,
    addressesFile: addressesPath,
    execute: opts.execute,
    strict: opts.strict,
    requireContractCode,
    liquidityPath,
    actions: [],
    unchanged: [],
    warnings: [],
    blockers: [],
    errors: [],
  };

  function warn(msg) {
    report.warnings.push(msg);
    console.log(`WARN ${msg}`);
  }

  function block(msg) {
    report.blockers.push(msg);
    console.log(`BLOCKER ${msg}`);
  }

  function unchanged(label) {
    report.unchanged.push(label);
    console.log(`OK ${label}`);
  }

  async function hasCode(addr) {
    if (!isAddress(addr)) return false;
    const code = await ethers.provider.getCode(addr);
    return code && code !== "0x";
  }

  async function validateContractAddress(label, addr, required) {
    if (!isAddress(addr)) {
      if (required) block(`${label}: missing address`);
      return false;
    }
    if (!(await hasCode(addr))) {
      const msg = `${label}: no deployed code at ${addr} on ${network.name}`;
      if (requireContractCode || required) block(msg);
      else warn(msg);
      return false;
    }
    return true;
  }

  async function attach(label, addr, abi, required = false) {
    const ok = await validateContractAddress(label, addr, required);
    if (!ok) return null;
    return new ethers.Contract(addr, abi, signer || ethers.provider);
  }

  async function change(label, txFactory) {
    report.actions.push(label);
    if (!opts.execute) {
      console.log(`[DRY] ${label}`);
      return;
    }
    console.log(`[TX] ${label}`);
    try {
      const tx = await txFactory();
      console.log(`     hash=${tx.hash}`);
      await tx.wait();
    } catch (e) {
      const msg = `${label}: ${e.message}`;
      report.errors.push(msg);
      console.log(`ERROR ${msg}`);
    }
  }

  async function read(label, fn) {
    try {
      return await fn();
    } catch (e) {
      const msg = `${label}: ${e.message}`;
      report.errors.push(msg);
      console.log(`ERROR ${msg}`);
      return null;
    }
  }

  async function ensureAddress(label, getter, expected, txFactory) {
    if (!isAddress(expected)) {
      warn(`${label}: expected address not set, skipping`);
      return;
    }
    const actual = await read(label, getter);
    if (actual == null) return;
    if (eqAddress(actual, expected)) unchanged(`${label} == ${expected}`);
    else await change(`${label}: ${actual} -> ${expected}`, txFactory);
  }

  async function ensureBool(label, getter, expected, txFactory) {
    const actual = await read(label, getter);
    if (actual == null) return;
    if (Boolean(actual) === Boolean(expected)) unchanged(`${label} == ${expected}`);
    else await change(`${label}: ${Boolean(actual)} -> ${Boolean(expected)}`, txFactory);
  }

  async function ensureUint(label, getter, expected, txFactory) {
    const actual = await read(label, getter);
    if (actual == null) return;
    if (sameBn(actual, expected)) unchanged(`${label} == ${display(expected)}`);
    else await change(`${label}: ${display(actual)} -> ${display(expected)}`, txFactory);
  }

  async function ensureTuple(label, getter, expected, txFactory) {
    const actual = await read(label, getter);
    if (actual == null) return;
    const arr = Array.from(actual);
    if (tupleEqual(arr, expected)) unchanged(`${label} == ${display(expected)}`);
    else await change(`${label}: ${display(arr)} -> ${display(expected)}`, txFactory);
  }

  async function ensureCollection(label, c, collection) {
    if (!c || !isAddress(collection)) return;
    const allowed = await read(`${label}.collections(${collection})`, () => c.collections(collection));
    if (allowed == null) return;
    if (allowed) unchanged(`${label}.collections(${collection}) == true`);
    else await change(`${label}.addCollection(${collection})`, () => c.addCollection(collection));
  }

  async function ensureAllowedCollection(label, c, collection) {
    if (!c || !isAddress(collection)) return;
    const allowed = await read(`${label}.isAllowedCollection(${collection})`, () => c.isAllowedCollection(collection));
    if (allowed == null) return;
    if (allowed) unchanged(`${label}.collection(${collection}) eligible`);
    else await change(`${label}.setCollectionAllowed(${collection}, true)`, () => c.setCollectionAllowed(collection, true));
  }

  const alwaysRequired = [
    ["MAIN", A.MAIN],
    ["MAIN2", A.MAIN2],
    ["TICKET_HUB", A.TICKET_HUB],
    ["COMPUTE", A.COMPUTE],
    ["REGISTRY", A.REGISTRY],
    ["CHAPTER_CONTROLLER", A.CHAPTER_CONTROLLER],
    ["DISTRIBUTOR", A.DISTRIBUTOR],
    ["COLLECTION_REWARDS", A.COLLECTION_REWARDS],
    ["BIGGI_TOKEN", A.BIGGI_TOKEN],
    ["RESERVE", A.RESERVE],
    ["TREASURY", A.TREASURY],
    ["DRIP_DISTRIBUTOR", A.DRIP_DISTRIBUTOR],
    ["TOKEN_REWARDS", A.TOKEN_REWARDS],
    ["SUPPLY_CONTROLLER", A.SUPPLY_CONTROLLER],
    ["SUPPLY_GUARDIAN", A.SUPPLY_GUARDIAN],
    ["DEX_RESERVE_GUARD", A.DEX_RESERVE_GUARD],
    ["MASTER_CONFIG", A.MASTER_CONFIG],
  ];

  for (const [label, addr] of alwaysRequired) {
    await validateContractAddress(label, addr, true);
  }

  if (productionLike || opts.strict) {
    await validateContractAddress("VRF_ROUTER", A.VRF_ROUTER, true);
    await validateContractAddress("PAIR", A.PAIR, true);
    await validateContractAddress("QUOTE_TOKEN", A.QUOTE_TOKEN, true);
    await validateContractAddress("BUYBACK_AGENT_EFFECTIVE", buybackRecipient, true);
    await validateContractAddress("COMMUNITY_CENTER_EFFECTIVE", communityRecipient, true);
    if (liquidityPath !== "none") {
      await validateContractAddress("LIQUIDITY_MANAGER", A.LIQUIDITY_MANAGER, true);
      await validateContractAddress("LIQUIDITY_VAULT", A.LIQUIDITY_VAULT, true);
      if (liquidityPath === "keeper_proxy") {
        await validateContractAddress("LIQUIDITY_ORCHESTRATOR", A.LIQUIDITY_ORCHESTRATOR, true);
        await validateContractAddress("LIQUIDITY_KEEPER_PROXY", A.LIQUIDITY_KEEPER_PROXY, true);
      }
      if (liquidityPath === "automation") {
        await validateContractAddress("LIQUIDITY_AUTOMATION", A.LIQUIDITY_AUTOMATION, true);
      }
    }
  }

  if (opts.execute && report.blockers.length > 0) {
    throw new Error(`Aborting execute mode because ${report.blockers.length} blocker(s) were found.`);
  }

  console.log("Network:", network.name);
  console.log("Signer:", signer ? signer.address : "read-only provider");
  console.log("Addresses file:", addressesPath);
  console.log("Mode:", opts.execute ? "EXECUTE" : "DRY-RUN");
  console.log("Liquidity path:", liquidityPath);

  const main = await attach("MAIN", A.MAIN, ABI.MAIN, true);
  const vrf = await attach("VRF_ROUTER", A.VRF_ROUTER, ABI.VRF_ROUTER, false);
  const main2 = await attach("MAIN2", A.MAIN2, ABI.MAIN2, true);
  const ticketHub = await attach("TICKET_HUB", A.TICKET_HUB, ABI.TICKET_HUB, true);
  const registry = await attach("REGISTRY", A.REGISTRY, ABI.REGISTRY, true);
  const chapterController = await attach("CHAPTER_CONTROLLER", A.CHAPTER_CONTROLLER, ABI.CHAPTER_CONTROLLER, true);
  const collectionRewards = await attach("COLLECTION_REWARDS", A.COLLECTION_REWARDS, ABI.COLLECTION_REWARDS, true);
  const distributor = await attach("DISTRIBUTOR", A.DISTRIBUTOR, ABI.DISTRIBUTOR, true);
  const tokenRewards = await attach("TOKEN_REWARDS", A.TOKEN_REWARDS, ABI.TOKEN_REWARDS, true);
  const tokenRewardsEmissionController = await attach(
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    A.TOKEN_REWARDS_EMISSION_CONTROLLER,
    ABI.TOKEN_REWARDS_EMISSION_CONTROLLER,
    false
  );
  const nftRewards = await attach("NFT_REWARDS", A.NFT_REWARDS, ABI.NFT_REWARDS, false);
  const biggiToken = await attach("BIGGI_TOKEN", A.BIGGI_TOKEN, ABI.BIGGI_TOKEN, true);
  const reserve = await attach("RESERVE", A.RESERVE, ABI.RESERVE, true);
  const treasury = await attach("TREASURY", A.TREASURY, ABI.TREASURY, true);
  const dripDistributor = await attach("DRIP_DISTRIBUTOR", A.DRIP_DISTRIBUTOR, ABI.DRIP_DISTRIBUTOR, true);
  const supplyController = await attach("SUPPLY_CONTROLLER", A.SUPPLY_CONTROLLER, ABI.SUPPLY_CONTROLLER, true);
  const supplyGuardian = await attach("SUPPLY_GUARDIAN", A.SUPPLY_GUARDIAN, ABI.SUPPLY_GUARDIAN, true);
  const dexGuard = await attach("DEX_RESERVE_GUARD", A.DEX_RESERVE_GUARD, ABI.DEX_RESERVE_GUARD, true);
  const policy = await attach("POLICY", A.POLICY, ABI.POLICY, false);
  const buyback = await attach("BUYBACK_AGENT", A.BUYBACK_AGENT, ABI.BUYBACK_AGENT, false);
  const dripLm = await attach("DRIP_LM", A.DRIP_LM, ABI.DRIP_LM, false);
  const lm = await attach("LIQUIDITY_MANAGER", A.LIQUIDITY_MANAGER, ABI.LIQUIDITY_MANAGER, false);
  const vault = await attach("LIQUIDITY_VAULT", A.LIQUIDITY_VAULT, ABI.LIQUIDITY_VAULT, false);
  const orchestrator = await attach("LIQUIDITY_ORCHESTRATOR", A.LIQUIDITY_ORCHESTRATOR, ABI.LIQUIDITY_ORCHESTRATOR, false);
  const keeperProxy = await attach("LIQUIDITY_KEEPER_PROXY", A.LIQUIDITY_KEEPER_PROXY, ABI.LIQUIDITY_KEEPER_PROXY, false);
  const automation = await attach("LIQUIDITY_AUTOMATION", A.LIQUIDITY_AUTOMATION, ABI.LIQUIDITY_AUTOMATION, false);
  const dripKeeperProxy = await attach("DRIP_KEEPER_PROXY", A.DRIP_KEEPER_PROXY, ABI.DRIP_KEEPER_PROXY, false);
  const buybackUpkeepProxy = await attach("BUYBACK_UPKEEP_PROXY", A.BUYBACK_UPKEEP_PROXY, ABI.BUYBACK_UPKEEP_PROXY, false);
  const masterConfig = await attach("MASTER_CONFIG", A.MASTER_CONFIG, ABI.MASTER_CONFIG, true);

  if (opts.execute && report.blockers.length > 0) {
    throw new Error(`Aborting execute mode because ${report.blockers.length} blocker(s) were found after address/code validation.`);
  }

  if (main) {
    await ensureAddress("MAIN.ticketHub", () => main.ticketHub(), A.TICKET_HUB, () => main.setTicketHub(A.TICKET_HUB));
    const currentCompute = await read("MAIN.compute", () => main.compute());
    const currentVrf = await read("MAIN.vrfRouter", () => main.vrfRouter());
    const targetVrf = isAddress(A.VRF_ROUTER) ? A.VRF_ROUTER : (isAddress(currentVrf) ? currentVrf : ZERO);
    if (currentCompute != null && currentVrf != null) {
      if (eqAddress(currentCompute, A.COMPUTE) && (!isAddress(A.VRF_ROUTER) || eqAddress(currentVrf, A.VRF_ROUTER))) {
        unchanged("MAIN.modules");
      } else {
        await change(
          `MAIN.setModules(compute=${A.COMPUTE}, vrf=${targetVrf})`,
          () => main.setModules(A.COMPUTE, targetVrf)
        );
      }
    }
  }

  if (ticketHub) {
    await ensureAddress("TICKET_HUB.mainCollection", () => ticketHub.mainCollection(), A.MAIN, () => ticketHub.setMainCollection(A.MAIN));
    await ensureAddress("TICKET_HUB.distributor", () => ticketHub.distributor(), A.DISTRIBUTOR, () => ticketHub.setDistributor(A.DISTRIBUTOR));
    await ensureUint("TICKET_HUB.saleCap", () => ticketHub.saleCap(), params.saleCap, () => ticketHub.setTicketCaps(params.saleCap, params.marketingCap));
    await ensureUint("TICKET_HUB.marketingCap", () => ticketHub.marketingCap(), params.marketingCap, () => ticketHub.setTicketCaps(params.saleCap, params.marketingCap));
    await ensureAddress("TICKET_HUB.BIGGI", () => ticketHub.BIGGI(), A.BIGGI_TOKEN, () => ticketHub.setBiggiToken(A.BIGGI_TOKEN));
    await ensureAddress("TICKET_HUB.reserveAddress", () => ticketHub.reserveAddress(), A.RESERVE, () => ticketHub.setReserveAddress(A.RESERVE));
    if (isAddress(A.DEV_WALLET)) {
      await ensureAddress("TICKET_HUB.devWallet", () => ticketHub.devWallet(), A.DEV_WALLET, () => ticketHub.setDevWallet(A.DEV_WALLET));
    }
    await ensureAddress("TICKET_HUB.tokenSink", () => ticketHub.tokenSink(), A.TREASURY, () => ticketHub.setTokenSink(A.TREASURY, 10000));
    await ensureUint("TICKET_HUB.tokenSinkBps", () => ticketHub.tokenSinkBps(), 10000, () => ticketHub.setTokenSink(A.TREASURY, 10000));
    await ensureBool("TICKET_HUB.tokenSinkDepositMode", () => ticketHub.tokenSinkDepositMode(), true, () => ticketHub.setTokenSinkDepositMode(true));
  }

  if (main2) {
    await ensureAddress("MAIN2.distributor", () => main2.distributor(), A.DISTRIBUTOR, () => main2.setDistributor(A.DISTRIBUTOR));
    await ensureAddress("MAIN2.priceProvider", () => main2.priceProvider(), A.MAIN, () => main2.setPriceProvider(A.MAIN));
    await ensureAddress("MAIN2.BIGGI", () => main2.BIGGI(), A.BIGGI_TOKEN, () => main2.setBiggiToken(A.BIGGI_TOKEN));
    await ensureAddress("MAIN2.reserveAddress", () => main2.reserveAddress(), A.RESERVE, () => main2.setReserveAddress(A.RESERVE));
    if (isAddress(A.DEV_WALLET)) {
      await ensureAddress("MAIN2.devWallet", () => main2.devWallet(), A.DEV_WALLET, () => main2.setDevWallet(A.DEV_WALLET));
    }
    await ensureAddress("MAIN2.tokenSink", () => main2.tokenSink(), A.TREASURY, () => main2.setTokenSink(A.TREASURY, 10000));
    await ensureUint("MAIN2.tokenSinkBps", () => main2.tokenSinkBps(), 10000, () => main2.setTokenSink(A.TREASURY, 10000));
    await ensureBool("MAIN2.tokenSinkDepositMode", () => main2.tokenSinkDepositMode(), true, () => main2.setTokenSinkDepositMode(true));
  }

  if (registry) {
    const seriesCount = await read("REGISTRY.seriesCount", () => registry.seriesCount());
    if (seriesCount != null) {
      for (let next = seriesCount.toNumber() + 1; next <= A.SERIES_ID; next++) {
        await change(`REGISTRY.createSeries(${params.seriesName}) -> expected series ${next}`, () => registry.createSeries(params.seriesName));
      }
    }
    const chapterCount = await read("REGISTRY.chapterCount", () => registry.chapterCount());
    if (chapterCount != null) {
      for (let next = chapterCount.toNumber() + 1; next <= A.CHAPTER_ID; next++) {
        await change(`REGISTRY.createChapter(${A.SERIES_ID}) -> expected chapter ${next}`, () => registry.createChapter(A.SERIES_ID));
      }
    }
    const chapterCollections = await read("REGISTRY.getChapterCollections", () => registry.getChapterCollections(A.CHAPTER_ID));
    if (chapterCollections != null) {
      const expected = [A.MAIN, A.MAIN2, A.TICKET_HUB];
      if (tupleEqual(Array.from(chapterCollections), expected)) unchanged("REGISTRY.chapterCollections");
      else {
        await change(
          `REGISTRY.setChapterCollections(${A.CHAPTER_ID}, MAIN, MAIN2, TICKET_HUB)`,
          () => registry.setChapterCollections(A.CHAPTER_ID, A.MAIN, A.MAIN2, A.TICKET_HUB)
        );
      }
    }
    const eligVrf = await read("REGISTRY.isTokenRewardsCollection(MAIN)", () => registry.isTokenRewardsCollection(A.MAIN));
    const eligPublic = await read("REGISTRY.isTokenRewardsCollection(MAIN2)", () => registry.isTokenRewardsCollection(A.MAIN2));
    const eligCollection = await read("REGISTRY.isCollectionRewardsCollection(MAIN)", () => registry.isCollectionRewardsCollection(A.MAIN));
    if (eligVrf === true && eligPublic === true && eligCollection === true) unchanged("REGISTRY.rewardsEligibility == true,true,true");
    else {
      await change(
        `REGISTRY.setRewardsEligibility(${A.CHAPTER_ID}, true, true, true)`,
        () => registry.setRewardsEligibility(A.CHAPTER_ID, true, true, true)
      );
    }
  }

  if (chapterController) {
    const cfg = await read("CHAPTER_CONTROLLER.chapterConfig", () => chapterController.chapterConfig(A.CHAPTER_ID));
    if (cfg != null) {
      const needs =
        cfg.exists !== true ||
        Number(cfg.saleCap) !== params.saleCap ||
        Number(cfg.marketingCap) !== params.marketingCap ||
        Number(cfg.totalCap) !== params.totalCap;
      if (needs) {
        await change(
          `CHAPTER_CONTROLLER.configureChapter(${A.CHAPTER_ID})`,
          () => chapterController.configureChapter(
            A.CHAPTER_ID,
            A.SERIES_ID,
            A.MAIN,
            A.MAIN2,
            A.TICKET_HUB,
            params.saleCap,
            params.marketingCap,
            params.totalCap
          )
        );
      } else {
        unchanged("CHAPTER_CONTROLLER.chapterConfig");
      }
    }
  }

  if (main2) {
    await ensureAddress("MAIN2.chapterController", () => main2.chapterController(), A.CHAPTER_CONTROLLER, () => main2.setChapterController(A.CHAPTER_CONTROLLER, A.CHAPTER_ID));
    await ensureUint("MAIN2.chapterId", () => main2.chapterId(), A.CHAPTER_ID, () => main2.setChapterController(A.CHAPTER_CONTROLLER, A.CHAPTER_ID));
  }

  if (collectionRewards) {
    await ensureAddress("COLLECTION_REWARDS.defaultMain", () => collectionRewards.defaultMain(), A.MAIN, () => collectionRewards.setMain(A.MAIN));
    await ensureAddress("COLLECTION_REWARDS.registry", () => collectionRewards.registry(), A.REGISTRY, () => collectionRewards.setRegistry(A.REGISTRY));
    await ensureAddress("COLLECTION_REWARDS.distributor", () => collectionRewards.distributor(), A.DISTRIBUTOR, () => collectionRewards.setDistributor(A.DISTRIBUTOR));
  }

  if (distributor) {
    await ensureCollection("DISTRIBUTOR", distributor, A.TICKET_HUB);
    await ensureCollection("DISTRIBUTOR", distributor, A.MAIN2);
    await ensureCollection("DISTRIBUTOR", distributor, A.MAIN);
    await ensureAddress("DISTRIBUTOR.registry", () => distributor.registry(), A.REGISTRY, () => distributor.setRegistry(A.REGISTRY));
    await ensureAddress("DISTRIBUTOR.collectionRewards", () => distributor.collectionRewards(), A.COLLECTION_REWARDS, () => distributor.setCollectionRewards(A.COLLECTION_REWARDS));
    await ensureAddress("DISTRIBUTOR.reserve", () => distributor.reserve(), A.RESERVE, () => distributor.setReserve(A.RESERVE));
    await ensureAddress("DISTRIBUTOR.buybackAgent", () => distributor.buybackAgent(), buybackRecipient, () => distributor.setBuybackAgent(buybackRecipient));
    await ensureAddress("DISTRIBUTOR.treasury", () => distributor.treasury(), A.TREASURY, () => distributor.setTreasury(A.TREASURY));
    await ensureAddress("DISTRIBUTOR.communityCenter", () => distributor.communityCenter(), communityRecipient, () => distributor.setCommunityCenter(communityRecipient));
  }

  if (tokenRewards) {
    await ensureAddress("TOKEN_REWARDS.registry", () => tokenRewards.registry(), A.REGISTRY, () => tokenRewards.setRegistry(A.REGISTRY));
    await ensureAddress("TOKEN_REWARDS.treasure", () => tokenRewards.treasure(), A.TREASURY, () => tokenRewards.setTreasure(A.TREASURY));
    if (isAddress(A.TOKEN_REWARDS_EMISSION_CONTROLLER)) {
      await ensureAddress(
        "TOKEN_REWARDS.emissionController",
        () => tokenRewards.emissionController(),
        A.TOKEN_REWARDS_EMISSION_CONTROLLER,
        () => tokenRewards.setEmissionController(A.TOKEN_REWARDS_EMISSION_CONTROLLER, params.tokenRewardsEmissionEnabled)
      );
      await ensureBool(
        "TOKEN_REWARDS.emissionControllerEnabled",
        () => tokenRewards.emissionControllerEnabled(),
        params.tokenRewardsEmissionEnabled,
        () => tokenRewards.setEmissionControllerEnabled(params.tokenRewardsEmissionEnabled)
      );
    }
    await ensureAllowedCollection("TOKEN_REWARDS", tokenRewards, A.MAIN);
    await ensureAllowedCollection("TOKEN_REWARDS", tokenRewards, A.MAIN2);
  }

  if (tokenRewardsEmissionController) {
    const setBudgetConfig = () => tokenRewardsEmissionController.setBudgetConfig(
      params.tokenRewardsMinWeeklyBudget,
      params.tokenRewardsWeakWeeklyBudget,
      params.tokenRewardsNormalWeeklyBudget,
      params.tokenRewardsStrongWeeklyBudget,
      params.tokenRewardsEmergencyWeeklyBudget,
      params.tokenRewardsMaxWeeklyBudget,
      params.tokenRewardsBalanceBudgetBps
    );

    await ensureAddress(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.tokenRewards",
      () => tokenRewardsEmissionController.tokenRewards(),
      A.TOKEN_REWARDS,
      () => tokenRewardsEmissionController.setTokenRewards(A.TOKEN_REWARDS)
    );
    await ensureAddress(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.treasury",
      () => tokenRewardsEmissionController.treasury(),
      A.TREASURY,
      () => tokenRewardsEmissionController.setTreasury(A.TREASURY)
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.targetWeeklyUnits",
      () => tokenRewardsEmissionController.targetWeeklyUnits(),
      params.tokenRewardsTargetWeeklyUnits,
      () => tokenRewardsEmissionController.setTargetWeeklyUnits(params.tokenRewardsTargetWeeklyUnits)
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.minWeeklyBudget",
      () => tokenRewardsEmissionController.minWeeklyBudget(),
      params.tokenRewardsMinWeeklyBudget,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.weakWeeklyBudget",
      () => tokenRewardsEmissionController.weakWeeklyBudget(),
      params.tokenRewardsWeakWeeklyBudget,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.normalWeeklyBudget",
      () => tokenRewardsEmissionController.normalWeeklyBudget(),
      params.tokenRewardsNormalWeeklyBudget,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.strongWeeklyBudget",
      () => tokenRewardsEmissionController.strongWeeklyBudget(),
      params.tokenRewardsStrongWeeklyBudget,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.emergencyWeeklyBudget",
      () => tokenRewardsEmissionController.emergencyWeeklyBudget(),
      params.tokenRewardsEmergencyWeeklyBudget,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.maxWeeklyBudget",
      () => tokenRewardsEmissionController.maxWeeklyBudget(),
      params.tokenRewardsMaxWeeklyBudget,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.balanceBudgetBps",
      () => tokenRewardsEmissionController.balanceBudgetBps(),
      params.tokenRewardsBalanceBudgetBps,
      setBudgetConfig
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.weakInflowThreshold",
      () => tokenRewardsEmissionController.weakInflowThreshold(),
      params.tokenRewardsWeakInflowThreshold,
      () => tokenRewardsEmissionController.setInflowThresholds(
        params.tokenRewardsWeakInflowThreshold,
        params.tokenRewardsStrongInflowThreshold
      )
    );
    await ensureUint(
      "TOKEN_REWARDS_EMISSION_CONTROLLER.strongInflowThreshold",
      () => tokenRewardsEmissionController.strongInflowThreshold(),
      params.tokenRewardsStrongInflowThreshold,
      () => tokenRewardsEmissionController.setInflowThresholds(
        params.tokenRewardsWeakInflowThreshold,
        params.tokenRewardsStrongInflowThreshold
      )
    );
  }

  if (vrf) {
    await ensureAddress("VRF_ROUTER.main", () => vrf.main(), A.MAIN, () => vrf.setMain(A.MAIN));
    await ensureBool("VRF_ROUTER.approvedMains(MAIN)", () => vrf.approvedMains(A.MAIN), true, () => vrf.setMainApproval(A.MAIN, true));
    if (isAddress(A.NFT_REWARDS)) {
      await ensureBool(
        "VRF_ROUTER.approvedRewardConsumers(NFT_REWARDS)",
        () => vrf.approvedRewardConsumers(A.NFT_REWARDS),
        true,
        () => vrf.setRewardConsumerApproval(A.NFT_REWARDS, true)
      );
    }
    const vrfKeyHash = envHex32("VRF_KEY_HASH");
    const vrfSubId = process.env.VRF_SUB_ID ? ethers.BigNumber.from(process.env.VRF_SUB_ID) : null;
    const vrfGas = process.env.VRF_CALLBACK_GAS_LIMIT ? asIntValue("VRF_CALLBACK_GAS_LIMIT", process.env.VRF_CALLBACK_GAS_LIMIT) : null;
    const vrfConf = process.env.VRF_REQUEST_CONFIRMATIONS ? asIntValue("VRF_REQUEST_CONFIRMATIONS", process.env.VRF_REQUEST_CONFIRMATIONS) : null;
    const vrfWords = process.env.VRF_NUM_WORDS ? asIntValue("VRF_NUM_WORDS", process.env.VRF_NUM_WORDS) : null;
    if (vrfKeyHash || vrfSubId || vrfGas || vrfConf || vrfWords) {
      await change(
        "VRF_ROUTER.setVrfParams(from env overrides)",
        () => vrf.setVrfParams(vrfKeyHash || BYTES32_ZERO, vrfSubId || 0, vrfGas || 0, vrfConf || 0, vrfWords || 0)
      );
    }
  }

  if (nftRewards) {
    await ensureAddress("NFT_REWARDS.mainContract", () => nftRewards.mainContract(), A.MAIN, () => nftRewards.setMainContract(A.MAIN));
    await ensureAddress("NFT_REWARDS.registry", () => nftRewards.registry(), A.REGISTRY, () => nftRewards.setRegistry(A.REGISTRY));
    if (isAddress(A.VRF_ROUTER)) {
      await ensureAddress("NFT_REWARDS.vrfRouter", () => nftRewards.vrfRouter(), A.VRF_ROUTER, () => nftRewards.setVrfRouter(A.VRF_ROUTER));
    }
    await ensureBool("NFT_REWARDS.allowedMainCollections(MAIN2)", () => nftRewards.allowedMainCollections(A.MAIN2), true, () => nftRewards.setAllowedMainCollection(A.MAIN2, true));
  }

  if (biggiToken) {
    const reserveLocked = await read("BIGGI_TOKEN.reserveLocked", () => biggiToken.reserveLocked());
    const currentReserve = await read("BIGGI_TOKEN.reserveAddr", () => biggiToken.reserveAddr());
    if (reserveLocked && currentReserve && !eqAddress(currentReserve, A.RESERVE)) {
      block(`BIGGI_TOKEN reserve is locked to ${currentReserve}; expected ${A.RESERVE}`);
    } else {
      await ensureAddress("BIGGI_TOKEN.reserveAddr", () => biggiToken.reserveAddr(), A.RESERVE, () => biggiToken.setReserve(A.RESERVE));
    }
    await ensureAddress("BIGGI_TOKEN.dripDistributorAddr", () => biggiToken.dripDistributorAddr(), A.DRIP_DISTRIBUTOR, () => biggiToken.setDripDistributor(A.DRIP_DISTRIBUTOR));
    await ensureAddress("BIGGI_TOKEN.tokenRewardsAddr", () => biggiToken.tokenRewardsAddr(), A.TOKEN_REWARDS, () => biggiToken.setTokenRewards(A.TOKEN_REWARDS));
    await ensureAddress("BIGGI_TOKEN.marketingSupportAddr", () => biggiToken.marketingSupportAddr(), marketingSupport, () => biggiToken.setMarketingSupport(marketingSupport));
    await ensureAddress("BIGGI_TOKEN.supplyController", () => biggiToken.supplyController(), A.SUPPLY_CONTROLLER, () => biggiToken.setSupplyController(A.SUPPLY_CONTROLLER));
    await ensureAddress("BIGGI_TOKEN.supplyGuardian", () => biggiToken.supplyGuardian(), A.SUPPLY_GUARDIAN, () => biggiToken.setSupplyGuardian(A.SUPPLY_GUARDIAN));
    const distributed = await read("BIGGI_TOKEN.distributed", () => biggiToken.distributed());
    if (distributed === true) unchanged("BIGGI_TOKEN.initialDistribution already done");
    else if (opts.initialDistribute) await change("BIGGI_TOKEN.initialDistribute()", () => biggiToken.initialDistribute());
    else warn("BIGGI_TOKEN.initialDistribution is not done; use --initial-distribute only when final token addresses are confirmed.");
  }

  if (reserve) {
    if (isAddress(A.LIQUIDITY_MANAGER)) {
      await ensureAddress("RESERVE.liquidityManager", () => reserve.liquidityManager(), A.LIQUIDITY_MANAGER, () => reserve.setLiquidityManager(A.LIQUIDITY_MANAGER));
    }
    await ensureAddress("RESERVE.distributor", () => reserve.distributor(), A.DISTRIBUTOR, () => reserve.setDistributor(A.DISTRIBUTOR));
    for (const [name, addr] of [
      ["TICKET_HUB", A.TICKET_HUB],
      ["MAIN2", A.MAIN2],
      ["DISTRIBUTOR", A.DISTRIBUTOR],
      ["TREASURY", A.TREASURY],
    ]) {
      await ensureBool(`RESERVE.notifyCallers(${name})`, () => reserve.notifyCallers(addr), true, () => reserve.setNotifyCaller(addr, true));
    }
    if (params.strictNotify) {
      await ensureBool("RESERVE.notifyCallerCheckEnabled", () => reserve.notifyCallerCheckEnabled(), true, () => reserve.setNotifyCallerCheck(true));
    }
  }

  if (treasury) {
    await ensureAddress("TREASURY.distributor", () => treasury.distributor(), A.DISTRIBUTOR, () => treasury.setDistributor(A.DISTRIBUTOR));
    if (isAddress(A.BUYBACK_AGENT)) {
      await ensureAddress("TREASURY.buybackAgent", () => treasury.buybackAgent(), A.BUYBACK_AGENT, () => treasury.setBuybackAgent(A.BUYBACK_AGENT));
    }
    await ensureAddress("TREASURY.tokenRewards", () => treasury.tokenRewards(), A.TOKEN_REWARDS, () => treasury.setTokenRewards(A.TOKEN_REWARDS));
    await ensureAddress("TREASURY.reserveAddr", () => treasury.reserveAddr(), A.RESERVE, () => treasury.setReserve(A.RESERVE));
    await ensureAddress("TREASURY.dripDistributor", () => treasury.dripDistributor(), A.DRIP_DISTRIBUTOR, () => treasury.setDripDistributor(A.DRIP_DISTRIBUTOR));
    await ensureBool("TREASURY.ecosystemBiggiCallers(TICKET_HUB)", () => treasury.ecosystemBiggiCallers(A.TICKET_HUB), true, () => treasury.setEcosystemBiggiCaller(A.TICKET_HUB, true));
    await ensureBool("TREASURY.ecosystemBiggiCallers(MAIN2)", () => treasury.ecosystemBiggiCallers(A.MAIN2), true, () => treasury.setEcosystemBiggiCaller(A.MAIN2, true));
  }

  if (dripDistributor) {
    await ensureAddress("DRIP_DISTRIBUTOR.treasury", () => dripDistributor.treasury(), A.TREASURY, () => dripDistributor.setTreasury(A.TREASURY));
    if (isAddress(A.DRIP_LM)) {
      await ensureAddress("DRIP_DISTRIBUTOR.dripLM", () => dripDistributor.dripLM(), A.DRIP_LM, () => dripDistributor.setDripLM(A.DRIP_LM));
      await ensureAddress("DRIP_DISTRIBUTOR.tokensPerMintOperator", () => dripDistributor.tokensPerMintOperator(), A.DRIP_LM, () => dripDistributor.setTokensPerMintOperator(A.DRIP_LM));
    }
    await ensureBool("DRIP_DISTRIBUTOR.collections(MAIN)", () => dripDistributor.collections(A.MAIN), true, () => dripDistributor.setCollection(A.MAIN, true));
    await ensureBool("DRIP_DISTRIBUTOR.collections(MAIN2)", () => dripDistributor.collections(A.MAIN2), true, () => dripDistributor.setCollection(A.MAIN2, true));
  }

  if (supplyController) {
    await ensureAddress("SUPPLY_CONTROLLER.pair", () => supplyController.pair(), A.PAIR, () => supplyController.setPair(A.PAIR));
    await ensureBool("SUPPLY_CONTROLLER.allowedCallers(DEX_RESERVE_GUARD)", () => supplyController.allowedCallers(A.DEX_RESERVE_GUARD), true, () => supplyController.setAllowedCaller(A.DEX_RESERVE_GUARD, true));
    if (isAddress(supplyKeeper)) {
      await ensureBool("SUPPLY_CONTROLLER.keepers(SUPPLY_KEEPER)", () => supplyController.keepers(supplyKeeper), true, () => supplyController.setKeeper(supplyKeeper, true));
    }
    await ensureTuple(
      "SUPPLY_CONTROLLER.dexConfig",
      async () => [
        await supplyController.reserveDropBps(),
        await supplyController.dexRefillAmount(),
        await supplyController.dexCooldown(),
        await supplyController.minimumReserveFloor(),
        await supplyController.autoRefreshBaselineOnDexRefill(),
      ],
      [
        ethers.BigNumber.from(params.supplyDexReserveDropBps),
        params.supplyDexRefillAmount,
        ethers.BigNumber.from(params.supplyDexCooldownSec),
        params.supplyMinimumReserveFloor,
        params.supplyAutoRefreshBaseline,
      ],
      () => supplyController.setDexConfig(
        params.supplyDexReserveDropBps,
        params.supplyDexRefillAmount,
        params.supplyDexCooldownSec,
        params.supplyMinimumReserveFloor,
        params.supplyAutoRefreshBaseline
      )
    );
    await ensureTuple(
      "SUPPLY_CONTROLLER.rewardsConfig",
      async () => [
        await supplyController.rewardsThreshold(),
        await supplyController.rewardsRefillAmount(),
        await supplyController.rewardsCooldown(),
      ],
      [params.supplyRewardsThreshold, params.supplyRewardsRefillAmount, ethers.BigNumber.from(params.supplyRewardsCooldownSec)],
      () => supplyController.setRewardsConfig(params.supplyRewardsThreshold, params.supplyRewardsRefillAmount, params.supplyRewardsCooldownSec)
    );
    await ensureTuple(
      "SUPPLY_CONTROLLER.circuitBreakerConfig",
      async () => [
        await supplyController.circuitBreakerEnabled(),
        await supplyController.dexCriticalFloor(),
        await supplyController.rewardsCriticalFloor(),
      ],
      [params.circuitBreakerEnabled, params.cbDexCriticalFloor, params.cbRewardsCriticalFloor],
      () => supplyController.setCircuitBreakerConfig(params.circuitBreakerEnabled, params.cbDexCriticalFloor, params.cbRewardsCriticalFloor)
    );
  }

  if (supplyGuardian) {
    await ensureAddress("SUPPLY_GUARDIAN.controller", () => supplyGuardian.controller(), A.SUPPLY_CONTROLLER, () => supplyGuardian.setController(A.SUPPLY_CONTROLLER));
  }

  if (dexGuard) {
    await ensureAddress("DEX_RESERVE_GUARD.pair", () => dexGuard.pair(), A.PAIR, () => dexGuard.setPair(A.PAIR));
    await ensureAddress("DEX_RESERVE_GUARD.quoteToken", () => dexGuard.quoteToken(), A.QUOTE_TOKEN, () => dexGuard.setQuoteToken(A.QUOTE_TOKEN));
    if (isAddress(params.dexGuardQuoteOracle)) {
      await ensureAddress("DEX_RESERVE_GUARD.quoteOracle", () => dexGuard.quoteOracle(), params.dexGuardQuoteOracle, () => dexGuard.setQuoteOracle(params.dexGuardQuoteOracle));
    }
    if (isAddress(dexGuardKeeper)) {
      await ensureBool("DEX_RESERVE_GUARD.keepers(DEX_GUARD_KEEPER)", () => dexGuard.keepers(dexGuardKeeper), true, () => dexGuard.setKeeper(dexGuardKeeper, true));
    }
    await ensureUint("DEX_RESERVE_GUARD.minReserveRatioBps", () => dexGuard.minReserveRatioBps(), params.dexGuardMinReserveRatioBps, () => dexGuard.setReserveRatioBps(params.dexGuardMinReserveRatioBps));
    await ensureUint("DEX_RESERVE_GUARD.refillAmount", () => dexGuard.refillAmount(), params.dexGuardRefillAmount, () => dexGuard.setRefillAmount(params.dexGuardRefillAmount));
    await ensureUint("DEX_RESERVE_GUARD.cooldown", () => dexGuard.cooldown(), params.dexGuardCooldownSec, () => dexGuard.setCooldown(params.dexGuardCooldownSec));
    await ensureBool("DEX_RESERVE_GUARD.autoRefreshBaselineOnRefill", () => dexGuard.autoRefreshBaselineOnRefill(), params.dexGuardAutoRefreshBaseline, () => dexGuard.setAutoRefreshBaselineOnRefill(params.dexGuardAutoRefreshBaseline));
    await ensureTuple(
      "DEX_RESERVE_GUARD.priceCheckConfig",
      async () => [await dexGuard.priceCheckEnabled(), await dexGuard.maxPriceDeviationBps()],
      [params.dexGuardPriceCheckEnabled, ethers.BigNumber.from(params.dexGuardMaxDeviationBps)],
      () => dexGuard.setPriceCheckConfig(params.dexGuardPriceCheckEnabled, params.dexGuardMaxDeviationBps)
    );
    await ensureTuple(
      "DEX_RESERVE_GUARD.quoteOracleConfig",
      async () => [await dexGuard.maxOracleStaleness(), await dexGuard.requireQuoteOracleForPriceCheck()],
      [ethers.BigNumber.from(params.dexGuardMaxOracleStalenessSec), params.dexGuardRequireQuoteOracle],
      () => dexGuard.setQuoteOracleConfig(params.dexGuardMaxOracleStalenessSec, params.dexGuardRequireQuoteOracle)
    );
  }

  if (policy) {
    await ensureUint("POLICY.swapSlippageBps", () => policy.swapSlippageBps(), params.policySwapSlippageBps, () => policy.setSwapSlippageBps(params.policySwapSlippageBps));
    await ensureUint("POLICY.txDeadlineSec", () => policy.txDeadlineSec(), params.policyTxDeadlineSec, () => policy.setTxDeadlineSec(params.policyTxDeadlineSec));
    await ensureUint("POLICY.minBuybackInterval", () => policy.minBuybackInterval(), params.policyMinBuybackIntervalSec, () => policy.setMinBuybackInterval(params.policyMinBuybackIntervalSec));
    await ensureBool("POLICY.buybacksPaused", () => policy.buybacksPaused(), params.policyBuybacksPaused, () => policy.setBuybacksPaused(params.policyBuybacksPaused));
    await ensureUint("POLICY.maxDailyBuybackNative", () => policy.maxDailyBuybackNative(), params.policyMaxDailyBuybackNative, () => policy.setMaxDailyBuybackNative(params.policyMaxDailyBuybackNative));
    if (isAddress(A.BUYBACK_AGENT)) {
      await ensureAddress("POLICY.buybackAgent", () => policy.buybackAgent(), A.BUYBACK_AGENT, () => policy.setBuybackAgent(A.BUYBACK_AGENT));
    }
  }

  if (buyback) {
    await ensureAddress("BUYBACK_AGENT.router", () => buyback.router(), buybackRouter, () => buyback.setRouter(buybackRouter));
    await ensureAddress("BUYBACK_AGENT.treasury", () => buyback.treasury(), A.TREASURY, () => buyback.setTreasury(A.TREASURY));
    if (isAddress(A.POLICY)) {
      await ensureAddress("BUYBACK_AGENT.policy", () => buyback.policy(), A.POLICY, () => buyback.setPolicy(A.POLICY));
    }
    if (isAddress(A.DRIP_LM)) {
      await ensureAddress("BUYBACK_AGENT.dripLM", () => buyback.dripLM(), A.DRIP_LM, () => buyback.setDripLM(A.DRIP_LM));
    }
    await ensureAddress("BUYBACK_AGENT.distributor", () => buyback.distributor(), A.DISTRIBUTOR, () => buyback.setDistributor(A.DISTRIBUTOR));
    if (isAddress(buybackKeeper)) {
      await ensureAddress("BUYBACK_AGENT.keeper", () => buyback.keeper(), buybackKeeper, () => buyback.setKeeper(buybackKeeper));
    }
    await ensureTuple(
      "BUYBACK_AGENT.fallbacks",
      async () => [
        await buyback.fallbackSwapSlippageBps(),
        await buyback.fallbackTxDeadlineSec(),
        await buyback.fallbackMinIntervalSec(),
      ],
      [
        ethers.BigNumber.from(params.buybackFallbackSlipBps),
        ethers.BigNumber.from(params.buybackFallbackDeadlineSec),
        ethers.BigNumber.from(params.buybackFallbackCooldownSec),
      ],
      () => buyback.setFallbacks(params.buybackFallbackSlipBps, params.buybackFallbackDeadlineSec, params.buybackFallbackCooldownSec)
    );
  }

  if (dripLm) {
    await ensureAddress("DRIP_LM.router", () => dripLm.router(), buybackRouter, () => dripLm.setRouter(buybackRouter));
    await ensureAddress("DRIP_LM.dripDistributor", () => dripLm.dripDistributor(), A.DRIP_DISTRIBUTOR, () => dripLm.setDripDistributor(A.DRIP_DISTRIBUTOR));
    await ensureAddress("DRIP_LM.reserve", () => dripLm.reserve(), A.RESERVE, () => dripLm.setReserve(A.RESERVE));
    if (isAddress(A.BUYBACK_AGENT)) {
      await ensureAddress("DRIP_LM.buybackAgent", () => dripLm.buybackAgent(), A.BUYBACK_AGENT, () => dripLm.setBuybackAgent(A.BUYBACK_AGENT));
    }
    await ensureAddress("DRIP_LM.moderatorCenter", () => dripLm.moderatorCenter(), moderatorCenter, () => dripLm.setModeratorCenter(moderatorCenter));
    await ensureUint("DRIP_LM.sellPct", () => dripLm.sellPct(), paramInt(raw, "DRIP_LM_SELL_PCT", 70), () => dripLm.setSellPct(paramInt(raw, "DRIP_LM_SELL_PCT", 70)));
    await ensureUint("DRIP_LM.slippageBps", () => dripLm.slippageBps(), params.liqSlippageBps, () => dripLm.setSlippageBps(params.liqSlippageBps));
    await ensureUint("DRIP_LM.txDeadlineSec", () => dripLm.txDeadlineSec(), params.liqDeadlineSec, () => dripLm.setTxDeadlineSec(params.liqDeadlineSec));
    await ensureTuple(
      "DRIP_LM.shares",
      async () => [await dripLm.reserveShareBps(), await dripLm.moderatorShareBps()],
      [ethers.BigNumber.from(paramInt(raw, "DRIP_LM_RESERVE_SHARE_BPS", 5000)), ethers.BigNumber.from(paramInt(raw, "DRIP_LM_MODERATOR_SHARE_BPS", 5000))],
      () => dripLm.setShares(paramInt(raw, "DRIP_LM_RESERVE_SHARE_BPS", 5000), paramInt(raw, "DRIP_LM_MODERATOR_SHARE_BPS", 5000))
    );
  }

  if (lm) {
    await ensureAddress("LM.router", () => lm.router(), A.ROUTER, () => lm.setRouter(A.ROUTER));
    await ensureAddress("LM.factory", () => lm.factory(), A.FACTORY, () => lm.setFactory(A.FACTORY));
    await ensureAddress("LM.reserve", () => lm.reserve(), A.RESERVE, () => lm.setReserve(A.RESERVE));
    await ensureAddress("LM.liquidityVault", () => lm.liquidityVault(), A.LIQUIDITY_VAULT, () => lm.setLiquidityVault(A.LIQUIDITY_VAULT));
    if (liquidityPath === "keeper_proxy" && isAddress(A.LIQUIDITY_ORCHESTRATOR)) {
      await ensureAddress("LM.keeper", () => lm.keeper(), A.LIQUIDITY_ORCHESTRATOR, () => lm.setKeeper(A.LIQUIDITY_ORCHESTRATOR));
    } else if (liquidityPath === "automation" && isAddress(A.LIQUIDITY_AUTOMATION)) {
      await ensureAddress("LM.keeper", () => lm.keeper(), A.LIQUIDITY_AUTOMATION, () => lm.setKeeper(A.LIQUIDITY_AUTOMATION));
    } else if (liquidityPath === "none") {
      warn("LIQUIDITY_PATH=none: LM.keeper is not cleared by configure script.");
    }
    await ensureUint("LM.tokenPct", () => lm.tokenPct(), params.liqTokenPct, () => lm.setTokenPct(params.liqTokenPct));
    await ensureUint("LM.slippageBps", () => lm.slippageBps(), params.liqSlippageBps, () => lm.setSlippageBps(params.liqSlippageBps));
    await ensureUint("LM.txDeadlineSec", () => lm.txDeadlineSec(), params.liqDeadlineSec, () => lm.setTxDeadlineSec(params.liqDeadlineSec));
    await ensureTuple(
      "LM.autoTopUpConfig",
      async () => [await lm.autoTopUpEnabled(), await lm.autoTriggerMinPolWei(), await lm.autoRequestPolWei()],
      [params.liqAutoEnabled, params.liqAutoTriggerMinPolWei, params.liqAutoRequestPolWei],
      () => lm.setAutoTopUpConfig(params.liqAutoEnabled, params.liqAutoTriggerMinPolWei, params.liqAutoRequestPolWei)
    );
  }

  if (vault) {
    await ensureAddress("VAULT.liquidityManager", () => vault.liquidityManager(), A.LIQUIDITY_MANAGER, () => vault.setLiquidityManager(A.LIQUIDITY_MANAGER));
    if (isAddress(A.PAIR)) {
      await ensureBool("VAULT.whitelistedPairs(PAIR)", () => vault.whitelistedPairs(A.PAIR), true, () => vault.addWhitelistedPair(A.PAIR));
    }
  }

  if (orchestrator) {
    await ensureAddress("ORCH.reserve", () => orchestrator.reserve(), A.RESERVE, () => orchestrator.setReserve(A.RESERVE));
    await ensureAddress("ORCH.lm", () => orchestrator.lm(), A.LIQUIDITY_MANAGER, () => orchestrator.setLM(A.LIQUIDITY_MANAGER));
    if (liquidityPath === "keeper_proxy" && isAddress(A.LIQUIDITY_KEEPER_PROXY)) {
      await ensureAddress("ORCH.keeper", () => orchestrator.keeper(), A.LIQUIDITY_KEEPER_PROXY, () => orchestrator.setKeeper(A.LIQUIDITY_KEEPER_PROXY));
    }
    await ensureTuple(
      "ORCH.limits",
      async () => [
        await orchestrator.minPolPerTx(),
        await orchestrator.maxPolPerTx(),
        await orchestrator.minDexRefillBiggi(),
        await orchestrator.cooldownSec(),
        await orchestrator.dailyQuotaPol(),
      ],
      [
        params.liqOrchMinPolPerTx,
        params.liqOrchMaxPolPerTx,
        params.liqOrchMinDexRefillBiggi,
        ethers.BigNumber.from(params.liqOrchCooldownSec),
        params.liqOrchDailyQuotaPol,
      ],
      () => orchestrator.setLimits(params.liqOrchMinPolPerTx, params.liqOrchMaxPolPerTx, params.liqOrchMinDexRefillBiggi, params.liqOrchCooldownSec, params.liqOrchDailyQuotaPol)
    );
  }

  if (keeperProxy) {
    await ensureAddress("LKP.orchestrator", () => keeperProxy.orchestrator(), A.LIQUIDITY_ORCHESTRATOR, () => keeperProxy.setOrchestrator(A.LIQUIDITY_ORCHESTRATOR));
    await ensureAddress("LKP.reserve", () => keeperProxy.reserve(), A.RESERVE, () => keeperProxy.setReserve(A.RESERVE));
    if (isAddress(liqKeeperAllowedCaller)) {
      await ensureAddress("LKP.allowedCaller", () => keeperProxy.allowedCaller(), liqKeeperAllowedCaller, () => keeperProxy.setAllowedCaller(liqKeeperAllowedCaller));
    }
    await ensureTuple(
      "LKP.strategy",
      async () => [await keeperProxy.amountMode(), await keeperProxy.fixedAmount(), await keeperProxy.percentBps()],
      [ethers.BigNumber.from(params.liqKeeperMode), params.liqKeeperFixedPol, ethers.BigNumber.from(params.liqKeeperPercentBps)],
      () => keeperProxy.setStrategy(params.liqKeeperMode, params.liqKeeperFixedPol, params.liqKeeperPercentBps)
    );
    await ensureTuple(
      "LKP.limits",
      async () => [
        await keeperProxy.minIntervalSec(),
        await keeperProxy.minReservePol(),
        await keeperProxy.maxPerTx(),
        await keeperProxy.minDexRefillBiggi(),
      ],
      [
        ethers.BigNumber.from(params.liqKeeperMinIntervalSec),
        params.liqKeeperMinReservePol,
        params.liqKeeperMaxPerTx,
        params.liqKeeperMinDexRefillBiggi,
      ],
      () => keeperProxy.setLimits(params.liqKeeperMinIntervalSec, params.liqKeeperMinReservePol, params.liqKeeperMaxPerTx, params.liqKeeperMinDexRefillBiggi)
    );
  }

  if (automation) {
    await ensureAddress("LAUTO.lm", () => automation.lm(), A.LIQUIDITY_MANAGER, () => automation.setLM(A.LIQUIDITY_MANAGER));
    await ensureTuple(
      "LAUTO.limits",
      async () => [await automation.minPolWei(), await automation.maxPolWei()],
      [params.liqAutoMinPolWei, params.liqAutoMaxPolWei],
      () => automation.setLimits(params.liqAutoMinPolWei, params.liqAutoMaxPolWei)
    );
    await ensureUint("LAUTO.minIntervalSec", () => automation.minIntervalSec(), params.liqAutoMinIntervalSec, () => automation.setMinInterval(params.liqAutoMinIntervalSec));
  }

  if (dripKeeperProxy) {
    if (isAddress(A.DRIP_LM)) {
      await ensureAddress("DRIP_KEEPER_PROXY.dripLM", () => dripKeeperProxy.dripLM(), A.DRIP_LM, () => dripKeeperProxy.setDripLM(A.DRIP_LM));
    }
    if (isAddress(dripKeeperAllowed)) {
      await ensureBool("DRIP_KEEPER_PROXY.keepers(DRIP_KEEPER_ALLOWED)", () => dripKeeperProxy.keepers(dripKeeperAllowed), true, () => dripKeeperProxy.setKeeper(dripKeeperAllowed, true));
    }
  }

  if (buybackUpkeepProxy) {
    if (isAddress(A.BUYBACK_AGENT)) {
      await ensureAddress("BUYBACK_UPKEEP_PROXY.agent", () => buybackUpkeepProxy.agent(), A.BUYBACK_AGENT, () => buybackUpkeepProxy.setAgent(A.BUYBACK_AGENT));
      await ensureUint("BUYBACK_UPKEEP_PROXY.minNativeThresholdWei", () => buybackUpkeepProxy.minNativeThresholdWei(), params.buybackMinNativeWei, () => buybackUpkeepProxy.setThreshold(params.buybackMinNativeWei));
      await ensureBool("BUYBACK_UPKEEP_PROXY.paused", () => buybackUpkeepProxy.paused(), false, () => buybackUpkeepProxy.setPaused(false));
    }
  }

  if (masterConfig) {
    await ensureTuple("MASTER_CONFIG.coreBundle", () => masterConfig.coreBundle(), [A.BIGGI_TOKEN, A.RESERVE, A.TREASURY, A.DISTRIBUTOR], () => masterConfig.setCore(A.BIGGI_TOKEN, A.RESERVE, A.TREASURY, A.DISTRIBUTOR));
    await ensureTuple("MASTER_CONFIG.rewardsBundle", () => masterConfig.rewardsBundle(), [A.COLLECTION_REWARDS, A.TOKEN_REWARDS, A.NFT_REWARDS, communityRecipient], () => masterConfig.setRewards(A.COLLECTION_REWARDS, A.TOKEN_REWARDS, A.NFT_REWARDS, communityRecipient));
    await ensureTuple("MASTER_CONFIG.pumpBundle", () => masterConfig.pumpBundle(), [A.BUYBACK_AGENT, A.DRIP_LM, A.DRIP_DISTRIBUTOR, A.POLICY], () => masterConfig.setPumpBranch(A.BUYBACK_AGENT, A.DRIP_LM, A.DRIP_DISTRIBUTOR, A.POLICY));
    await ensureTuple("MASTER_CONFIG.liquidityBundle", () => masterConfig.liquidityBundle(), [A.LIQUIDITY_MANAGER, A.LIQUIDITY_VAULT, A.ROUTER, A.FACTORY, A.WETH], () => masterConfig.setLiquidityBranch(A.LIQUIDITY_MANAGER, A.LIQUIDITY_VAULT, A.ROUTER, A.FACTORY, A.WETH));
    await ensureAddress("MASTER_CONFIG.supplyController", () => masterConfig.supplyController(), A.SUPPLY_CONTROLLER, () => masterConfig.setSupplyController(A.SUPPLY_CONTROLLER));
    await ensureAddress("MASTER_CONFIG.supplyGuardian", () => masterConfig.supplyGuardian(), A.SUPPLY_GUARDIAN, () => masterConfig.setSupplyGuardian(A.SUPPLY_GUARDIAN));
    await ensureAddress("MASTER_CONFIG.dexReserveGuard", () => masterConfig.dexReserveGuard(), A.DEX_RESERVE_GUARD, () => masterConfig.setDexReserveGuard(A.DEX_RESERVE_GUARD));
    await ensureTuple("MASTER_CONFIG.collectionsBundle", () => masterConfig.collectionsBundle(), [A.MAIN, A.MAIN2, rewardsReaderForConfig, A.DISTRIBUTOR], () => masterConfig.setCollections(A.MAIN, A.MAIN2, rewardsReaderForConfig, A.DISTRIBUTOR));
  }

  if (opts.execute && report.blockers.length > 0) {
    report.errors.push("Execution finished with blockers; run strict check before handoff.");
  }

  const outPath = reportPath(opts);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("Report:", outPath);
  console.log(`Summary: actions=${report.actions.length}, unchanged=${report.unchanged.length}, warnings=${report.warnings.length}, blockers=${report.blockers.length}, errors=${report.errors.length}`);

  if (report.errors.length > 0 || (opts.strict && report.blockers.length > 0)) {
    throw new Error(`Configure finished with errors/blockers. See ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
