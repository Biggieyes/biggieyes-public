const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

let execute = false;
let resume = false;
let stageChapters = 0;
let cutoverThrough = 0;
for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") execute = true;
  else if (arg === "--resume") resume = true;
  else if (/^--stage-chapters=\d+$/.test(arg)) stageChapters = Number(arg.split("=")[1]);
  else if (/^--cutover-through=\d+$/.test(arg)) cutoverThrough = Number(arg.split("=")[1]);
  else if (arg !== "--dry-run") throw new Error(`Unknown argument: ${arg}`);
}
if (resume && !execute) throw new Error("--resume requires --execute");
if (stageChapters < 0 || stageChapters > 5) throw new Error("--stage-chapters must be between 0 and 5");
if (cutoverThrough < 0 || cutoverThrough > 5) throw new Error("--cutover-through must be between 0 and 5");
if (stageChapters && cutoverThrough) throw new Error("--stage-chapters and --cutover-through are mutually exclusive");

process.env.CORE_V2_MIGRATION_EXECUTE = execute ? "1" : "0";
process.env.CORE_V2_MIGRATION_RESUME = resume ? "1" : "0";
process.env.CORE_V2_STAGE_CHAPTERS = String(stageChapters);
process.env.CORE_V2_CUTOVER_THROUGH = String(cutoverThrough);
process.env.PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/migrateCoreV2.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
