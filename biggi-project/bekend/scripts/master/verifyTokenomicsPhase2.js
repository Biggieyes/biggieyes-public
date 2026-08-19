const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ZERO = "0x0000000000000000000000000000000000000000";

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function resolveFile(inputPath) {
  const selected = inputPath || "addresses.tokenomics.phase2.polygon.json";
  if (path.isAbsolute(selected)) return selected;
  return path.resolve(process.cwd(), selected);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || "")) && String(value).toLowerCase() !== ZERO;
}

function addr(a, key, aliases = []) {
  if (isAddress(a[key])) return ethers.utils.getAddress(a[key]);
  for (const alias of aliases) {
    if (isAddress(a[alias])) return ethers.utils.getAddress(a[alias]);
  }
  return "";
}

function ownerOf(a) {
  return a.EXPECT_OWNER || a.OWNER || a.DEV_WALLET || a.MARKETING_SUPPORT_OWNER || a.deployer;
}

function targets(a) {
  const owner = ownerOf(a);
  const reserve = addr(a, "RESERVE", ["RESERVE_ADDRESS"]);
  const quoteToken = addr(a, "QUOTE_TOKEN", ["WETH", "WPOL"]);
  const liquidityManager = addr(a, "LIQUIDITY_MANAGER", ["LM"]);
  const liquidityVault = addr(a, "LIQUIDITY_VAULT", ["LM_VAULT"]);
  const tokenomicsReader = addr(a, "BIGGI_TOKENOMICS_READER", ["BIGGI_TOKENOMIK_READER", "TOKENOMIK_READER"]);

  return [
    {
      key: "MODERATOR_CENTER",
      aliases: ["BIGGI_MODERATOR_CENTER"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/ModeratorCenter.sol:ModeratorCenter",
    },
    {
      key: "SUPPLY_CONTROLLER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiSupplyController.sol:BiggiSupplyController",
    },
    {
      key: "SUPPLY_GUARDIAN",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiSupplyGuardian.sol:BiggiSupplyGuardian",
    },
    {
      key: "DEX_RESERVE_GUARD",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiDexReserveGuard.sol:BiggiDexReserveGuard",
    },
    {
      key: "LIQUIDITY_VAULT",
      aliases: ["LM_VAULT"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiLiquidityVault.sol:LiquidityVault",
    },
    {
      key: "LIQUIDITY_MANAGER",
      aliases: ["LM"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiLiquidityManager.sol:BiggiLiquidityManager",
    },
    {
      key: "LIQUIDITY_ORCHESTRATOR",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiLiquidityOrchestrator.sol:BiggiLiquidityOrchestrator",
    },
    {
      key: "LIQUIDITY_KEEPER_PROXY",
      aliases: ["KEEPER_PROXY"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiLiquidityKeeperProxy.sol:BiggiLiquidityKeeperProxy",
    },
    {
      key: "DRIP_LM",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiDripLMToModerator.sol:BiggiDripLMToModerator",
    },
    {
      key: "DRIP_KEEPER_PROXY",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiDripKeeperProxy.sol:DripKeeperProxy",
    },
    {
      key: "BUYBACK_UPKEEP_PROXY",
      aliases: ["UPKEEP_PROXY"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiUpKeeperProxy.sol:BiggiBuybackUpkeepProxy",
    },
    {
      key: "SUPPLY_CONTROLLER_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiSupplyControllerReader.sol:BiggiSupplyControllerReader",
    },
    {
      key: "SUPPLY_GUARDIAN_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiSupplyGuardianReader.sol:BiggiSupplyGuardianReader",
    },
    {
      key: "DEX_RESERVE_GUARD_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiDexReserveGuardReader.sol:BiggiDexReserveGuardReader",
    },
    {
      key: "SYSTEM_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiSystemReader.sol:BiggiSystemReader",
    },
    {
      key: "LIQUIDITY_BRANCH_READER",
      aliases: ["LIQUIDITY_BRANCH_USER_READER"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiLiquidityBranchUserReader.sol:BiggiLiquidityBranchUserReader",
    },
    {
      key: "LIQUIDITY_HELPER_READER",
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiLiquidityHelperReader.sol:BiggiLiquidityHelperReader",
    },
    {
      key: "BIGGI_TOKENOMICS_READER",
      aliases: ["BIGGI_TOKENOMIK_READER", "TOKENOMIK_READER"],
      addressOverride: tokenomicsReader,
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_READERS/BiggiTokenomikReader.sol:BiggiTokenomikReader",
    },
    {
      key: "MULTICALL",
      aliases: ["MULTICALL2"],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/Multicall2.sol:Multicall2",
    },
  ].map((t) => ({
    ...t,
    owner,
    reserve,
    quoteToken,
    liquidityManager,
    liquidityVault,
  }));
}

function artifactFor(contractFqn) {
  const [sourceName, contractName] = contractFqn.split(":");
  const artifactPath = path.resolve(process.cwd(), "artifacts-master", sourceName, `${contractName}.json`);
  const dbgPath = artifactPath.replace(/\.json$/, ".dbg.json");
  if (!fs.existsSync(artifactPath)) throw new Error(`Artifact not found: ${artifactPath}`);
  if (!fs.existsSync(dbgPath)) throw new Error(`Debug artifact not found: ${dbgPath}`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const dbg = JSON.parse(fs.readFileSync(dbgPath, "utf8"));
  const buildInfoPath = path.resolve(path.dirname(artifactPath), dbg.buildInfo);
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  return { artifact, buildInfo };
}

async function apiGet(params, apiKey) {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", "137");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);
  return (await fetch(url)).json();
}

async function apiPost(params) {
  return (await fetch("https://api.etherscan.io/v2/api?chainid=137", {
    method: "POST",
    body: new URLSearchParams(params),
  })).json();
}

async function isVerified(address, apiKey) {
  const data = await apiGet({ module: "contract", action: "getsourcecode", address }, apiKey);
  const row = data.result && data.result[0];
  return Boolean(row && row.SourceCode);
}

async function creationTxInput(address, provider, apiKey) {
  const data = await apiGet(
    { module: "contract", action: "getcontractcreation", contractaddresses: address },
    apiKey
  );
  if (data.status !== "1" || !data.result || !data.result[0]?.txHash) {
    throw new Error(`Cannot resolve creation tx for ${address}: ${data.message || data.result}`);
  }
  const tx = await provider.getTransaction(data.result[0].txHash);
  if (!tx || !tx.data) throw new Error(`Creation tx data not found for ${address}`);
  return tx.data;
}

async function poll(guid, key, apiKey) {
  for (let i = 0; i < 24; i++) {
    await new Promise((resolve) => setTimeout(resolve, i === 0 ? 5000 : 10000));
    const data = await apiGet({ module: "contract", action: "checkverifystatus", guid }, apiKey);
    const result = String(data.result || "");
    if (data.status === "1" || /pass - verified|already verified/i.test(result)) {
      console.log(`[OK] ${key}: verified`);
      return;
    }
    if (/pending|queue|progress/i.test(result)) {
      console.log(`[WAIT] ${key}: ${result}`);
      continue;
    }
    throw new Error(`${key} verification failed: ${result || data.message}`);
  }
  throw new Error(`${key} verification timed out`);
}

async function verifyOne(target, addresses, provider, apiKey) {
  const address = target.addressOverride || addr(addresses, target.key, target.aliases || []);
  if (!isAddress(address)) {
    console.log(`[SKIP] ${target.key}: no deployed address`);
    return;
  }
  if (await isVerified(address, apiKey)) {
    console.log(`[SKIP] ${target.key}: already verified`);
    return;
  }

  const { artifact, buildInfo } = artifactFor(target.contract);
  const creationInput = await creationTxInput(address, provider, apiKey);
  if (!creationInput.toLowerCase().startsWith(artifact.bytecode.toLowerCase())) {
    throw new Error(`${target.key}: local bytecode does not match creation tx`);
  }

  const constructorArguements = creationInput.slice(artifact.bytecode.length).replace(/^0x/, "");
  console.log(`[VERIFY] ${target.key}: ${address}`);
  const data = await apiPost({
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: address,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: "solidity-standard-json-input",
    contractname: target.contract,
    compilerversion: `v${buildInfo.solcLongVersion}`,
    optimizationUsed: "1",
    runs: "200",
    constructorArguements,
    licenseType: "3",
  });
  const result = String(data.result || "");
  if (/already verified/i.test(result)) {
    console.log(`[OK] ${target.key}: already verified`);
    return;
  }
  if (data.status !== "1") {
    throw new Error(`${target.key} verify submit failed: ${data.message} ${result}`);
  }
  await poll(result, target.key, apiKey);
}

async function main() {
  const apiKey = env("ETHERSCAN_API_KEY", env("EXPLORER_API_KEY", env("POLYGONSCAN_API_KEY")));
  if (!apiKey) throw new Error("Missing ETHERSCAN_API_KEY/EXPLORER_API_KEY/POLYGONSCAN_API_KEY");
  const rpcUrl = env("POLYGON_RPC_URL", env("VITE_POLYGON_RPC_URL", "https://polygon.drpc.org"));
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const addressesFile = resolveFile(env("TOKENOMICS_PHASE2_OUTPUT_FILE"));
  if (!fs.existsSync(addressesFile)) throw new Error(`Addresses file not found: ${addressesFile}`);
  const addresses = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
  for (const target of targets(addresses)) {
    await verifyOne(target, addresses, provider, apiKey);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
