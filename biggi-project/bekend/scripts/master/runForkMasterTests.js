const { spawnSync } = require("child_process");
const path = require("path");
const dotenv = require("dotenv");

const cwd = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(cwd, ".env") });

const forkUrl = process.env.FORK_URL || process.env.POLYGON_RPC_URL;
if (!forkUrl) {
  console.error("Missing FORK_URL (or POLYGON_RPC_URL in .env).");
  process.exit(1);
}

const env = { ...process.env, FORK_URL: forkUrl };
const result = spawnSync(
  "npx",
  ["hardhat", "test", "--config", "hardhat.biggi-master.cjs"],
  { cwd, env, stdio: "inherit", shell: true }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    "Fork test failed. Common causes: RPC rate-limit (429) or non-archive endpoint. " +
      "Use an archive RPC and optionally set FORK_BLOCK_NUMBER to a fixed block."
  );
}

process.exit(result.status == null ? 1 : result.status);
