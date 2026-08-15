const { spawnSync } = require("child_process");
const path = require("path");

const cwd = path.resolve(__dirname, "../..");
const cmd = "npx";
const args = [
  "hardhat",
  "run",
  "--config",
  "hardhat.biggi-master.cjs",
  "scripts/master/checkMasterStatus.js",
];

const env = { ...process.env, CHECK_STRICT: "1" };
const result = spawnSync(cmd, args, { cwd, env, stdio: "inherit", shell: true });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
