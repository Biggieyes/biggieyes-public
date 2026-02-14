// Deploy BiggiLiquidityKeeperProxy (automation wrapper over LiquidityOrchestrator)
// Env: ORCHESTRATOR (req), RESERVE (req), OWNER (opt, default deployer)
// Run: ORCHESTRATOR=<addr> RESERVE=<addr> npx hardhat run scripts/deployLiquidityKeeperProxy.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const orchestrator = process.env.ORCHESTRATOR;
  const reserve = process.env.RESERVE;
  if (!orchestrator || !reserve) throw new Error("ORCHESTRATOR and RESERVE env vars are required");

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("Orchestrator:", orchestrator);
  console.log("Reserve:", reserve);

  const Factory = await ethers.getContractFactory("BiggiLiquidityKeeperProxy");
  const proxy = await Factory.deploy(orchestrator, reserve, owner);
  await proxy.deployed();
  console.log("BiggiLiquidityKeeperProxy:", proxy.address);
  console.log("-> call setAllowedCaller/setStrategy/setLimits after deploy");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
