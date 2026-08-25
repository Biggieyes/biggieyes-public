const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
const preserved = {};
for (const key of [
  "EXECUTE_INITIAL_LIQUIDITY",
  "I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE",
  "DEPLOYER",
  "LIQUIDITY_OWNER",
  "LIQ_TOKEN_AMOUNT",
  "LIQ_NATIVE_AMOUNT",
  "LIQ_ETH_AMOUNT",
  "LIQ_LP_RECIPIENT",
  "TRANSFER_FROM_RESERVE",
  "ALLOW_UNSYNCED_VAULT_LP",
  "LIQ_REQUIRE_EMPTY_PAIR",
  "LIQ_REQUIRE_VAULT_RECIPIENT",
  "LIQ_INITIAL_SLIPPAGE_BPS",
  "LIQ_POST_SEED_SYNC_POL",
  "LIQ_DEADLINE_SEC",
]) {
  if (process.env[key] !== undefined) preserved[key] = process.env[key];
}
dotenv.config({ path: envFile, override: true });
Object.assign(process.env, preserved);

const root = path.resolve(__dirname, "../..");
const productionConfig = JSON.parse(
  fs.readFileSync(path.resolve(root, "config/production-activation.polygon.json"), "utf8")
);
const addresses = JSON.parse(fs.readFileSync(path.resolve(root, "addresses.master.json"), "utf8"));
const liquidity = productionConfig.initialLiquidity;

function setDefault(name, value) {
  if (process.env[name] == null || process.env[name] === "") {
    process.env[name] = String(value);
  }
}

setDefault("LIQUIDITY_OWNER", addresses[productionConfig.authority.ownerAddressKey]);
setDefault("LIQ_TOKEN_AMOUNT", ethers.utils.formatEther(liquidity.tokenAmountWei));
setDefault("LIQ_NATIVE_AMOUNT", ethers.utils.formatEther(liquidity.nativeAmountWei));
setDefault("LIQ_LP_RECIPIENT", addresses[liquidity.lpRecipientAddressKey]);
setDefault("TRANSFER_FROM_RESERVE", "1");
setDefault("LIQ_REQUIRE_EMPTY_PAIR", liquidity.requireEmptyPair ? "1" : "0");
setDefault("LIQ_REQUIRE_VAULT_RECIPIENT", "1");
setDefault("LIQ_INITIAL_SLIPPAGE_BPS", liquidity.slippageBps);
setDefault("LIQ_POST_SEED_SYNC_POL", ethers.utils.formatEther(liquidity.postSeedSyncNativeWei));
setDefault("LIQ_DEADLINE_SEC", liquidity.deadlineSec);

// Initial liquidity requires the BiggiToken owner, not the historical deployer.
if (process.env.OWNER_PRIVATE_KEY) process.env.PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/prepareInitialLiquidity.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
