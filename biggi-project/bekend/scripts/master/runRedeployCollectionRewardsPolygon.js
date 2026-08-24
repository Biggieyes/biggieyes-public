const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

let executeRequested = false;
let resumeRequested = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") executeRequested = true;
  else if (arg === "--resume") resumeRequested = true;
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}
if (resumeRequested && !executeRequested) {
  throw new Error("--resume requires --execute");
}

process.env.REDEPLOY_COLLECTION_REWARDS_EXECUTE = executeRequested ? "1" : "0";
process.env.REDEPLOY_COLLECTION_REWARDS_RESUME = resumeRequested ? "1" : "0";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/redeployCollectionRewards.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
