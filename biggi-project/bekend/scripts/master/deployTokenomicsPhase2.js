const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { parseNativeAmount } = require("./lib/nativeUnits");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

const QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const QUICKSWAP_V2_FACTORY = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  throw new Error(`Invalid boolean ${name}: ${raw}`);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ""));
}

function getAddress(value) {
  if (!isAddress(value)) return ZERO;
  return ethers.utils.getAddress(value);
}

function isSet(value) {
  return getAddress(value) !== ZERO;
}

function loadJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function backupFile(file) {
  if (!fs.existsSync(file)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(file, `${file}.bak.${stamp}`);
}

function resolveFromRoot(root, file) {
  if (!file) return "";
  if (path.isAbsolute(file)) return file;
  return path.resolve(root, file);
}

async function codeExists(address) {
  if (!isSet(address)) return false;
  return (await ethers.provider.getCode(address)) !== "0x";
}

function bn(value) {
  return ethers.BigNumber.from(String(value));
}

function parseEtherEnv(name, fallbackEth) {
  const raw = env(name, fallbackEth);
  return parseNativeAmount(raw, name);
}

function parseIntEnv(name, fallback) {
  const raw = env(name, String(fallback));
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 0) throw new Error(`${name} must be a non-negative integer`);
  return v;
}

function sameValue(current, expected) {
  if (typeof expected === "boolean") return Boolean(current) === expected;
  if (ethers.BigNumber.isBigNumber(current) || ethers.BigNumber.isBigNumber(expected)) {
    return ethers.BigNumber.from(current).eq(expected);
  }
  if (isAddress(expected) && isAddress(current)) return getAddress(current) === getAddress(expected);
  return String(current) === String(expected);
}

async function txIf(label, readFn, expected, writeFn) {
  let current;
  try {
    current = await readFn();
    if (sameValue(current, expected)) {
      console.log(`[SKIP] ${label}`);
      return false;
    }
  } catch {
    current = undefined;
  }
  console.log(`[SET] ${label}`);
  const tx = await writeFn();
  await tx.wait();
  return true;
}

async function callIf(label, shouldSkipFn, writeFn) {
  try {
    if (await shouldSkipFn()) {
      console.log(`[SKIP] ${label}`);
      return false;
    }
  } catch {}
  console.log(`[SET] ${label}`);
  const tx = await writeFn();
  await tx.wait();
  return true;
}

async function deployOrAttach(key, contractName, args, addresses, aliases = []) {
  const candidates = [
    env(key),
    addresses[key],
    ...aliases.flatMap((alias) => [env(alias), addresses[alias]]),
  ].map(getAddress);

  for (const candidate of candidates) {
    if (!isSet(candidate)) continue;
    if (await codeExists(candidate)) {
      console.log(`[ATTACH] ${key}: ${candidate}`);
      addresses[key] = candidate;
      return ethers.getContractAt(contractName, candidate);
    }
    console.warn(`[WARN] ${key} ignored, no code: ${candidate}`);
  }

  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  addresses[key] = contract.address;
  console.log(`[DEPLOY] ${key}/${contractName}: ${contract.address}`);
  return contract;
}

async function attachRequired(key, contractName, addresses, aliases = []) {
  const candidates = [
    env(key),
    addresses[key],
    ...aliases.flatMap((alias) => [env(alias), addresses[alias]]),
  ].map(getAddress);

  for (const candidate of candidates) {
    if (!isSet(candidate)) continue;
    if (await codeExists(candidate)) {
      addresses[key] = candidate;
      console.log(`[ATTACH] ${key}: ${candidate}`);
      return ethers.getContractAt(contractName, candidate);
    }
  }
  throw new Error(`Missing deployed ${key}`);
}

async function assertOwner(label, contract, deployer) {
  if (typeof contract.owner !== "function") return;
  const owner = getAddress(await contract.owner());
  if (owner !== getAddress(deployer.address)) {
    throw new Error(`${label}.owner=${owner}, deployer=${deployer.address}. Cannot configure phase2.`);
  }
}

