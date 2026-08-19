const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const POLYGON_CRE_KEYSTONE_FORWARDER = "0x76c9cf548b4179F8901cda1f8623568b58215E62";
const PERFORM_UPKEEP_SELECTOR = ethers.utils.id("performUpkeep(bytes)").slice(0, 10);
const ROLL_CURRENT_WEEK_SELECTOR = ethers.utils.id("rollCurrentWeek()").slice(0, 10);

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name);
  if (raw === "") return fallback;
  const normalized = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean ${name}: ${raw}`);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ""));
}

function isBytes32(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value || ""));
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

function resolveFile(root, value, fallback) {
  const selected = value || fallback;
  if (path.isAbsolute(selected)) return selected;
  return path.resolve(root, selected);
}

function mergeEnvFile(file, values) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
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

async function codeExists(address) {
  if (!isSet(address)) return false;
  return (await ethers.provider.getCode(address)) !== "0x";
}

async function deployOrAttachReceiver(addresses, owner, forwarder) {
  const candidates = [
    env("CRE_AUTOMATION_RECEIVER"),
    addresses.CRE_AUTOMATION_RECEIVER,
  ].map(getAddress);

  for (const candidate of candidates) {
    if (!isSet(candidate)) continue;
    if (await codeExists(candidate)) {
      console.log(`[ATTACH] CRE_AUTOMATION_RECEIVER: ${candidate}`);
      addresses.CRE_AUTOMATION_RECEIVER = candidate;
      return ethers.getContractAt("BiggiCREAutomationReceiver", candidate);
    }
    console.warn(`[WARN] ignoring CRE_AUTOMATION_RECEIVER without code: ${candidate}`);
  }

  const Factory = await ethers.getContractFactory("BiggiCREAutomationReceiver");
  const receiver = await Factory.deploy(owner, forwarder);
  await receiver.deployed();
  addresses.CRE_AUTOMATION_RECEIVER = receiver.address;
  console.log(`[DEPLOY] CRE_AUTOMATION_RECEIVER: ${receiver.address}`);
  return receiver;
}

async function attachOptional(addresses, key, contractName) {
  const address = getAddress(env(key, addresses[key] || ""));
  if (!isSet(address)) {
    console.log(`[SKIP] ${key}: missing`);
    return null;
  }
  if (!(await codeExists(address))) {
    console.log(`[SKIP] ${key}: no code at ${address}`);
    return null;
  }
  return ethers.getContractAt(contractName, address);
}

async function txIf(label, readFn, expected, writeFn) {
  try {
    const current = await readFn();
    if (typeof expected === "boolean" && current === expected) {
      console.log(`[SKIP] ${label}`);
      return false;
    }
    if (isAddress(expected) && isAddress(current) && getAddress(current) === getAddress(expected)) {
      console.log(`[SKIP] ${label}`);
      return false;
    }
  } catch {}

  console.log(`[SET] ${label}`);
  const tx = await writeFn();
  await tx.wait();
  return true;
}

async function wireKeeperTargets(addresses, receiver) {
  const receiverAddr = receiver.address;
  const receiverCalls = [
    ["SUPPLY_CONTROLLER", getAddress(addresses.SUPPLY_CONTROLLER), PERFORM_UPKEEP_SELECTOR],
    ["BUYBACK_UPKEEP_PROXY", getAddress(addresses.BUYBACK_UPKEEP_PROXY), PERFORM_UPKEEP_SELECTOR],
    ["LIQUIDITY_KEEPER_PROXY", getAddress(addresses.LIQUIDITY_KEEPER_PROXY), PERFORM_UPKEEP_SELECTOR],
    ["DEX_RESERVE_GUARD", getAddress(addresses.DEX_RESERVE_GUARD), PERFORM_UPKEEP_SELECTOR],
    [
      "TOKEN_REWARDS_EMISSION_CONTROLLER",
      getAddress(addresses.TOKEN_REWARDS_EMISSION_CONTROLLER),
      ROLL_CURRENT_WEEK_SELECTOR,
    ],
  ];
  const missingTargets = [];
  const missingSelectors = [];
  for (const [key, target, selector] of receiverCalls) {
    if (!isSet(target) || !(await codeExists(target))) {
      console.log(`[SKIP] receiver allow ${key}: missing target/code`);
      continue;
    }
    if (!(await receiver.callAllowed(target, selector))) {
      missingTargets.push(target);
      missingSelectors.push(selector);
    }
  }
  if (missingTargets.length > 0) {
    console.log(`[SET] CRE receiver call allowlist (${missingTargets.length} calls)`);
    const tx = await receiver.setCallsAllowed(missingTargets, missingSelectors, true);
    await tx.wait();
  } else {
    console.log("[SKIP] CRE receiver call allowlist");
  }

  const supply = await attachOptional(addresses, "SUPPLY_CONTROLLER", "BiggiSupplyController");
  if (supply) {
    await txIf(
      "SupplyController.allowedCallers(CRE receiver)",
      () => supply.allowedCallers(receiverAddr),
      true,
      () => supply.setAllowedCaller(receiverAddr, true)
    );
  }

  const dexGuard = await attachOptional(addresses, "DEX_RESERVE_GUARD", "BiggiDexReserveGuard");
  if (dexGuard) {
    await txIf(
      "DexReserveGuard.keepers(CRE receiver)",
      () => dexGuard.keepers(receiverAddr),
      true,
      () => dexGuard.setKeeper(receiverAddr, true)
    );
  }

  const emissionController = await attachOptional(
    addresses,
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    "BiggiTokenRewardsEmissionController"
  );
  if (emissionController) {
    await txIf(
      "TokenRewardsEmissionController.keepers(CRE receiver)",
      () => emissionController.keepers(receiverAddr),
      true,
      () => emissionController.setKeeper(receiverAddr, true)
    );
  }

  const liquidityKeeper = await attachOptional(addresses, "LIQUIDITY_KEEPER_PROXY", "BiggiLiquidityKeeperProxy");
  if (liquidityKeeper) {
    await txIf(
      "LiquidityKeeperProxy.allowedCaller(CRE receiver)",
      () => liquidityKeeper.allowedCaller(),
      receiverAddr,
      () => liquidityKeeper.setAllowedCaller(receiverAddr)
    );
  }
}

async function configureWorkflowIdentity(receiver) {
  const workflowIdRaw = env("CRE_EXPECTED_WORKFLOW_ID");
  const workflowOwnerRaw = env("CRE_EXPECTED_WORKFLOW_OWNER");
  if (!workflowIdRaw && !workflowOwnerRaw) {
    console.log("[INFO] Workflow identity lock skipped; set CRE_EXPECTED_WORKFLOW_ID/OWNER after workflow deploy.");
    return;
  }

  if (workflowIdRaw && !isBytes32(workflowIdRaw)) {
    throw new Error("CRE_EXPECTED_WORKFLOW_ID must be bytes32");
  }
  if (workflowOwnerRaw && !isAddress(workflowOwnerRaw)) {
    throw new Error("CRE_EXPECTED_WORKFLOW_OWNER must be an address");
  }

  const expectedId = workflowIdRaw || ethers.constants.HashZero;
  const expectedOwner = workflowOwnerRaw ? getAddress(workflowOwnerRaw) : ZERO;
  const currentId = await receiver.expectedWorkflowId();
  const currentOwner = await receiver.expectedWorkflowOwner();
  if (
    currentId.toLowerCase() === expectedId.toLowerCase() &&
    getAddress(currentOwner) === expectedOwner
  ) {
    console.log("[SKIP] CRE receiver workflow identity");
    return;
  }

  console.log("[SET] CRE receiver workflow identity");
  const tx = await receiver.setExpectedWorkflowIdentity(expectedId, expectedOwner);
  await tx.wait();
}

async function requireAttached(addresses, key, contractName) {
  const contract = await attachOptional(addresses, key, contractName);
  if (!contract) throw new Error(`${key} is required before CRE receiver activation`);
  return contract;
}

async function assertReceiverReady(addresses, receiver, forwarder) {
  if (getAddress(await receiver.keystoneForwarder()) !== getAddress(forwarder)) {
    throw new Error("CRE receiver forwarder mismatch");
  }
  if ((await receiver.expectedWorkflowId()) === ethers.constants.HashZero) {
    throw new Error("CRE_EXPECTED_WORKFLOW_ID must be locked before receiver activation");
  }
  if (getAddress(await receiver.expectedWorkflowOwner()) === ZERO) {
    throw new Error("CRE_EXPECTED_WORKFLOW_OWNER must be locked before receiver activation");
  }

  const allowedCalls = [
    ["SUPPLY_CONTROLLER", PERFORM_UPKEEP_SELECTOR],
    ["BUYBACK_UPKEEP_PROXY", PERFORM_UPKEEP_SELECTOR],
    ["LIQUIDITY_KEEPER_PROXY", PERFORM_UPKEEP_SELECTOR],
    ["DEX_RESERVE_GUARD", PERFORM_UPKEEP_SELECTOR],
    ["TOKEN_REWARDS_EMISSION_CONTROLLER", ROLL_CURRENT_WEEK_SELECTOR],
  ];
  for (const [key, selector] of allowedCalls) {
    const target = getAddress(addresses[key]);
    if (!isSet(target) || !(await receiver.callAllowed(target, selector))) {
      throw new Error(`CRE receiver call is not allowed: ${key}.${selector}`);
    }
  }

  const supply = await requireAttached(addresses, "SUPPLY_CONTROLLER", "BiggiSupplyController");
  if (!(await supply.allowedCallers(receiver.address))) {
    throw new Error("SupplyController does not authorize CRE receiver");
  }
  const dexGuard = await requireAttached(addresses, "DEX_RESERVE_GUARD", "BiggiDexReserveGuard");
  if (!(await dexGuard.keepers(receiver.address))) {
    throw new Error("DexReserveGuard does not authorize CRE receiver");
  }
  const emissionController = await requireAttached(
    addresses,
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    "BiggiTokenRewardsEmissionController"
  );
  if (!(await emissionController.keepers(receiver.address))) {
    throw new Error("TokenRewardsEmissionController does not authorize CRE receiver");
  }
  const liquidityKeeper = await requireAttached(
    addresses,
    "LIQUIDITY_KEEPER_PROXY",
    "BiggiLiquidityKeeperProxy"
  );
  if (getAddress(await liquidityKeeper.allowedCaller()) !== getAddress(receiver.address)) {
    throw new Error("LiquidityKeeperProxy does not authorize CRE receiver");
  }
}

function updateCreProductionConfig(root, receiverAddress) {
  const configFile = path.resolve(root, "cre-workflows/biggi-cre/my-workflow/config.production.json");
  if (!fs.existsSync(configFile)) return;
  const config = loadJson(configFile);
  config.receiverAddress = receiverAddress;
  backupFile(configFile);
  writeJson(configFile, config);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const root = path.resolve(__dirname, "../..");
  const addressesFile = resolveFile(root, env("MASTER_ADDRESSES_FILE"), "addresses.master.json");
  const envFile = resolveFile(root, env("MASTER_ENV_FILE"), ".env.core.polygon");
  const wire = envBool("CRE_WIRE", process.argv.includes("--wire"));
  const activateReceiver = envBool("CRE_ACTIVATE_RECEIVER", process.argv.includes("--activate"));

  console.log("Network:", network.name);
  console.log("ChainId:", chain.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Addresses:", addressesFile);

  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const addresses = loadJson(addressesFile);
  const owner = getAddress(
    env("CRE_RECEIVER_OWNER", env("EXPECT_OWNER", addresses.OWNER || deployer.address))
  );
  const compromisedOwner = getAddress(env("COMPROMISED_OWNER_ADDRESS"));
  const forwarder = getAddress(env(
    "CRE_KEYSTONE_FORWARDER",
    addresses.CRE_KEYSTONE_FORWARDER || (chain.chainId === 137 ? POLYGON_CRE_KEYSTONE_FORWARDER : "")
  ));

  if (!isSet(owner)) throw new Error("CRE_RECEIVER_OWNER is required");
  if (!isSet(forwarder)) throw new Error("CRE_KEYSTONE_FORWARDER is required");
  if (isSet(compromisedOwner) && getAddress(deployer.address) === compromisedOwner) {
    throw new Error("Refusing CRE mainnet transaction from COMPROMISED_OWNER_ADDRESS");
  }
  if (isSet(compromisedOwner) && owner === compromisedOwner) {
    throw new Error("Refusing to assign CRE receiver ownership to COMPROMISED_OWNER_ADDRESS");
  }

  const receiver = await deployOrAttachReceiver(addresses, owner, forwarder);

  await txIf(
    "CRE receiver forwarder",
    () => receiver.keystoneForwarder(),
    forwarder,
    () => receiver.setKeystoneForwarder(forwarder)
  );
  await configureWorkflowIdentity(receiver);

  addresses.CRE_KEYSTONE_FORWARDER = forwarder;
  addresses.CRE_RECEIVER_INITIAL_OWNER = owner;
  addresses.CRE_CHAIN_NAME = "polygon-mainnet";
  addresses.CRE_PERFORM_UPKEEP_SELECTOR = PERFORM_UPKEEP_SELECTOR;
  addresses.CRE_ROLL_CURRENT_WEEK_SELECTOR = ROLL_CURRENT_WEEK_SELECTOR;

  if (wire) {
    await wireKeeperTargets(addresses, receiver);
  } else {
    console.log("[INFO] Wiring skipped. Re-run with --wire or CRE_WIRE=1 after receiver owner/deployer can configure targets.");
  }

  if (activateReceiver) {
    await assertReceiverReady(addresses, receiver, forwarder);
    await txIf(
      "CRE receiver unpause",
      () => receiver.paused(),
      false,
      () => receiver.unpause()
    );
  } else if (await receiver.paused()) {
    console.log("[INFO] CRE receiver remains paused until the explicit activation command.");
  } else {
    console.warn("[WARN] CRE receiver is already unpaused.");
  }

  backupFile(addressesFile);
  writeJson(addressesFile, addresses);
  mergeEnvFile(envFile, {
    CRE_KEYSTONE_FORWARDER: forwarder,
    CRE_AUTOMATION_RECEIVER: receiver.address,
    CRE_RECEIVER_INITIAL_OWNER: owner,
    CRE_CHAIN_NAME: "polygon-mainnet",
  });
  updateCreProductionConfig(root, receiver.address);

  console.log("CRE receiver:", receiver.address);
  console.log("CRE forwarder:", forwarder);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
