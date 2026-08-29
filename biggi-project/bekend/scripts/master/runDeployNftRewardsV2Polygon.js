const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

process.env.PRIVATE_KEY = String(
  process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
).trim();

let execute = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") execute = true;
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}

process.env.NFT_REWARDS_V2_DEPLOY_EXECUTE = execute ? "1" : "0";
process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/deployNftRewardsV2.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
