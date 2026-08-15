const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function resolveFile(inputPath) {
  if (!inputPath) return path.resolve(process.cwd(), "addresses.visibility.polygon.json");
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || "")) && String(value).toLowerCase() !== ZERO;
}

function asBytes32(value) {
  const raw = String(value || "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`Invalid bytes32: ${raw}`);
  return raw;
}

function verificationTargets(addresses) {
  const deployer = addresses.deployer;
  const vrfCoordinator = env("VRF_COORDINATOR", addresses.VRF_COORDINATOR);
  const vrfKeyHash = env("VRF_KEY_HASH", addresses.VRF_KEY_HASH);
  const vrfSubId = env("VRF_SUB_ID", addresses.VRF_SUB_ID);

  return [
    {
      key: "BIGGI_NAMES_LIB",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_LIBRARY/BiggiNamesLib.sol:BiggiNamesLib",
      args: [],
    },
    {
      key: "COMPUTE",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiCompute.sol:BiggiCompute",
      args: [],
    },
    {
      key: "MAIN",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMain.sol:BiggiEyesMain",
      args: [deployer],
      libraries: { BiggiNamesLib: addresses.BIGGI_NAMES_LIB },
    },
    {
      key: "TICKET_HUB",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiTicketHub.sol:BiggiTicketHub",
      args: [deployer, addresses.MAIN],
    },
    {
      key: "COLLECTION_REWARDS",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiCollectionRewards.sol:BiggiCollectionRewards",
      args: [addresses.MAIN, deployer],
    },
    {
      key: "VRF_ROUTER",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiVrfRouter.sol:BiggiVRFRouter",
      args: [vrfCoordinator, deployer, asBytes32(vrfKeyHash), vrfSubId],
    },
    {
      key: "BIGGI_NAMES_LIB2",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_LIBRARY/BiggiNamesLib2.sol:BiggiNamesLib2",
      args: [],
    },
    {
      key: "REGISTRY",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiSeriesRegistry.sol:BiggiSeriesRegistry",
      args: [deployer],
    },
    {
      key: "CHAPTER_CONTROLLER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiChapterController.sol:BiggiChapterController",
      args: [deployer, addresses.REGISTRY],
    },
    {
      key: "MAIN2",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMain2.sol:BiggiEyesMain2",
      args: [deployer],
      libraries: { BiggiNamesLib2: addresses.BIGGI_NAMES_LIB2 },
    },
    {
      key: "NFT_REWARDS",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiNftRewards.sol:BiggiNFTRewards",
      args: [deployer],
    },
    {
      key: "MAIN_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMainReader.sol:BiggiMainReader",
      args: [addresses.MAIN, addresses.TICKET_HUB, addresses.COLLECTION_REWARDS || ZERO],
    },
    {
      key: "CHAPTER_SERIES_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiChapterSeriesReader.sol:BiggiChapterSeriesReader",
      args: [addresses.CHAPTER_CONTROLLER, addresses.REGISTRY],
    },
    {
      key: "NFT_REWARDS_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiNftRewardsReader.sol:BiggiNftRewardsReader",
      args: [addresses.NFT_REWARDS],
    },
    {
      key: "MULTI_COLLECTION_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMultiCollectionDistributorReaderV2.sol:BiggiMultiCollectionDistributorReaderV2",
      args: [addresses.DISTRIBUTOR],
    },
  ];
}

async function verifyOne(target) {
  if (!isAddress(target.address)) {
    console.log(`[SKIP] ${target.key}: no deployed address`);
    return;
  }
  if (target.libraries) {
    for (const [name, address] of Object.entries(target.libraries)) {
      if (!isAddress(address)) throw new Error(`${target.key} missing library ${name}`);
    }
  }
  console.log(`[VERIFY] ${target.key}: ${target.address}`);
  try {
    await hre.run("verify:verify", {
      address: target.address,
      constructorArguments: target.args,
      contract: target.contract,
      libraries: target.libraries || {},
    });
    console.log(`[OK] ${target.key}`);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/already verified/i.test(msg) || /already been verified/i.test(msg)) {
      console.log(`[OK] ${target.key}: already verified`);
      return;
    }
    console.log(`[FAIL] ${target.key}: ${msg}`);
    throw err;
  }
}

async function main() {
  const addressesFile = resolveFile(env("ADDRESSES_FILE", env("OUTPUT_FILE")));
  if (!fs.existsSync(addressesFile)) throw new Error(`Addresses file not found: ${addressesFile}`);
  const addresses = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
  const targets = verificationTargets(addresses).map((target) => ({
    ...target,
    address: addresses[target.key],
  }));

  for (const target of targets) {
    await verifyOne(target);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
