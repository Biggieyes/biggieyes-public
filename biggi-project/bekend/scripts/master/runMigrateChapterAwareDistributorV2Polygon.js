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
process.env.PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
process.env.DISTRIBUTOR_V2_MIGRATION_EXECUTE = execute ? "1" : "0";
process.env.DISTRIBUTOR_V2_MIGRATION_RESUME = resume ? "1" : "0";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/migrateChapterAwareDistributorV2.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
