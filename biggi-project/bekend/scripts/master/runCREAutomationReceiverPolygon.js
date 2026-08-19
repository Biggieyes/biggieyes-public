const path = require("path");
const dotenv = require("dotenv");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
dotenv.config({ path: envFile, override: true });

if (process.argv.includes("--wire")) {
  process.env.CRE_WIRE = "1";
}
if (process.argv.includes("--activate")) {
  process.env.CRE_ACTIVATE_RECEIVER = "1";
}

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/deployCREAutomationReceiver.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
