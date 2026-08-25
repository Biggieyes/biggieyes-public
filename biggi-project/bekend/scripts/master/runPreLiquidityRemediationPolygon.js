const path = require("path");
const dotenv = require("dotenv");

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--execute");
if (unknown.length) {
  throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
}

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

if (process.env.OWNER_PRIVATE_KEY) {
  process.env.PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
}

if (args.includes("--execute")) {
  process.env.EXECUTE_PRE_LIQUIDITY_REMEDIATION = "1";
}

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/remediatePreLiquidityParameters.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
