const path = require("path");
const dotenv = require("dotenv");

const envFile = path.resolve(__dirname, "../../.env.core.polygon");
dotenv.config({ path: envFile, override: true });

process.env.CONFIGURE_CHAPTER_EXECUTE = process.argv.includes("--execute") ? "1" : "0";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/configureChapterTokenomics.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
