const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function isZero(value) {
  return !value || String(value).toLowerCase() === ZERO.toLowerCase();
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ""));
}

function getAddress(value) {
  if (!value || !isAddress(value)) return ZERO;
  return ethers.utils.getAddress(value);
}

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
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

function resolveFile(inputPath, fallback) {
  const selected = inputPath || fallback;
  if (path.isAbsolute(selected)) return selected;
  return path.resolve(process.cwd(), selected);
}

async function codeExists(address) {
  if (isZero(address)) return false;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return (await ethers.provider.getCode(address)) !== "0x";
    } catch (err) {
      lastError = err;
      console.warn(`[WARN] getCode failed for ${address} attempt ${attempt}/3: ${err.message}`);
    }
  }
  throw lastError;
}

async function deployOrAttach(key, contractName, args, addresses) {
  const alias = key === "RESERVE" ? "RESERVE_ADDRESS" : key;
  const manifestCandidates = [getAddress(addresses[key]), getAddress(addresses[alias])];
  const envCandidates = [getAddress(process.env[key]), getAddress(process.env[alias])];

  for (const candidate of manifestCandidates) {
    if (isZero(candidate)) continue;
    if (!(await codeExists(candidate))) {
      throw new Error(`${key} manifest address has no code: ${candidate}`);
    }
    console.log(`[ATTACH] ${key}: ${candidate}`);
    return ethers.getContractAt(contractName, candidate);
  }

  for (const candidate of envCandidates) {
    if (isZero(candidate)) continue;
    if (await codeExists(candidate)) {
      console.log(`[ATTACH] ${key}: ${candidate}`);
      return ethers.getContractAt(contractName, candidate);
    }
    console.warn(`[WARN] ${key} env address has no code; ignoring stale value: ${candidate}`);
  }

  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  console.log(`[DEPLOY] ${key}/${contractName}: ${contract.address}`);
  addresses[key] = contract.address;
  if (key === "RESERVE") addresses.RESERVE_ADDRESS = contract.address;
  return contract;
}

async function txIf(label, readFn, expected, writeFn) {
  let current;
  try {
    current = await readFn();
  } catch {
    current = undefined;
  }
  if (current !== undefined) {
    if (typeof expected === "boolean" && current === expected) {
      console.log(`[SKIP] ${label}`);
      return false;
    }
    if (isAddress(expected) && isAddress(current) && getAddress(current) === getAddress(expected)) {
      console.log(`[SKIP] ${label}`);
      return false;
    }
  }
  console.log(`[SET] ${label}`);
  const tx = await writeFn();
  await tx.wait();
  return true;
}

