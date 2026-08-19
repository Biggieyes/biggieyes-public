const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env.core.polygon"), override: true });
process.env.EXECUTE_OWNERSHIP_TRANSFER = "1";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/executeOwnershipTransfer.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
