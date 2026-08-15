const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const ZERO = ethers.constants.AddressZero;

function parseArgs(argv) {
  const opts = {
    envFile: path.resolve(process.cwd(), ".env.core.polygon"),
    expectedChainId: 137,
    minBalance: "15",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env") {
      const next = argv[++i];
      if (!next) throw new Error("--env requires a path");
      opts.envFile = path.resolve(process.cwd(), next);
    } else if (arg === "--min-balance") {
      const next = argv[++i];
      if (!next) throw new Error("--min-balance requires a POL amount");
      opts.minBalance = next;
    }
  }
  return opts;
}

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function assertAddress(name, value, allowZero = false) {
  let normalized;
  try {
    normalized = ethers.utils.getAddress(value);
  } catch {
    throw new Error(`${name} is not a valid address`);
  }
  if (!allowZero && normalized === ZERO) throw new Error(`${name} must not be zero`);
  return normalized;
}

function assertBool(name, value) {
  if (!["0", "1", "true", "false", "yes", "no", "on", "off"].includes(String(value).toLowerCase())) {
    throw new Error(`${name} must be boolean-like`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.envFile)) throw new Error(`Env file not found: ${opts.envFile}`);
  dotenv.config({ path: opts.envFile, override: true });

  const privateKey = env("PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("PRIVATE_KEY is missing or invalid");
  const rpc = env("POLYGON_RPC_URL");
  if (!rpc) throw new Error("POLYGON_RPC_URL is missing");

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== opts.expectedChainId) {
    throw new Error(`Wrong chainId: ${network.chainId}; expected ${opts.expectedChainId}`);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  const minBalance = ethers.utils.parseEther(opts.minBalance);
  if (balance.lt(minBalance)) {
    throw new Error(
      `Low deployer balance: ${ethers.utils.formatEther(balance)} POL; expected at least ${opts.minBalance} POL`
    );
  }

  const devWallet = assertAddress("DEV_WALLET", env("DEV_WALLET"));
  const expectOwner = assertAddress("EXPECT_OWNER", env("EXPECT_OWNER"));
  const targetOwner = assertAddress("TARGET_OWNER", env("TARGET_OWNER"));
  if (wallet.address.toLowerCase() !== devWallet.toLowerCase()) {
    throw new Error(`PRIVATE_KEY address ${wallet.address} does not match DEV_WALLET ${devWallet}`);
  }
  if (wallet.address.toLowerCase() !== expectOwner.toLowerCase()) {
    throw new Error(`PRIVATE_KEY address ${wallet.address} does not match EXPECT_OWNER ${expectOwner}`);
  }
  if (wallet.address.toLowerCase() !== targetOwner.toLowerCase()) {
    throw new Error(`PRIVATE_KEY address ${wallet.address} does not match TARGET_OWNER ${targetOwner}`);
  }

  assertAddress("VRF_ROUTER", env("VRF_ROUTER", ZERO), true);
  assertAddress("VRF_COORDINATOR", env("VRF_COORDINATOR"));
  if (!/^0x[0-9a-fA-F]{64}$/.test(env("VRF_KEY_HASH"))) throw new Error("VRF_KEY_HASH must be bytes32");
  if (!/^\d+$/.test(env("VRF_SUB_ID"))) throw new Error("VRF_SUB_ID must be an integer string");

  const saleCap = Number(env("SALE_CAP", "500"));
  const marketingCap = Number(env("MARKETING_CAP", "50"));
  if (!Number.isInteger(saleCap) || !Number.isInteger(marketingCap) || saleCap + marketingCap !== 550) {
    throw new Error("SALE_CAP + MARKETING_CAP must equal 550");
  }

  for (const name of [
    "DEPLOY_PUBLIC_BRANCH",
    "DEPLOY_COLLECTION_REWARDS",
    "DEPLOY_NFT_REWARDS",
    "DEPLOY_CORE_READERS",
    "DEPLOY_MAIN_READER",
    "DEPLOY_CHAPTER_SERIES_READER",
    "DEPLOY_MULTI_COLLECTION_READER",
    "DEPLOY_NFT_REWARDS_READER",
  ]) {
    assertBool(name, env(name, "0"));
  }

  const explorerKey = env("POLYGONSCAN_API_KEY") || env("ETHERSCAN_API_KEY") || env("EXPLORER_API_KEY");
  const requireExplorerKey = env("REQUIRE_POLYGONSCAN_API_KEY", "1") !== "0";
  if (!explorerKey && requireExplorerKey) {
    throw new Error("POLYGONSCAN_API_KEY/ETHERSCAN_API_KEY is required because REQUIRE_POLYGONSCAN_API_KEY=1.");
  } else if (!explorerKey) {
    console.warn("WARN: POLYGONSCAN_API_KEY/ETHERSCAN_API_KEY is missing; Etherscan-style verification will fail.");
    console.warn("WARN: Sourcify verification can still run, but PolygonScan verification needs an API key.");
  }

  console.log("Visibility deploy preflight: OK");
  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} POL`);
  console.log(`Output file: ${env("OUTPUT_FILE", "./addresses.visibility.polygon.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
