// Deploy LiquidityVault + BiggiLiquidityManager + BiggiLiquidityOrchestrator
// Run: TOKEN=<addr> ROUTER=<addr> RESERVE=<addr> npx hardhat run scripts/deployLiquidityStack.js --network <network>
// Env: OWNER (optional), TOKEN, ROUTER, RESERVE required. FACTORY optional (set later in setup).

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const token = process.env.TOKEN;
  const router = process.env.ROUTER;
  const reserve = process.env.RESERVE;
  if (!token || !router || !reserve) throw new Error("TOKEN, ROUTER, RESERVE required");

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("TOKEN:", token);
  console.log("ROUTER:", router);
  console.log("RESERVE:", reserve);

  // Vault
  const Vault = await ethers.getContractFactory("LiquidityVault");
  const vault = await Vault.deploy(owner);
  await vault.deployed();
  console.log("LiquidityVault:", vault.address);

  // LiquidityManager
  const LM = await ethers.getContractFactory("BiggiLiquidityManager");
  const lm = await LM.deploy(token, router, vault.address, owner, reserve);
  await lm.deployed();
  console.log("BiggiLiquidityManager:", lm.address);

  // Orchestrator
  const Orchestrator = await ethers.getContractFactory("BiggiLiquidityOrchestrator");
  const orch = await Orchestrator.deploy(reserve, lm.address, owner);
  await orch.deployed();
  console.log("BiggiLiquidityOrchestrator:", orch.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

