const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || "")) && String(value).toLowerCase() !== ZERO.toLowerCase();
}

function getAddress(value) {
  return isAddress(value) ? ethers.utils.getAddress(value) : ZERO;
}

function loadJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadAddresses(root) {
  return {
    ...loadJson(path.resolve(root, "addresses.master.json")),
    ...loadJson(path.resolve(root, "addresses.visibility.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase1.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase2.polygon.json")),
  };
}

async function apiGet(params, apiKey, attempts = 4) {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", "137");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`Etherscan HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(attempt * 2_000);
    }
  }
  throw lastError;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const A = loadAddresses(root);
  const chain = await ethers.provider.getNetwork();
  const apiKey = env("ETHERSCAN_API_KEY", env("EXPLORER_API_KEY", env("POLYGONSCAN_API_KEY", "")));
  const keys = [
    "MAIN",
    "MAIN2",
    "TICKET_HUB",
    "VRF_ROUTER",
    "COMPUTE",
    "REGISTRY",
    "CHAPTER_CONTROLLER",
    "COLLECTION_REWARDS",
    "NFT_REWARDS",
    "MAIN_READER",
    "MULTI_COLLECTION_READER",
    "CHAPTER_SERIES_READER",
    "NFT_REWARDS_READER",
    "DISTRIBUTOR",
    "BIGGI_TOKEN",
    "RESERVE",
    "TREASURY",
    "DRIP_DISTRIBUTOR",
    "TOKEN_REWARDS",
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    "MASTER_CONFIG",
    "POLICY",
    "COMMUNITY_CENTER",
    "BUYBACK_AGENT",
    "RESERVE_TREASURY_READER",
    "BUYBACK_READER",
    "TOKEN_REWARDS_READER",
    "TOKENOMICS_SYSTEM_ADDON_READER",
    "MODERATOR_CENTER",
    "SUPPLY_CONTROLLER",
    "SUPPLY_GUARDIAN",
    "DEX_RESERVE_GUARD",
    "LIQUIDITY_VAULT",
    "LIQUIDITY_MANAGER",
    "LIQUIDITY_ORCHESTRATOR",
    "LIQUIDITY_KEEPER_PROXY",
    "DRIP_LM",
    "DRIP_KEEPER_PROXY",
    "BUYBACK_UPKEEP_PROXY",
    "SUPPLY_CONTROLLER_READER",
    "SUPPLY_GUARDIAN_READER",
    "DEX_RESERVE_GUARD_READER",
    "SYSTEM_READER",
    "LIQUIDITY_BRANCH_READER",
    "LIQUIDITY_HELPER_READER",
    "BIGGI_TOKENOMICS_READER",
    "MULTICALL",
    "BIGGI_NAMES_LIB",
    "BIGGI_NAMES_LIB2",
    "CRE_AUTOMATION_RECEIVER",
  ];
  const addressEntries = keys.map((key) => ({ key, value: A[key] }));
  if (Array.isArray(A.chapters)) {
    for (const chapter of A.chapters) {
      const chapterId = Number(chapter.chapterId);
      if (!Number.isInteger(chapterId) || chapterId <= 0) continue;
      addressEntries.push(
        { key: `CHAPTER_${chapterId}_MAIN`, value: chapter.MAIN },
        { key: `CHAPTER_${chapterId}_MAIN2`, value: chapter.MAIN2 }
      );
    }
  }

  const seen = new Set();
  const contracts = [];
  for (const { key, value } of addressEntries) {
    const address = getAddress(value);
    if (!isAddress(address) || seen.has(address)) continue;
    seen.add(address);
    const code = await ethers.provider.getCode(address);
    const entry = { key, address, hasCode: code !== "0x" };
    if (apiKey && entry.hasCode) {
      await sleep(650);
      const creation = await apiGet({ module: "contract", action: "getcontractcreation", contractaddresses: address }, apiKey);
      if (creation.status === "1" && creation.result?.[0]) {
        entry.deployer = creation.result[0].contractCreator;
        entry.txHash = creation.result[0].txHash;
      } else {
        entry.creationLookupError = creation.result || creation.message;
      }
      await sleep(650);
      const source = await apiGet({ module: "contract", action: "getsourcecode", address }, apiKey);
      const row = source.result?.[0];
      entry.verified = Boolean(source.status === "1" && row && row.SourceCode);
      if (row) {
        entry.contractName = row.ContractName;
        entry.compilerVersion = row.CompilerVersion;
      }
    }
    contracts.push(entry);
    console.log(
      `[AUDIT ${contracts.length}/${addressEntries.length}] ${key}: code=${entry.hasCode} verified=${entry.verified ?? "not-queried"}`
    );
  }

  const manifest = {
    network: network.name,
    chainId: chain.chainId,
    createdAt: new Date().toISOString(),
    source: "canonical BIGGI project addresses (core + tokenomics + readers + linked libraries + CRE receiver)",
    summary: {
      total: contracts.length,
      withCode: contracts.filter((entry) => entry.hasCode).length,
      verified: contracts.filter((entry) => entry.verified === true).length,
      unverified: contracts.filter((entry) => entry.hasCode && entry.verified === false).length,
    },
    contracts,
  };
  const reportFile = path.resolve(root, env("DEPLOYMENT_MANIFEST_REPORT", "reports/deployment-manifest-polygon.json"));
  const docsFile = path.resolve(
    root,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json"
  );
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.mkdirSync(path.dirname(docsFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(docsFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ contracts: contracts.length, report: reportFile, docs: docsFile }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
