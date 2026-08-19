const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") process.env.SEED_MAIN2_METADATA_EXECUTE = "1";
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/seedMain2Metadata.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
