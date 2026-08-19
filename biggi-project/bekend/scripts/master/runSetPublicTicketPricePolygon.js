const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

const args = process.argv.slice(2);
for (const arg of args) {
  if (arg === "--execute") process.env.SET_PUBLIC_TICKET_PRICE_EXECUTE = "1";
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/setPublicTicketPrice.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
