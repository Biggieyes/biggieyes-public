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

// CLI flags are authoritative. Values accidentally left in the shell or env
// file must never turn a dry-run into a write operation.
process.env.REDEPLOY_PUBLIC_COLLECTIONS_EXECUTE = executeRequested ? "1" : "0";
process.env.REDEPLOY_PUBLIC_COLLECTIONS_RESUME = resumeRequested ? "1" : "0";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/redeployPublicCollections.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