function mergeEnvFile(file, values) {
  if (!fs.existsSync(file)) return;
  const original = fs.readFileSync(file, "utf8");
  const lines = original.split(/\r?\n/);
  const used = new Set();
  const next = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) return line;
    const key = match[1];
    if (!(key in values)) return line;
    used.add(key);
    return `${key}=${values[key]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!used.has(key)) next.push(`${key}=${value}`);
  }
  fs.writeFileSync(file, next.join("\n").replace(/\n+$/, "\n"));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const root = path.resolve(__dirname, "../..");
  const coreFile = resolveFile(env("CORE_ADDRESSES_FILE"), "addresses.visibility.polygon.json");
  const outputFile = resolveFile(env("TOKENOMICS_PHASE1_OUTPUT_FILE"), "addresses.tokenomics.phase1.polygon.json");
  const masterFile = path.resolve(root, "addresses.master.json");

  console.log("Network:", network.name);
  console.log("ChainId:", chain.chainId);
  console.log("Deployer:", deployer.address);

  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const core = loadJson(coreFile);
  const existingOutput = loadJson(outputFile);
  const master = loadJson(masterFile);
  const addresses = {
    ...master,
    ...core,
    ...existingOutput,
    network: network.name,
    chainId: chain.chainId,
    deployer: deployer.address,
  };
  const phaseManagedKeys = [
    "DISTRIBUTOR",
    "BIGGI_TOKEN",
    "RESERVE",
    "RESERVE_ADDRESS",
    "TREASURY",
    "DRIP_DISTRIBUTOR",
    "TOKEN_REWARDS",
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    "MASTER_CONFIG",
    "POLICY",
    "COMMUNITY_CENTER",
    "BUYBACK_AGENT",
    "MULTI_COLLECTION_READER",
    "RESERVE_TREASURY_READER",
    "BUYBACK_READER",
    "TOKEN_REWARDS_READER",
    "TOKENOMICS_SYSTEM_ADDON_READER",
  ];
  for (const key of phaseManagedKeys) {
    if (Object.prototype.hasOwnProperty.call(existingOutput, key)) {
      addresses[key] = existingOutput[key];
    } else if (Object.prototype.hasOwnProperty.call(core, key) && !isZero(core[key])) {
      addresses[key] = core[key];
    } else {
      addresses[key] = ZERO;
    }
  }

  const requiredCore = ["MAIN", "MAIN2", "TICKET_HUB", "COLLECTION_REWARDS", "REGISTRY", "NFT_REWARDS"];
  for (const key of requiredCore) {
    const value = getAddress(addresses[key]);
    if (isZero(value) || !(await codeExists(value))) {
      throw new Error(`Missing deployed core address ${key}: ${addresses[key] || "<empty>"}`);
    }
    addresses[key] = value;
  }

  const owner = getAddress(env("EXPECT_OWNER", env("OWNER", addresses.DEV_WALLET || deployer.address)));
  if (isZero(owner)) throw new Error("Owner address is not set.");

  const marketingSupport = getAddress(
    env("MARKETING_SUPPORT", env("DEV_WALLET", addresses.DEV_WALLET || deployer.address))
  );
  if (isZero(marketingSupport)) throw new Error("Marketing support address is not set.");

  const distributor = await deployOrAttach("DISTRIBUTOR", "BiggiMultiCollectionDistributor", [owner], addresses);
  const biggi = await deployOrAttach("BIGGI_TOKEN", "BiggiToken", [owner], addresses);
  const reserve = await deployOrAttach("RESERVE", "BiggiReserveV4", [biggi.address, owner], addresses);
  addresses.RESERVE_ADDRESS = reserve.address;
  const treasury = await deployOrAttach("TREASURY", "BiggiTreasury", [biggi.address, owner], addresses);
  const dripDistributor = await deployOrAttach("DRIP_DISTRIBUTOR", "BiggiDripDistributor", [biggi.address, owner], addresses);
  const tokenRewards = await deployOrAttach("TOKEN_REWARDS", "BiggiTokenRewards", [
    addresses.MAIN,
    addresses.MAIN2,
    biggi.address,
    owner,
  ], addresses);
  const emissionController = await deployOrAttach(
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    "BiggiTokenRewardsEmissionController",
    [tokenRewards.address, treasury.address, biggi.address, owner],
    addresses
  );
  const masterConfig = await deployOrAttach("MASTER_CONFIG", "BiggiMasterTokenomicsConfig", [owner], addresses);
  const policy = await deployOrAttach("POLICY", "BiggiPolicy", [owner], addresses);
  const communityCenter = await deployOrAttach("COMMUNITY_CENTER", "BiggiCommunityCenter", [owner], addresses);
  const buybackAgent = await deployOrAttach("BUYBACK_AGENT", "BiggiBuybackAgent", [biggi.address, owner], addresses);

  addresses.MARKETING_SUPPORT = marketingSupport;
  addresses.OWNER = owner;
  addresses.EXPECT_OWNER = owner;
  addresses.BIGGI_TOKEN = biggi.address;
  addresses.RESERVE = reserve.address;
  addresses.RESERVE_ADDRESS = reserve.address;
  addresses.TREASURY = treasury.address;
  addresses.DRIP_DISTRIBUTOR = dripDistributor.address;
  addresses.TOKEN_REWARDS = tokenRewards.address;
  addresses.TOKEN_REWARDS_EMISSION_CONTROLLER = emissionController.address;
  addresses.MASTER_CONFIG = masterConfig.address;
  addresses.POLICY = policy.address;
  addresses.COMMUNITY_CENTER = communityCenter.address;
  addresses.BUYBACK_AGENT = buybackAgent.address;
  addresses.TOKENOMICS_PHASE1_DEPLOYED = true;

  const collectionRewards = await ethers.getContractAt("BiggiCollectionRewards", addresses.COLLECTION_REWARDS);
  const ticketHub = await ethers.getContractAt("BiggiTicketHub", addresses.TICKET_HUB);
  const main2 = await ethers.getContractAt("BiggiEyesMain2", addresses.MAIN2);

  await txIf("Distributor.registry", () => distributor.registry(), addresses.REGISTRY, () => distributor.setRegistry(addresses.REGISTRY));
  for (const [label, collection] of [
    ["Distributor.collection MAIN", addresses.MAIN],
    ["Distributor.collection MAIN2", addresses.MAIN2],
    ["Distributor.collection TICKET_HUB", addresses.TICKET_HUB],
  ]) {
    await txIf(label, () => distributor.collections(collection), true, () => distributor.addCollection(collection));
  }
  await txIf(
    "Distributor.collectionRewards",
    () => distributor.collectionRewards(),
    addresses.COLLECTION_REWARDS,
    () => distributor.setCollectionRewards(addresses.COLLECTION_REWARDS)
  );
  await txIf("Distributor.reserve", () => distributor.reserve(), reserve.address, () => distributor.setReserve(reserve.address));
  await txIf("Distributor.treasury", () => distributor.treasury(), treasury.address, () => distributor.setTreasury(treasury.address));
  await txIf("Distributor.buybackAgent", () => distributor.buybackAgent(), buybackAgent.address, () =>
    distributor.setBuybackAgent(buybackAgent.address)
  );
  await txIf("Distributor.communityCenter", () => distributor.communityCenter(), communityCenter.address, () =>
    distributor.setCommunityCenter(communityCenter.address)
  );

  await txIf("Policy.buybackAgent", () => policy.buybackAgent(), buybackAgent.address, () =>
    policy.setBuybackAgent(buybackAgent.address)
  );
  await txIf("BuybackAgent.distributor", () => buybackAgent.distributor(), distributor.address, () =>
    buybackAgent.setDistributor(distributor.address)
  );
  await txIf("BuybackAgent.treasury", () => buybackAgent.treasury(), treasury.address, () =>
    buybackAgent.setTreasury(treasury.address)
  );
  await txIf("BuybackAgent.policy", () => buybackAgent.policy(), policy.address, () => buybackAgent.setPolicy(policy.address));
  await txIf("BuybackAgent.autoBuybackEnabled", () => buybackAgent.autoBuybackEnabled(), false, () =>
    buybackAgent.toggleAutoBuyback(false)
  );
  await txIf("CommunityCenter.distributor", () => communityCenter.distributor(), distributor.address, () =>
    communityCenter.setDistributor(distributor.address)
  );

  await txIf("CollectionRewards.distributor", () => collectionRewards.distributor(), distributor.address, () =>
    collectionRewards.setDistributor(distributor.address)
  );
  await txIf("CollectionRewards.registry", () => collectionRewards.registry(), addresses.REGISTRY, () =>
    collectionRewards.setRegistry(addresses.REGISTRY)
  );

  await txIf("Reserve.distributor", () => reserve.distributor(), distributor.address, () => reserve.setDistributor(distributor.address));
  await txIf("Treasury.distributor", () => treasury.distributor(), distributor.address, () => treasury.setDistributor(distributor.address));
  await txIf("Treasury.buybackAgent", () => treasury.buybackAgent(), buybackAgent.address, () =>
    treasury.setBuybackAgent(buybackAgent.address)
  );
  await txIf("Treasury.tokenRewards", () => treasury.tokenRewards(), tokenRewards.address, () => treasury.setTokenRewards(tokenRewards.address));
  await txIf("Treasury.reserve", () => treasury.reserveAddr(), reserve.address, () => treasury.setReserve(reserve.address));
  await txIf("Treasury.dripDistributor", () => treasury.dripDistributor(), dripDistributor.address, () =>
    treasury.setDripDistributor(dripDistributor.address)
  );
  await txIf("Treasury.ecosystemCaller TicketHub", () => treasury.ecosystemBiggiCallers(ticketHub.address), true, () =>
    treasury.setEcosystemBiggiCaller(ticketHub.address, true)
  );
  await txIf("Treasury.ecosystemCaller Main2", () => treasury.ecosystemBiggiCallers(main2.address), true, () =>
    treasury.setEcosystemBiggiCaller(main2.address, true)
  );

  await txIf("DripDistributor.treasury", () => dripDistributor.treasury(), treasury.address, () =>
    dripDistributor.setTreasury(treasury.address)
  );
  for (const [label, collection] of [
    ["DripDistributor.collection MAIN", addresses.MAIN],
    ["DripDistributor.collection MAIN2", addresses.MAIN2],
  ]) {
    await txIf(label, () => dripDistributor.collections(collection), true, () => dripDistributor.setCollection(collection, true));
  }

  await txIf("Token.reserve", () => biggi.reserveAddr(), reserve.address, () => biggi.setReserve(reserve.address));
  await txIf("Token.dripDistributor", () => biggi.dripDistributorAddr(), dripDistributor.address, () =>
    biggi.setDripDistributor(dripDistributor.address)
  );
  await txIf("Token.tokenRewards", () => biggi.tokenRewardsAddr(), tokenRewards.address, () =>
    biggi.setTokenRewards(tokenRewards.address)
  );
  await txIf("Token.marketingSupport", () => biggi.marketingSupportAddr(), marketingSupport, () =>
    biggi.setMarketingSupport(marketingSupport)
  );

  await txIf("TokenRewards.registry", () => tokenRewards.registry(), addresses.REGISTRY, () => tokenRewards.setRegistry(addresses.REGISTRY));
  await txIf("TokenRewards.treasure", () => tokenRewards.treasure(), treasury.address, () => tokenRewards.setTreasure(treasury.address));
  await txIf("TokenRewards.emissionController", () => tokenRewards.emissionController(), emissionController.address, () =>
    tokenRewards.setEmissionController(emissionController.address, true)
  );

  const tokenRewardsEmissionEnabled = envBool("TOKEN_REWARDS_EMISSION_ENABLED", true);
  await txIf("TokenRewards.emissionControllerEnabled", () => tokenRewards.emissionControllerEnabled(), tokenRewardsEmissionEnabled, () =>
    tokenRewards.setEmissionControllerEnabled(tokenRewardsEmissionEnabled)
  );

  await txIf("TicketHub.BIGGI", () => ticketHub.BIGGI(), biggi.address, () => ticketHub.setBiggiToken(biggi.address));
  await txIf("TicketHub.reserveAddress", () => ticketHub.reserveAddress(), reserve.address, () => ticketHub.setReserveAddress(reserve.address));
  await txIf("TicketHub.tokenSink", () => ticketHub.tokenSink(), treasury.address, () => ticketHub.setTokenSink(treasury.address, 10_000));
  await txIf("TicketHub.tokenSinkDepositMode", () => ticketHub.tokenSinkDepositMode(), true, () => ticketHub.setTokenSinkDepositMode(true));

  await txIf("Main2.BIGGI", () => main2.BIGGI(), biggi.address, () => main2.setBiggiToken(biggi.address));
  await txIf("Main2.distributor", () => main2.distributor(), distributor.address, () => main2.setDistributor(distributor.address));
  await txIf("Main2.reserveAddress", () => main2.reserveAddress(), reserve.address, () => main2.setReserveAddress(reserve.address));
  await txIf("Main2.tokenSink", () => main2.tokenSink(), treasury.address, () => main2.setTokenSink(treasury.address, 10_000));
  await txIf("Main2.tokenSinkDepositMode", () => main2.tokenSinkDepositMode(), true, () => main2.setTokenSinkDepositMode(true));

  const initialDistribution = envBool("EXECUTE_INITIAL_DISTRIBUTION", false);
  const distributed = await biggi.distributed();
  if (initialDistribution && !distributed) {
    console.log("[SET] BiggiToken.initialDistribute");
    await (await biggi.initialDistribute()).wait();
  } else if (!initialDistribution) {
    console.log("[SKIP] BiggiToken.initialDistribute (EXECUTE_INITIAL_DISTRIBUTION!=1)");
  } else {
    console.log("[SKIP] BiggiToken.initialDistribute already done");
  }

  await txIf("MasterConfig.core", async () => (await masterConfig.core()).biggi, biggi.address, () =>
    masterConfig.setCore(biggi.address, reserve.address, treasury.address, distributor.address)
  );
  await txIf("MasterConfig.rewards", async () => (await masterConfig.rewards()).communityCenter, communityCenter.address, () =>
    masterConfig.setRewards(addresses.COLLECTION_REWARDS, tokenRewards.address, addresses.NFT_REWARDS, communityCenter.address)
  );
  await txIf("MasterConfig.pump", async () => (await masterConfig.pump()).buybackAgent, buybackAgent.address, () =>
    masterConfig.setPumpBranch(buybackAgent.address, ZERO, dripDistributor.address, policy.address)
  );
  await txIf("MasterConfig.collections", async () => (await masterConfig.collections()).distributor, distributor.address, () =>
    masterConfig.setCollections(addresses.MAIN, addresses.MAIN2, tokenRewards.address, distributor.address)
  );

  const deployReaders = envBool("DEPLOY_TOKENOMICS_PHASE1_READERS", true);
  if (deployReaders) {
    const multiReader = await deployOrAttach("MULTI_COLLECTION_READER", "BiggiMultiCollectionDistributorReaderV2", [
      distributor.address,
    ], addresses);
    const reserveTreasuryReader = await deployOrAttach("RESERVE_TREASURY_READER", "BiggiReserveTreasuryReader", [
      reserve.address,
      treasury.address,
    ], addresses);
    const buybackReader = await deployOrAttach("BUYBACK_READER", "BiggiBuybackReader", [
      buybackAgent.address,
      treasury.address,
      policy.address,
      ZERO,
    ], addresses);
    const tokenRewardsReader = await deployOrAttach("TOKEN_REWARDS_READER", "BiggiTokenRewardsReader", [
      tokenRewards.address,
    ], addresses);
    const tokenomicsAddonReader = await deployOrAttach(
      "TOKENOMICS_SYSTEM_ADDON_READER",
      "BiggiTokenomicsSystemAddonReader",
      [masterConfig.address, biggi.address],
      addresses
    );
    addresses.MULTI_COLLECTION_READER = multiReader.address;
    addresses.RESERVE_TREASURY_READER = reserveTreasuryReader.address;
    addresses.BUYBACK_READER = buybackReader.address;
    addresses.TOKEN_REWARDS_READER = tokenRewardsReader.address;
    addresses.TOKENOMICS_SYSTEM_ADDON_READER = tokenomicsAddonReader.address;
  }

  addresses.createdAt = new Date().toISOString();
  backupFile(outputFile);
  writeJson(outputFile, addresses);

  const mergedMaster = { ...master, ...addresses };
  backupFile(masterFile);
  writeJson(masterFile, mergedMaster);

  const visibility = { ...core, ...addresses };
  backupFile(coreFile);
  writeJson(coreFile, visibility);

  const envUpdates = {
    DISTRIBUTOR: distributor.address,
    BIGGI_TOKEN: biggi.address,
    VITE_BIGGI_TOKEN_ADDRESS: biggi.address,
    RESERVE: reserve.address,
    RESERVE_ADDRESS: reserve.address,
    TREASURY: treasury.address,
    DRIP_DISTRIBUTOR: dripDistributor.address,
    TOKEN_REWARDS: tokenRewards.address,
    TOKEN_REWARDS_EMISSION_CONTROLLER: emissionController.address,
    MASTER_CONFIG: masterConfig.address,
    POLICY: policy.address,
    COMMUNITY_CENTER: communityCenter.address,
    BUYBACK_AGENT: buybackAgent.address,
    MARKETING_SUPPORT: marketingSupport,
    MULTI_COLLECTION_READER: addresses.MULTI_COLLECTION_READER || ZERO,
    RESERVE_TREASURY_READER: addresses.RESERVE_TREASURY_READER || ZERO,
    BUYBACK_READER: addresses.BUYBACK_READER || ZERO,
    TOKEN_REWARDS_READER: addresses.TOKEN_REWARDS_READER || ZERO,
    TOKENOMICS_SYSTEM_ADDON_READER: addresses.TOKENOMICS_SYSTEM_ADDON_READER || ZERO,
  };
  mergeEnvFile(path.resolve(root, ".env.core.polygon"), envUpdates);
  mergeEnvFile(path.resolve(root, ".env"), envUpdates);
  mergeEnvFile(path.resolve(root, ".env.example"), envUpdates);

  console.log(`[WRITE] ${path.relative(root, outputFile)}`);
  console.log(`[WRITE] ${path.relative(root, masterFile)}`);
  console.log(`[WRITE] ${path.relative(root, coreFile)}`);
  console.log("Tokenomics phase 1 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
