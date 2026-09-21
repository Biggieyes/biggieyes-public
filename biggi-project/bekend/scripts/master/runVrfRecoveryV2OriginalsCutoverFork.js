const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");
const { providers } = require("ethers");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

async function main() {
  const forkUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  if (!forkUrl) throw new Error("POLYGON_RPC_URL is required");

  const provider = new providers.StaticJsonRpcProvider(forkUrl, 137);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 137) {
    throw new Error(`Polygon chain ID 137 required, received ${network.chainId}`);
  }
  const block = await provider.getBlockNumber();
  console.log(`Starting Originals-only cutover rehearsal on a read-only Polygon fork at block ${block}`);

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
      "test/master/vrf-recovery-v2-originals-cutover.fork.test.js",
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
  console.error(error?.message || "Originals-only cutover fork rehearsal failed");
  process.exitCode = 1;
});
