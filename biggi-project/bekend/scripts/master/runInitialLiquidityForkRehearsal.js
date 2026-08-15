const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env.core.polygon"), override: true });
process.env.FORK_URL = process.env.POLYGON_FORK_RPC_URL || "https://polygon.drpc.org";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/rehearseInitialLiquidityFork.js",
  "--network",
  "hardhat",
];

require("hardhat/internal/cli/cli");
