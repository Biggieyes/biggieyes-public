const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");
const { providers } = require("ethers");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

function requestedBlock(argv) {
  const index = argv.indexOf("--block");
  if (index < 0) return null;
  const block = Number(argv[index + 1]);
  if (!Number.isSafeInteger(block) || block <= 0) {
    throw new Error("--block requires a positive integer");
  }
  return block;
}

async function main() {
  const forkUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  if (!forkUrl) throw new Error("POLYGON_RPC_URL is required");

  const provider = new providers.StaticJsonRpcProvider(forkUrl, 137);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 137) {
    throw new Error(`Polygon chain ID 137 required, received ${network.chainId}`);
  }

  const block = requestedBlock(process.argv.slice(2)) || (await provider.getBlockNumber());
  console.log(`Starting read-only Polygon fork rehearsal at block ${block}`);

  const result = spawnSync(
    process.execPath,
    [
      "node_modules/hardhat/internal/cli/cli.js",
      "test",
      "--no-compile",
      "--config",
      "hardhat.vrf-recovery.cjs",
      "--network",
      "hardhat",
      "test/master/vrf-recovery-v2-migration.fork.test.js",
    ],
    {
      cwd: path.resolve(__dirname, "../.."),
      env: {
        ...process.env,
        VRF_RECOVERY_FORK_URL: forkUrl,
        VRF_RECOVERY_FORK_BLOCK: String(block),
      },
      stdio: "inherit",
      shell: false,
    },
  );

  process.exitCode = result.status == null ? 1 : result.status;
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
