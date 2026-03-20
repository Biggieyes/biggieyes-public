// Redeploy immutable dashboard readers against the active runtime stack.
//
// Run:
//   npx hardhat run scripts/redeployDashboardReaders.js --network amoy

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const addressesPath = path.join(__dirname, "..", "addresses.json");

function gasOverrides() {
  const maxFee = process.env.MAX_FEE_GWEI || process.env.GAS_FEE_GWEI;
  const maxPriority = process.env.MAX_PRIORITY_GWEI || process.env.GAS_PRIORITY_GWEI;
  if (!maxFee || !maxPriority) return {};
  return {
    maxFeePerGas: ethers.utils.parseUnits(maxFee, "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits(maxPriority, "gwei"),
  };
}

function loadAddresses() {
  return JSON.parse(fs.readFileSync(addressesPath, "utf8"));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses = loadAddresses();
  const gas = gasOverrides();

  const cfg = {
    BUYBACK_AGENT: process.env.BUYBACK_AGENT || addresses.BUYBACK_AGENT,
    TREASURY: process.env.TREASURY || addresses.TREASURY,
    POLICY: process.env.POLICY || addresses.POLICY,
    BUYBACK_UPKEEP_PROXY:
      process.env.BUYBACK_UPKEEP_PROXY ||
      process.env.UPKEEP_PROXY ||
      addresses.BUYBACK_UPKEEP_PROXY ||
      addresses.UPKEEP_PROXY ||
      ethers.constants.AddressZero,
    RESERVE: process.env.RESERVE || addresses.RESERVE,
    LIQUIDITY_MANAGER:
      process.env.LIQUIDITY_MANAGER ||
      addresses.LIQUIDITY_MANAGER ||
      addresses.LM,
    LIQUIDITY_VAULT:
      process.env.LIQUIDITY_VAULT ||
      addresses.LIQUIDITY_VAULT ||
      addresses.LM_VAULT,
  };

  for (const [key, value] of Object.entries(cfg)) {
    if (!value) throw new Error(`Missing required address: ${key}`);
  }

  console.log("Signer:", deployer.address);
  console.log("Config:", cfg);

  const BuybackReader = await ethers.getContractFactory("BiggiBuybackReader");
  const buybackReader = await BuybackReader.deploy(
    cfg.BUYBACK_AGENT,
    cfg.TREASURY,
    cfg.POLICY,
    cfg.BUYBACK_UPKEEP_PROXY,
    gas,
  );
  await buybackReader.deployed();
  console.log("BiggiBuybackReader:", buybackReader.address);

  const LiquidityBranchReader = await ethers.getContractFactory(
    "BiggiLiquidityBranchUserReader",
  );
  const branchReader = await LiquidityBranchReader.deploy(
    cfg.RESERVE,
    cfg.LIQUIDITY_MANAGER,
    cfg.LIQUIDITY_VAULT,
    gas,
  );
  await branchReader.deployed();
  console.log("BiggiLiquidityBranchUserReader:", branchReader.address);

  const [buybackSnapshot, wiring] = await Promise.all([
    buybackReader.snapshot(),
    branchReader.wiringSnapshot(),
  ]);

  const nextAddresses = {
    ...addresses,
    BUYBACK_READER: buybackReader.address,
    BIGGIBUYBACKREADER: buybackReader.address,
    LIQUIDITY_BRANCH_USER_READER: branchReader.address,
    LIQ_BRANCH_READER: branchReader.address,
    LM_READER: branchReader.address,
  };

  fs.writeFileSync(addressesPath, `${JSON.stringify(nextAddresses, null, 2)}\n`);
  console.log("addresses.json updated");

  console.log(
    JSON.stringify(
      {
        deployed: {
          buybackReader: buybackReader.address,
          liquidityBranchUserReader: branchReader.address,
        },
        buybackSnapshotOk: Boolean(
          buybackSnapshot &&
            buybackSnapshot[0] &&
            buybackSnapshot[1] &&
            buybackSnapshot[2],
        ),
        branchWiring: {
          wiredOk: wiring?.wiredOk ?? wiring?.[0] ?? null,
          reserveLM: wiring?.reserveLM ?? wiring?.[1] ?? null,
          vaultLM: wiring?.vaultLM ?? wiring?.[2] ?? null,
          lmReserve: wiring?.lmReserve ?? wiring?.[3] ?? null,
          lmVault: wiring?.lmVault ?? wiring?.[4] ?? null,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
