const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function loadJson(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isAddress(value) {
  return typeof value === "string" && ethers.utils.isAddress(value) && value.toLowerCase() !== ZERO.toLowerCase();
}

function collectAddresses(value, prefix, out) {
  if (isAddress(value)) {
    const address = ethers.utils.getAddress(value);
    const key = address.toLowerCase();
    if (!out.has(key)) out.set(key, { address, keys: [] });
    out.get(key).keys.push(prefix);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    collectAddresses(child, prefix ? `${prefix}.${key}` : key, out);
  }
}

async function tryCall(contract, method) {
  try {
    return await contract[method]();
  } catch {
    return null;
  }
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 137) throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);

  const files = [
    "addresses.master.json",
    "addresses.visibility.polygon.json",
    "addresses.tokenomics.phase1.polygon.json",
    "addresses.tokenomics.phase2.polygon.json",
  ];
  const candidates = new Map();
  for (const file of files) {
    collectAddresses(loadJson(path.resolve(root, file)), file, candidates);
  }

  const ownerAbi = [
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
  ];
  const ownedContracts = [];
  let withCode = 0;

  for (const candidate of candidates.values()) {
    const code = await ethers.provider.getCode(candidate.address);
    if (code === "0x") continue;
    withCode += 1;
    const contract = new ethers.Contract(candidate.address, ownerAbi, ethers.provider);
    const owner = await tryCall(contract, "owner");
    if (!isAddress(owner)) continue;
    const pendingOwner = await tryCall(contract, "pendingOwner");
    ownedContracts.push({
      address: candidate.address,
      keys: [...new Set(candidate.keys)].sort(),
      owner: ethers.utils.getAddress(owner),
      pendingOwner: isAddress(pendingOwner) ? ethers.utils.getAddress(pendingOwner) : ZERO,
      ownable2Step: pendingOwner !== null,
    });
  }

  ownedContracts.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const owners = {};
  for (const item of ownedContracts) {
    owners[item.owner] = (owners[item.owner] || 0) + 1;
  }

  const report = {
    network: network.name,
    chainId: chain.chainId,
    createdAt: new Date().toISOString(),
    manifestFiles: files,
    uniqueAddressCandidates: candidates.size,
    addressesWithCode: withCode,
    ownableContracts: ownedContracts.length,
    owners,
    contracts: ownedContracts,
  };
  const out = path.resolve(root, "reports/ownership-audit-polygon.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ownableContracts: ownedContracts.length, owners, report: out }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
