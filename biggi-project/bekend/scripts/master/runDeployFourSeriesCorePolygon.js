const path = require("path");
const dotenv = require("dotenv");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
dotenv.config({ path: envFile, override: true });

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--execute") process.env.DEPLOY_SERIES_CORE_EXECUTE = "1";
  else if (arg === "--dry-run") process.env.DEPLOY_SERIES_CORE_EXECUTE = "0";
  else if (arg === "--preflight-only") process.env.DEPLOY_SERIES_CORE_PREFLIGHT_ONLY = "1";
  else if (arg === "--resume") process.env.DEPLOY_SERIES_CORE_RESUME = "1";
  else if (arg === "--update-master") process.env.UPDATE_MASTER_ADDRESSES = "1";
  else if (arg === "--mint-marketing") process.env.MINT_MARKETING_TICKETS = "1";
  else if (arg === "--output") {
    const output = args[i + 1];
    if (!output) throw new Error("--output requires a file path");
    process.env.SERIES_CORE_OUTPUT_FILE = output;
    i += 1;
  } else {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/deployFourSeriesCore.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
