const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function resolveFile(inputPath) {
  const selected = inputPath || "addresses.tokenomics.phase1.polygon.json";
  if (path.isAbsolute(selected)) return selected;
  return path.resolve(process.cwd(), selected);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || "")) && String(value).toLowerCase() !== ZERO;
}

function targets(a) {
  const owner = a.MARKETING_SUPPORT_OWNER || a.EXPECT_OWNER || a.DEV_WALLET || a.deployer;
  return [
    {
      key: "DISTRIBUTOR",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMultiCollectionDistributor.sol:BiggiMultiCollectionDistributor",
      args: [owner],
    },
    {
      key: "BIGGI_TOKEN",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiToken.sol:BiggiToken",
      args: [owner],
    },
    {
      key: "RESERVE",
      aliases: ["RESERVE_ADDRESS"],
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiReserveV4.sol:BiggiReserveV4",
      args: [a.BIGGI_TOKEN, owner],
    },
    {
      key: "TREASURY",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiTreasury.sol:BiggiTreasury",
      args: [a.BIGGI_TOKEN, owner],
    },
    {
      key: "DRIP_DISTRIBUTOR",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiDripDistributor.sol:BiggiDripDistributor",
      args: [a.BIGGI_TOKEN, owner],
    },
    {
      key: "TOKEN_REWARDS",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiTokenRewards.sol:BiggiTokenRewards",
      args: [a.MAIN, a.MAIN2, a.BIGGI_TOKEN, owner],
    },
    {
      key: "TOKEN_REWARDS_EMISSION_CONTROLLER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiTokenRewardsEmissionController.sol:BiggiTokenRewardsEmissionController",
      args: [a.TOKEN_REWARDS, a.TREASURY, a.BIGGI_TOKEN, owner],
    },
    {
      key: "MASTER_CONFIG",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiMasterTokenomicsConfig.sol:BiggiMasterTokenomicsConfig",
      args: [owner],
    },
    {
      key: "POLICY",
      contract: "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiPolicy.sol:BiggiPolicy",
      args: [owner],
    },
    {
      key: "COMMUNITY_CENTER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiCommunityCenter.sol:BiggiCommunityCenter",
      args: [owner],
    },
    {
      key: "BUYBACK_AGENT",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiBuybackAgent.sol:BiggiBuybackAgent",
      args: [a.BIGGI_TOKEN, owner],
    },
    {
      key: "MULTI_COLLECTION_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMultiCollectionDistributorReaderV2.sol:BiggiMultiCollectionDistributorReaderV2",
      args: [a.DISTRIBUTOR],
    },
    {
      key: "RESERVE_TREASURY_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiReserveTreasuryReader.sol:BiggiReserveTreasuryReader",
      args: [a.RESERVE || a.RESERVE_ADDRESS, a.TREASURY],
    },
    {
      key: "BUYBACK_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiBuybackReader.sol:BiggiBuybackReader",
      args: [a.BUYBACK_AGENT, a.TREASURY, a.POLICY, ZERO],
    },
    {
      key: "TOKEN_REWARDS_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiTokenRewardsReader.sol:BiggiTokenRewardsReader",
      args: [a.TOKEN_REWARDS],
    },
    {
      key: "TOKENOMICS_SYSTEM_ADDON_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiTokenomicsSystemAddonReader.sol:BiggiTokenomicsSystemAddonReader",
      args: [a.MASTER_CONFIG, a.BIGGI_TOKEN],
    },
  ];
}

async function verifyOne(target, addresses) {
  let address = addresses[target.key];
  if (!isAddress(address) && target.aliases) {
    for (const alias of target.aliases) {
      if (isAddress(addresses[alias])) {
        address = addresses[alias];
        break;
      }
    }
  }
  if (!isAddress(address)) {
    console.log(`[SKIP] ${target.key}: no deployed address`);
    return;
  }
  console.log(`[VERIFY] ${target.key}: ${address}`);
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: target.args,
      contract: target.contract,
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
  const addressesFile = resolveFile(env("TOKENOMICS_PHASE1_OUTPUT_FILE"));
  if (!fs.existsSync(addressesFile)) throw new Error(`Addresses file not found: ${addressesFile}`);
  const addresses = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
  for (const target of targets(addresses)) {
    await verifyOne(target, addresses);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
