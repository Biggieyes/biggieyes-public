// Deploy DripKeeperProxy (keeper wrapper for BiggiDripLMToModerator)
// Env: OWNER (optional, default deployer)
// Run: npx hardhat run scripts/deployDripKeeperProxy.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Factory = await ethers.getContractFactory("DripKeeperProxy");
  const proxy = await Factory.deploy(owner);
  await proxy.deployed();
  console.log("DripKeeperProxy:", proxy.address);
  console.log("-> call setDripLM() and setKeeper() after deploy");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