function mergeEnvFile(file, values) {
  if (!fs.existsSync(file)) return;
  const original = fs.readFileSync(file, "utf8");
  const lines = original.split(/\r?\n/);
  const used = new Set();
  const next = lines.map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!m) return line;
    const key = m[1];
    if (!(key in values)) return line;
    used.add(key);
    return `${key}=${values[key]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!used.has(key)) next.push(`${key}=${value}`);
  }
  fs.writeFileSync(file, next.join("\n").replace(/\n+$/, "\n"));
}

async function resolveDex(addresses) {
  let router = getAddress(env("ROUTER", addresses.ROUTER || QUICKSWAP_V2_ROUTER));
  if (!isSet(router)) router = QUICKSWAP_V2_ROUTER;
  if (!(await codeExists(router))) throw new Error(`ROUTER has no code: ${router}`);

  const routerContract = await ethers.getContractAt(
    [
      "function WETH() external view returns (address)",
      "function factory() external view returns (address)",
    ],
    router
  );

  let weth = getAddress(env("WETH", env("WPOL", addresses.WETH || addresses.WPOL || "")));
  if (!isSet(weth)) weth = getAddress(await routerContract.WETH());
  if (!(await codeExists(weth))) throw new Error(`WETH/WPOL has no code: ${weth}`);

  let factory = getAddress(env("FACTORY", addresses.FACTORY || ""));
  if (!isSet(factory)) {
    try {
      factory = getAddress(await routerContract.factory());
    } catch {
      factory = QUICKSWAP_V2_FACTORY;
    }
  }
  if (!(await codeExists(factory))) throw new Error(`FACTORY has no code: ${factory}`);

  const factoryContract = await ethers.getContractAt(
    [
      "function getPair(address tokenA,address tokenB) external view returns (address)",
      "function createPair(address tokenA,address tokenB) external returns (address pair)",
    ],
    factory
  );

  let pair = getAddress(env("PAIR", addresses.PAIR || ""));
  if (isSet(pair) && !(await codeExists(pair))) {
    console.warn(`[WARN] configured PAIR has no code, ignoring: ${pair}`);
    pair = ZERO;
  }
  if (!isSet(pair)) {
    pair = getAddress(await factoryContract.getPair(addresses.BIGGI_TOKEN, weth));
  }
  if (!isSet(pair) && envBool("CREATE_DEX_PAIR", true)) {
    console.log(`[SET] Factory.createPair BIGGI/WPOL`);
    const tx = await factoryContract.createPair(addresses.BIGGI_TOKEN, weth);
    await tx.wait();
    pair = getAddress(await factoryContract.getPair(addresses.BIGGI_TOKEN, weth));
  }
  if (!isSet(pair) || !(await codeExists(pair))) {
    throw new Error("PAIR is still missing after DEX setup.");
  }

  const pairContract = await ethers.getContractAt(
    [
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
      "function getReserves() external view returns (uint112,uint112,uint32)",
    ],
    pair
  );
  const token0 = getAddress(await pairContract.token0());
  const token1 = getAddress(await pairContract.token1());
  const biggi = getAddress(addresses.BIGGI_TOKEN);
  if (!([token0, token1].includes(biggi) && [token0, token1].includes(weth))) {
    throw new Error(`PAIR token mismatch: token0=${token0} token1=${token1}`);
  }

  addresses.ROUTER = router;
  addresses.FACTORY = factory;
  addresses.WETH = weth;
  addresses.WPOL = weth;
  addresses.PAIR = pair;
  addresses.QUOTE_TOKEN = weth;

  const reserves = await pairContract.getReserves();
  console.log(`[DEX] router=${router}`);
  console.log(`[DEX] factory=${factory}`);
  console.log(`[DEX] weth=${weth}`);
  console.log(`[DEX] pair=${pair} reserves=${reserves[0].toString()}/${reserves[1].toString()}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const root = path.resolve(__dirname, "../..");

  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const visibilityFile = resolveFromRoot(root, env("CORE_ADDRESSES_FILE", "addresses.visibility.polygon.json"));
  const phase1File = resolveFromRoot(root, env("TOKENOMICS_PHASE1_OUTPUT_FILE", "addresses.tokenomics.phase1.polygon.json"));
  const phase2File = resolveFromRoot(root, env("TOKENOMICS_PHASE2_OUTPUT_FILE", "addresses.tokenomics.phase2.polygon.json"));
  const masterFile = path.resolve(root, "addresses.master.json");

  const visibility = loadJson(visibilityFile);
  const phase1 = loadJson(phase1File);
  const phase2 = loadJson(phase2File);
  const master = loadJson(masterFile);
  const addresses = {
    ...master,
    ...visibility,
    ...phase1,
    ...phase2,
    network: network.name,
    chainId: chain.chainId,
    deployer: deployer.address,
  };

  addresses.BIGGI_TOKEN = getAddress(env("BIGGI_TOKEN", env("BIGGI", addresses.BIGGI_TOKEN || addresses.BIGGI)));
  addresses.RESERVE = getAddress(env("RESERVE", env("RESERVE_ADDRESS", addresses.RESERVE || addresses.RESERVE_ADDRESS)));
  addresses.RESERVE_ADDRESS = addresses.RESERVE;

  console.log("Network:", network.name);
  console.log("ChainId:", chain.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance POL:", ethers.utils.formatEther(await deployer.getBalance()));

  const owner = getAddress(env("EXPECT_OWNER", env("OWNER", addresses.EXPECT_OWNER || addresses.OWNER || deployer.address)));
  if (!isSet(owner)) throw new Error("EXPECT_OWNER/OWNER missing.");

  const biggi = await attachRequired("BIGGI_TOKEN", "BiggiToken", addresses, ["BIGGI"]);
  const reserve = await attachRequired("RESERVE", "BiggiReserveV4", addresses, ["RESERVE_ADDRESS"]);
  const treasury = await attachRequired("TREASURY", "BiggiTreasury", addresses);
  const distributor = await attachRequired("DISTRIBUTOR", "BiggiMultiCollectionDistributor", addresses);
  const dripDistributor = await attachRequired("DRIP_DISTRIBUTOR", "BiggiDripDistributor", addresses);
  const tokenRewards = await attachRequired("TOKEN_REWARDS", "BiggiTokenRewards", addresses);
  const buybackAgent = await attachRequired("BUYBACK_AGENT", "BiggiBuybackAgent", addresses);
  const policy = await attachRequired("POLICY", "BiggiPolicy", addresses);
  const masterConfig = await attachRequired("MASTER_CONFIG", "BiggiMasterTokenomicsConfig", addresses);

  for (const [label, contract] of [
    ["BiggiToken", biggi],
    ["Reserve", reserve],
    ["Treasury", treasury],
    ["DripDistributor", dripDistributor],
    ["TokenRewards", tokenRewards],
    ["BuybackAgent", buybackAgent],
    ["Policy", policy],
    ["MasterConfig", masterConfig],
  ]) {
    await assertOwner(label, contract, deployer);
  }

  await resolveDex(addresses);

  const moderatorCenter = await deployOrAttach("MODERATOR_CENTER", "ModeratorCenter", [owner], addresses, [
    "BIGGI_MODERATOR_CENTER",
    "MODERATORCENTER",
  ]);
  const supplyController = await deployOrAttach(
    "SUPPLY_CONTROLLER",
    "BiggiSupplyController",
    [owner, biggi.address, dripDistributor.address, tokenRewards.address, addresses.PAIR],
    addresses
  );
  const supplyGuardian = await deployOrAttach("SUPPLY_GUARDIAN", "BiggiSupplyGuardian", [
    owner,
    supplyController.address,
  ], addresses);
  const dexReserveGuard = await deployOrAttach(
    "DEX_RESERVE_GUARD",
    "BiggiDexReserveGuard",
    [owner, addresses.PAIR, biggi.address, addresses.QUOTE_TOKEN, supplyController.address],
    addresses
  );
  const liquidityVault = await deployOrAttach("LIQUIDITY_VAULT", "LiquidityVault", [owner], addresses, ["LM_VAULT"]);
  const liquidityManager = await deployOrAttach(
    "LIQUIDITY_MANAGER",
    "BiggiLiquidityManager",
    [biggi.address, addresses.ROUTER, liquidityVault.address, owner, reserve.address],
    addresses,
    ["LM"]
  );
  const liquidityOrchestrator = await deployOrAttach(
    "LIQUIDITY_ORCHESTRATOR",
    "BiggiLiquidityOrchestrator",
    [reserve.address, liquidityManager.address, owner],
    addresses,
    ["ORCHESTRATOR"]
  );
  const liquidityKeeperProxy = await deployOrAttach(
    "LIQUIDITY_KEEPER_PROXY",
    "BiggiLiquidityKeeperProxy",
    [liquidityOrchestrator.address, reserve.address, owner],
    addresses,
    ["KEEPER_PROXY"]
  );
  addresses.LIQUIDITY_AUTOMATION = ZERO;

  const dripLm = await deployOrAttach("DRIP_LM", "BiggiDripLMToModerator", [
    biggi.address,
    addresses.ROUTER,
    owner,
  ], addresses);
  const dripKeeperProxy = await deployOrAttach("DRIP_KEEPER_PROXY", "DripKeeperProxy", [owner], addresses);
  const buybackUpkeepProxy = await deployOrAttach("BUYBACK_UPKEEP_PROXY", "BiggiBuybackUpkeepProxy", [owner], addresses, [
    "UPKEEP_PROXY",
  ]);

  const supplyControllerReader = await deployOrAttach(
    "SUPPLY_CONTROLLER_READER",
    "BiggiSupplyControllerReader",
    [supplyController.address],
    addresses
  );
  const supplyGuardianReader = await deployOrAttach(
    "SUPPLY_GUARDIAN_READER",
    "BiggiSupplyGuardianReader",
    [supplyGuardian.address],
    addresses
  );
  const dexReserveGuardReader = await deployOrAttach(
    "DEX_RESERVE_GUARD_READER",
    "BiggiDexReserveGuardReader",
    [dexReserveGuard.address],
    addresses
  );
  const systemReader = await deployOrAttach("SYSTEM_READER", "BiggiSystemReader", [
    biggi.address,
    supplyController.address,
    supplyGuardian.address,
  ], addresses);
  const liquidityBranchReader = await deployOrAttach(
    "LIQUIDITY_BRANCH_READER",
    "BiggiLiquidityBranchUserReader",
    [reserve.address, liquidityManager.address, liquidityVault.address],
    addresses,
    ["LIQUIDITY_BRANCH_USER_READER"]
  );
  const liquidityHelperReader = await deployOrAttach(
    "LIQUIDITY_HELPER_READER",
    "BiggiLiquidityHelperReader",
    [reserve.address, liquidityManager.address, liquidityVault.address, addresses.ROUTER],
    addresses
  );
  const biggiTokenomicsReader = await deployOrAttach(
    "BIGGI_TOKENOMICS_READER",
    "BiggiTokenomikReader",
    [
      biggi.address,
      addresses.ROUTER,
      addresses.PAIR,
      distributor.address,
      buybackAgent.address,
      reserve.address,
      liquidityManager.address,
      liquidityVault.address,
      dripDistributor.address,
      tokenRewards.address,
    ],
    addresses,
    ["BIGGI_TOKENOMIK_READER", "TOKENOMIK_READER"]
  );
  const multicall = await deployOrAttach("MULTICALL", "Multicall2", [], addresses, ["MULTICALL2"]);

  await txIf("Token.supplyController", () => biggi.supplyController(), supplyController.address, () =>
    biggi.setSupplyController(supplyController.address)
  );
  await txIf("Token.supplyGuardian", () => biggi.supplyGuardian(), supplyGuardian.address, () =>
    biggi.setSupplyGuardian(supplyGuardian.address)
  );

  await txIf("SupplyController.pair", () => supplyController.pair(), addresses.PAIR, () =>
    supplyController.setPair(addresses.PAIR)
  );
  await txIf("SupplyController.allowed DexGuard", () => supplyController.allowedCallers(dexReserveGuard.address), true, () =>
    supplyController.setAllowedCaller(dexReserveGuard.address, true)
  );
  await txIf("SupplyController.allowed SupplyGuardian", () => supplyController.allowedCallers(supplyGuardian.address), true, () =>
    supplyController.setAllowedCaller(supplyGuardian.address, true)
  );
  await txIf("SupplyGuardian.controller", () => supplyGuardian.controller(), supplyController.address, () =>
    supplyGuardian.setController(supplyController.address)
  );

  await txIf("DexGuard.quoteToken", () => dexReserveGuard.quoteToken(), addresses.QUOTE_TOKEN, () =>
    dexReserveGuard.setQuoteToken(addresses.QUOTE_TOKEN)
  );
  await txIf("DexGuard.pair", () => dexReserveGuard.pair(), addresses.PAIR, () =>
    dexReserveGuard.setPair(addresses.PAIR)
  );
  await txIf("DexGuard.keeper SupplyGuardian", () => dexReserveGuard.keepers(supplyGuardian.address), true, () =>
    dexReserveGuard.setKeeper(supplyGuardian.address, true)
  );

  await txIf("Reserve.liquidityManager", () => reserve.liquidityManager(), liquidityManager.address, () =>
    reserve.setLiquidityManager(liquidityManager.address)
  );
  await txIf("Vault.liquidityManager", () => liquidityVault.liquidityManager(), liquidityManager.address, () =>
    liquidityVault.setLiquidityManager(liquidityManager.address)
  );
  await txIf("Vault.whitelistedPair", () => liquidityVault.whitelistedPairs(addresses.PAIR), true, () =>
    liquidityVault.addWhitelistedPair(addresses.PAIR)
  );

  await txIf("LM.router", () => liquidityManager.router(), addresses.ROUTER, () => liquidityManager.setRouter(addresses.ROUTER));
  await txIf("LM.factory", () => liquidityManager.factory(), addresses.FACTORY, () =>
    liquidityManager.setFactory(addresses.FACTORY)
  );
  await txIf("LM.reserve", () => liquidityManager.reserve(), reserve.address, () => liquidityManager.setReserve(reserve.address));
  await txIf("LM.vault", () => liquidityManager.liquidityVault(), liquidityVault.address, () =>
    liquidityManager.setLiquidityVault(liquidityVault.address)
  );
  await txIf("LM.keeper", () => liquidityManager.keeper(), liquidityOrchestrator.address, () =>
    liquidityManager.setKeeper(liquidityOrchestrator.address)
  );
  await txIf("LM.tokenPct", () => liquidityManager.tokenPct(), parseIntEnv("LIQ_TOKEN_PCT", 100), () =>
    liquidityManager.setTokenPct(parseIntEnv("LIQ_TOKEN_PCT", 100))
  );
  await txIf("LM.slippageBps", () => liquidityManager.slippageBps(), bn(parseIntEnv("LIQ_SLIPPAGE_BPS", 300)), () =>
    liquidityManager.setSlippageBps(parseIntEnv("LIQ_SLIPPAGE_BPS", 300))
  );
  await txIf("LM.txDeadlineSec", () => liquidityManager.txDeadlineSec(), bn(parseIntEnv("LIQ_DEADLINE_SEC", 600)), () =>
    liquidityManager.setTxDeadlineSec(parseIntEnv("LIQ_DEADLINE_SEC", 600))
  );
  await txIf("LM.autoTopUpEnabled", () => liquidityManager.autoTopUpEnabled(), false, () =>
    liquidityManager.setAutoTopUpConfig(
      false,
      parseEtherEnv("LIQ_AUTO_TRIGGER_MIN_POL", "5"),
      parseEtherEnv("LIQ_AUTO_REQUEST_POL", "5")
    )
  );

  await txIf("Orchestrator.reserve", () => liquidityOrchestrator.reserve(), reserve.address, () =>
    liquidityOrchestrator.setReserve(reserve.address)
  );
  await txIf("Orchestrator.lm", () => liquidityOrchestrator.lm(), liquidityManager.address, () =>
    liquidityOrchestrator.setLM(liquidityManager.address)
  );
  await txIf("Orchestrator.keeper", () => liquidityOrchestrator.keeper(), liquidityKeeperProxy.address, () =>
    liquidityOrchestrator.setKeeper(liquidityKeeperProxy.address)
  );
  await callIf("Orchestrator.pauseAll", async () => liquidityOrchestrator.paused(), () => liquidityOrchestrator.pauseAll());

  await txIf("LiquidityKeeper.orchestrator", () => liquidityKeeperProxy.orchestrator(), liquidityOrchestrator.address, () =>
    liquidityKeeperProxy.setOrchestrator(liquidityOrchestrator.address)
  );
  await txIf("LiquidityKeeper.reserve", () => liquidityKeeperProxy.reserve(), reserve.address, () =>
    liquidityKeeperProxy.setReserve(reserve.address)
  );
  await callIf("LiquidityKeeper.pauseAll", async () => liquidityKeeperProxy.paused(), () => liquidityKeeperProxy.pauseAll());

  await txIf("BuybackAgent.router", () => buybackAgent.router(), addresses.ROUTER, () => buybackAgent.setRouter(addresses.ROUTER));
  await txIf("BuybackAgent.dripLM", () => buybackAgent.dripLM(), dripLm.address, () => buybackAgent.setDripLM(dripLm.address));
  await txIf("BuybackAgent.keeper", () => buybackAgent.keeper(), buybackUpkeepProxy.address, () =>
    buybackAgent.setKeeper(buybackUpkeepProxy.address)
  );
  await txIf("BuybackAgent.autoBuybackEnabled", () => buybackAgent.autoBuybackEnabled(), false, () =>
    buybackAgent.toggleAutoBuyback(false)
  );

  await txIf("DripLM.router", () => dripLm.router(), addresses.ROUTER, () => dripLm.setRouter(addresses.ROUTER));
  await txIf("DripLM.dripDistributor", () => dripLm.dripDistributor(), dripDistributor.address, () =>
    dripLm.setDripDistributor(dripDistributor.address)
  );
  await txIf("DripLM.reserve", () => dripLm.reserve(), reserve.address, () => dripLm.setReserve(reserve.address));
  await txIf("DripLM.buybackAgent", () => dripLm.buybackAgent(), buybackAgent.address, () =>
    dripLm.setBuybackAgent(buybackAgent.address)
  );
  await txIf("DripLM.moderatorCenter", () => dripLm.moderatorCenter(), moderatorCenter.address, () =>
    dripLm.setModeratorCenter(moderatorCenter.address)
  );
  await txIf("DripDistributor.dripLM", () => dripDistributor.dripLM(), dripLm.address, () =>
    dripDistributor.setDripLM(dripLm.address)
  );
  await txIf("DripDistributor.tokensPerMintOperator", () => dripDistributor.tokensPerMintOperator(), dripLm.address, () =>
    dripDistributor.setTokensPerMintOperator(dripLm.address)
  );
  await txIf("ModeratorCenter.multiCollection", () => moderatorCenter.multiCollection(), dripLm.address, () =>
    moderatorCenter.setMultiCollection(dripLm.address)
  );

  await txIf("DripKeeper.dripLM", () => dripKeeperProxy.dripLM(), dripLm.address, () =>
    dripKeeperProxy.setDripLM(dripLm.address)
  );
  await callIf("DripKeeper.pause", async () => dripKeeperProxy.paused(), () => dripKeeperProxy.pause());

  await txIf("BuybackUpkeep.agent", () => buybackUpkeepProxy.agent(), buybackAgent.address, () =>
    buybackUpkeepProxy.setAgent(buybackAgent.address)
  );
  await txIf(
    "BuybackUpkeep.threshold",
    () => buybackUpkeepProxy.minNativeThresholdWei(),
    parseEtherEnv("BUYBACK_UPKEEP_MIN_NATIVE", "0.5"),
    () => buybackUpkeepProxy.setThreshold(parseEtherEnv("BUYBACK_UPKEEP_MIN_NATIVE", "0.5"))
  );
  await txIf("BuybackUpkeep.paused", () => buybackUpkeepProxy.paused(), true, () =>
    buybackUpkeepProxy.setPaused(true)
  );

  await txIf("MasterConfig.pump", async () => (await masterConfig.pump()).dripLM, dripLm.address, () =>
    masterConfig.setPumpBranch(buybackAgent.address, dripLm.address, dripDistributor.address, policy.address)
  );
  await txIf("MasterConfig.liquidity", async () => (await masterConfig.liquidity()).liquidityManager, liquidityManager.address, () =>
    masterConfig.setLiquidityBranch(
      liquidityManager.address,
      liquidityVault.address,
      addresses.ROUTER,
      addresses.FACTORY,
      addresses.WETH
    )
  );
  await txIf("MasterConfig.supplyController", () => masterConfig.supplyController(), supplyController.address, () =>
    masterConfig.setSupplyController(supplyController.address)
  );
  await txIf("MasterConfig.supplyGuardian", () => masterConfig.supplyGuardian(), supplyGuardian.address, () =>
    masterConfig.setSupplyGuardian(supplyGuardian.address)
  );
  await txIf("MasterConfig.dexReserveGuard", () => masterConfig.dexReserveGuard(), dexReserveGuard.address, () =>
    masterConfig.setDexReserveGuard(dexReserveGuard.address)
  );

  addresses.MODERATOR_CENTER = moderatorCenter.address;
  addresses.BIGGI_MODERATOR_CENTER = moderatorCenter.address;
  addresses.SUPPLY_CONTROLLER = supplyController.address;
  addresses.SUPPLY_GUARDIAN = supplyGuardian.address;
  addresses.DEX_RESERVE_GUARD = dexReserveGuard.address;
  addresses.LIQUIDITY_VAULT = liquidityVault.address;
  addresses.LM_VAULT = liquidityVault.address;
  addresses.LIQUIDITY_MANAGER = liquidityManager.address;
  addresses.LM = liquidityManager.address;
  addresses.LIQUIDITY_ORCHESTRATOR = liquidityOrchestrator.address;
  addresses.LIQUIDITY_KEEPER_PROXY = liquidityKeeperProxy.address;
  addresses.KEEPER_PROXY = liquidityKeeperProxy.address;
  addresses.LIQUIDITY_PATH = "keeper_proxy";
  addresses.DRIP_LM = dripLm.address;
  addresses.DRIP_KEEPER_PROXY = dripKeeperProxy.address;
  addresses.BUYBACK_UPKEEP_PROXY = buybackUpkeepProxy.address;
  addresses.UPKEEP_PROXY = buybackUpkeepProxy.address;
  addresses.SUPPLY_CONTROLLER_READER = supplyControllerReader.address;
  addresses.SUPPLY_GUARDIAN_READER = supplyGuardianReader.address;
  addresses.DEX_RESERVE_GUARD_READER = dexReserveGuardReader.address;
  addresses.SYSTEM_READER = systemReader.address;
  addresses.LIQUIDITY_BRANCH_READER = liquidityBranchReader.address;
  addresses.LIQUIDITY_BRANCH_USER_READER = liquidityBranchReader.address;
  addresses.LIQUIDITY_HELPER_READER = liquidityHelperReader.address;
  addresses.BIGGI_TOKENOMICS_READER = biggiTokenomicsReader.address;
  addresses.BIGGI_TOKENOMIK_READER = biggiTokenomicsReader.address;
  addresses.TOKENOMIK_READER = biggiTokenomicsReader.address;
  addresses.MULTICALL = multicall.address;
  addresses.MULTICALL2 = multicall.address;
  addresses.TOKENOMICS_PHASE2_DEPLOYED = true;
  addresses.TOKENOMICS_PHASE2_CREATED_AT = new Date().toISOString();

  backupFile(phase2File);
  writeJson(phase2File, addresses);
  backupFile(masterFile);
  writeJson(masterFile, { ...master, ...addresses });
  backupFile(visibilityFile);
  writeJson(visibilityFile, { ...visibility, ...addresses });
  backupFile(phase1File);
  writeJson(phase1File, { ...phase1, ...addresses });

  const envUpdates = {
    ROUTER: addresses.ROUTER,
    FACTORY: addresses.FACTORY,
    WETH: addresses.WETH,
    WPOL: addresses.WPOL,
    PAIR: addresses.PAIR,
    QUOTE_TOKEN: addresses.QUOTE_TOKEN,
    MODERATOR_CENTER: addresses.MODERATOR_CENTER,
    BIGGI_MODERATOR_CENTER: addresses.BIGGI_MODERATOR_CENTER,
    SUPPLY_CONTROLLER: addresses.SUPPLY_CONTROLLER,
    SUPPLY_GUARDIAN: addresses.SUPPLY_GUARDIAN,
    DEX_RESERVE_GUARD: addresses.DEX_RESERVE_GUARD,
    LIQUIDITY_VAULT: addresses.LIQUIDITY_VAULT,
    LM_VAULT: addresses.LIQUIDITY_VAULT,
    LIQUIDITY_MANAGER: addresses.LIQUIDITY_MANAGER,
    LM: addresses.LIQUIDITY_MANAGER,
    LIQUIDITY_ORCHESTRATOR: addresses.LIQUIDITY_ORCHESTRATOR,
    LIQUIDITY_KEEPER_PROXY: addresses.LIQUIDITY_KEEPER_PROXY,
    KEEPER_PROXY: addresses.LIQUIDITY_KEEPER_PROXY,
    LIQUIDITY_PATH: "keeper_proxy",
    DRIP_LM: addresses.DRIP_LM,
    DRIP_KEEPER_PROXY: addresses.DRIP_KEEPER_PROXY,
    BUYBACK_UPKEEP_PROXY: addresses.BUYBACK_UPKEEP_PROXY,
    UPKEEP_PROXY: addresses.BUYBACK_UPKEEP_PROXY,
    SUPPLY_CONTROLLER_READER: addresses.SUPPLY_CONTROLLER_READER,
    SUPPLY_GUARDIAN_READER: addresses.SUPPLY_GUARDIAN_READER,
    DEX_RESERVE_GUARD_READER: addresses.DEX_RESERVE_GUARD_READER,
    SYSTEM_READER: addresses.SYSTEM_READER,
    LIQUIDITY_BRANCH_READER: addresses.LIQUIDITY_BRANCH_READER,
    LIQUIDITY_BRANCH_USER_READER: addresses.LIQUIDITY_BRANCH_READER,
    LIQUIDITY_HELPER_READER: addresses.LIQUIDITY_HELPER_READER,
    BIGGI_TOKENOMICS_READER: addresses.BIGGI_TOKENOMICS_READER,
    BIGGI_TOKENOMIK_READER: addresses.BIGGI_TOKENOMIK_READER,
    TOKENOMIK_READER: addresses.TOKENOMIK_READER,
    MULTICALL: addresses.MULTICALL,
  };
  mergeEnvFile(path.resolve(root, ".env.core.polygon"), envUpdates);
  mergeEnvFile(path.resolve(root, ".env"), envUpdates);
  mergeEnvFile(path.resolve(root, ".env.example"), envUpdates);

  console.log(`[WRITE] ${path.relative(root, phase2File)}`);
  console.log(`[WRITE] ${path.relative(root, masterFile)}`);
  console.log(`[WRITE] ${path.relative(root, visibilityFile)}`);
  console.log(`[WRITE] ${path.relative(root, phase1File)}`);
  console.log("Tokenomics phase 2 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
