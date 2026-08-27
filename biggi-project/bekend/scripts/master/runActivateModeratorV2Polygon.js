const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

if (!String(process.env.PRIVATE_KEY || "").trim()) {
  process.env.PRIVATE_KEY = String(process.env.OWNER_PRIVATE_KEY || "").trim();
}
if (!process.env.PRIVATE_KEY) {
  throw new Error("OWNER_PRIVATE_KEY is required for ModeratorCenterV2 activation");
}

let execute = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") execute = true;
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}

process.env.MODERATOR_V2_ACTIVATE_EXECUTE = execute ? "1" : "0";
process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/activateModeratorV2.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
