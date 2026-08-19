const path = require("path");
const dotenv = require("dotenv");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
const preserved = {};
for (const key of [
  "EXECUTE_INITIAL_LIQUIDITY",
  "I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE",
  "DEPLOYER",
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
]) {
  if (process.env[key] !== undefined) preserved[key] = process.env[key];
}
dotenv.config({ path: envFile, override: true });
Object.assign(process.env, preserved);

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
