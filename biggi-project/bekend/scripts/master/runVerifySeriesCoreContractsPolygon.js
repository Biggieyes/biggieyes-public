const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});
process.env.DISABLE_SOURCIFY_VERIFY = "1";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/verifySeriesCoreContracts.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
