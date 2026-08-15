const path = require("path");
const dotenv = require("dotenv");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
const executeOverride = process.env.EXECUTE_INITIAL_LIQUIDITY;
const irreversibleOverride = process.env.I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE;
dotenv.config({ path: envFile, override: true });
if (executeOverride !== undefined) process.env.EXECUTE_INITIAL_LIQUIDITY = executeOverride;
if (irreversibleOverride !== undefined) {
  process.env.I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE = irreversibleOverride;
}

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
