const path = require("path");
const dotenv = require("dotenv");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
dotenv.config({ path: envFile, override: true });

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/verifyTokenomicsPhase2.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
