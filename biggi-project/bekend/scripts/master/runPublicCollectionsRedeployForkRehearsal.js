const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

if (!process.env.POLYGON_RPC_URL) throw new Error("POLYGON_RPC_URL is required for fork rehearsal");
process.env.FORK_URL = process.env.POLYGON_RPC_URL;
process.env.PUBLIC_REDEPLOY_FORK_REHEARSAL = "1";
process.env.REDEPLOY_PUBLIC_COLLECTIONS_EXECUTE = "1";
process.env.TX_CONFIRMATIONS = "1";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/redeployPublicCollections.js",
  "--network",
  "hardhat",
];

require("hardhat/internal/cli/cli");
