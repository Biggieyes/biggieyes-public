const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const cwd = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(cwd, ".env.core.polygon") });

const forkUrl =
  process.env.POLYGON_FORK_RPC_URL ||
  process.env.FORK_URL ||
  process.env.POLYGON_RPC_URL ||
  "https://polygon.drpc.org";

const reportPath = path.resolve(cwd, "reports/cre-automation-adversarial-gas-fork.json");
const evidencePath = path.resolve(
  cwd,
  "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT/EVIDENCE/cre-automation-adversarial-gas-fork.json"
);

for (const outputPath of [reportPath, evidencePath]) {
  if (fs.existsSync(outputPath)) fs.rmSync(outputPath);
}

const hardhatCli = require.resolve("hardhat/internal/cli/cli");
const env = {
  ...process.env,
  FORK_URL: forkUrl,
  CRE_AUTOMATION_REPORT_PATH: reportPath,
};
const result = spawnSync(
  process.execPath,
  [
    hardhatCli,
    "test",
    "test/master/cre-automation-adversarial.gas.test.js",
    "--config",
    "hardhat.biggi-master.cjs",
    "--network",
    "hardhat",
  ],
  { cwd, env, stdio: "inherit" }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    "CRE automation fork rehearsal failed. Check whether the Polygon RPC supports fork reads."
  );
  process.exit(result.status == null ? 1 : result.status);
}
if (!fs.existsSync(reportPath)) {
  console.error("CRE automation fork rehearsal passed without producing its evidence report.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.copyFileSync(reportPath, evidencePath);
console.log(`CRE automation evidence: ${path.relative(cwd, reportPath)}`);
console.log(`Support copy: ${path.relative(cwd, evidencePath)}`);
