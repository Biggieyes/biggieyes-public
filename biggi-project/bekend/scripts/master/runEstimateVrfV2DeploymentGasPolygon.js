const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

process.env.PRIVATE_KEY = String(
  process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
).trim();

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--no-compile",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/estimateVrfV2DeploymentGas.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
