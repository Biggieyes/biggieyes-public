const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

let execute = false;
let chapterId = Number(process.env.npm_config_chapter || 0);
for (const arg of process.argv.slice(2)) {
  if (arg === "--execute") execute = true;
  else if (arg === "--dry-run") execute = false;
  else if (/^--chapter=\d+$/.test(arg)) chapterId = Number(arg.split("=")[1]);
  else throw new Error(`Unknown argument: ${arg}`);
}
if (!chapterId) throw new Error("Pass the target chapter as --chapter=N");

process.env.CHAPTER_ACTIVATION_ID = String(chapterId);
process.env.CHAPTER_ACTIVATION_EXECUTE = execute ? "1" : "0";
process.env.PRIVATE_KEY = String(process.env.OWNER_PRIVATE_KEY || "").trim();
process.argv = [
  process.argv[0],
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/activateSequentialChapter.js",
  "--network",
  "polygon",
];

require("hardhat/internal/cli/cli");
