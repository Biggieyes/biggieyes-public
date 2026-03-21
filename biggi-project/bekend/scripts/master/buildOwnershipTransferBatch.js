const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ZERO = ethers.constants.AddressZero;

function isAddress(v) {
  try {
    return !!v && ethers.utils.getAddress(v) !== ZERO;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = {
    addressesFile: path.resolve(__dirname, "../../addresses.master.json"),
    to: process.env.TARGET_OWNER || null,
    out: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--addresses" || a === "--addresses-file") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${a} requires a file path`);
      opts.addressesFile = path.resolve(process.cwd(), next);
      i++;
    } else if (a === "--to" || a === "--target-owner") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${a} requires an address`);
      opts.to = next;
      i++;
    } else if (a === "--out") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${a} requires a file path`);
      opts.out = path.resolve(process.cwd(), next);
      i++;
    }
  }

  if (!isAddress(opts.to)) {
    throw new Error("Missing/invalid target owner. Use --to <address> or TARGET_OWNER env.");
  }

  if (!fs.existsSync(opts.addressesFile)) {
    throw new Error(`Addresses file not found: ${opts.addressesFile}`);
  }

  if (!opts.out) {
    opts.out = path.resolve(path.dirname(opts.addressesFile), "ownership-transfer-batch.json");
  }

  return opts;
}

function pickAddress(raw, keys) {
  for (const key of keys) {
    if (isAddress(raw[key])) return ethers.utils.getAddress(raw[key]);
  }
  return ZERO;
}

function normalizeAddresses(raw) {
  return {
    MAIN: pickAddress(raw, ["MAIN", "COLLECTION", "COLLECTION_VRF"]),
    MAIN2: pickAddress(raw, ["MAIN2", "COLLECTION2", "COLLECTION_PUBLIC"]),
    TICKET_HUB: pickAddress(raw, ["TICKET_HUB"]),
    VRF_ROUTER: pickAddress(raw, ["VRF_ROUTER"]),
    REGISTRY: pickAddress(raw, ["REGISTRY"]),
    CHAPTER_CONTROLLER: pickAddress(raw, ["CHAPTER_CONTROLLER"]),
    DISTRIBUTOR: pickAddress(raw, ["DISTRIBUTOR", "MULTI_COLLECTION_DISTRIBUTOR"]),
    COLLECTION_REWARDS: pickAddress(raw, ["COLLECTION_REWARDS"]),
    COMMUNITY_CENTER: pickAddress(raw, ["COMMUNITY_CENTER", "COMMUNITY", "COMMUNITYCENTER"]),
    MODERATOR_CENTER: pickAddress(raw, ["MODERATOR_CENTER"]),
    BIGGI_TOKEN: pickAddress(raw, ["BIGGI_TOKEN", "BIGGI"]),
    RESERVE: pickAddress(raw, ["RESERVE"]),
    TREASURY: pickAddress(raw, ["TREASURY"]),
    DRIP_DISTRIBUTOR: pickAddress(raw, ["DRIP_DISTRIBUTOR"]),
    TOKEN_REWARDS: pickAddress(raw, ["TOKEN_REWARDS"]),
    NFT_REWARDS: pickAddress(raw, ["NFT_REWARDS", "BIGGI_NFT_REWARDS"]),
    BUYBACK_AGENT: pickAddress(raw, ["BUYBACK_AGENT", "BUYBACK"]),
    POLICY: pickAddress(raw, ["POLICY"]),
    SUPPLY_CONTROLLER: pickAddress(raw, ["SUPPLY_CONTROLLER"]),
    SUPPLY_GUARDIAN: pickAddress(raw, ["SUPPLY_GUARDIAN"]),
    DEX_RESERVE_GUARD: pickAddress(raw, ["DEX_RESERVE_GUARD"]),
    LIQUIDITY_MANAGER: pickAddress(raw, ["LIQUIDITY_MANAGER", "LM"]),
    LIQUIDITY_VAULT: pickAddress(raw, ["LIQUIDITY_VAULT", "LM_VAULT"]),
    LIQUIDITY_ORCHESTRATOR: pickAddress(raw, ["LIQUIDITY_ORCHESTRATOR", "ORCHESTRATOR"]),
    LIQUIDITY_KEEPER_PROXY: pickAddress(raw, ["LIQUIDITY_KEEPER_PROXY", "KEEPER_PROXY"]),
    LIQUIDITY_AUTOMATION: pickAddress(raw, ["LIQUIDITY_AUTOMATION"]),
    DRIP_KEEPER_PROXY: pickAddress(raw, ["DRIP_KEEPER_PROXY"]),
    BUYBACK_UPKEEP_PROXY: pickAddress(raw, ["BUYBACK_UPKEEP_PROXY", "UPKEEP_PROXY"]),
    MASTER_CONFIG: pickAddress(raw, ["MASTER_CONFIG"]),
  };
}

function buildBatch(addresses, targetOwner) {
  const batch = [];
  for (const [key, value] of Object.entries(addresses)) {
    if (!isAddress(value)) continue;
    batch.push({
      label: `${key}.transferOwnership`,
      to: value,
      value: "0",
      data: {
        method: "transferOwnership",
        args: [targetOwner],
      },
      note: "Run from current owner / deployer role.",
    });
  }
  return batch;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(fs.readFileSync(opts.addressesFile, "utf8"));
  const addresses = normalizeAddresses(raw);
  const targetOwner = ethers.utils.getAddress(opts.to);

  const batch = buildBatch(addresses, targetOwner);
  const outPayload = {
    createdAt: new Date().toISOString(),
    sourceAddressesFile: opts.addressesFile,
    targetOwner,
    txCount: batch.length,
    txs: batch,
  };

  fs.writeFileSync(opts.out, JSON.stringify(outPayload, null, 2));

  console.log(`Ownership transfer batch generated: ${opts.out}`);
  console.log(`Target owner: ${targetOwner}`);
  console.log(`Transactions: ${batch.length}`);
}

main();
