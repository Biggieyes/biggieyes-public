const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

let execute = false;
let resume = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") execute = true;
  else if (arg === "--resume") resume = true;
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}
if (resume && !execute) throw new Error("--resume requires --execute");

if (!String(process.env.PRIVATE_KEY || "").trim()) {
  process.env.PRIVATE_KEY = String(process.env.DEPLOYER_PRIVATE_KEY || "").trim();
}
process.env.PUBLIC_UNLOCK_V2_EXECUTE = execute ? "1" : "0";
process.env.PUBLIC_UNLOCK_V2_RESUME = resume ? "1" : "0";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/migratePublicUnlockV2.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
