// Deploy BiggiLiquidityBranchUserReader
// Env: RESERVE (req), LIQUIDITY_MANAGER (req), LIQUIDITY_VAULT (req)
// Run: RESERVE=<addr> LIQUIDITY_MANAGER=<addr> LIQUIDITY_VAULT=<addr> npx hardhat run scripts/deployLiquidityBranchReader.js --network <net>

require("dotenv").config();
const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const reserve = requireEnv("RESERVE");
  const lm = requireEnv("LIQUIDITY_MANAGER");
  const vault = requireEnv("LIQUIDITY_VAULT");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log({ reserve, lm, vault });

  const Factory = await ethers.getContractFactory("BiggiLiquidityBranchUserReader");
  const reader = await Factory.deploy(reserve, lm, vault);
  console.log("Deploy tx:", reader.deployTransaction.hash);
  await reader.deployed();
  console.log("BiggiLiquidityBranchUserReader deployed at:", reader.address);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
