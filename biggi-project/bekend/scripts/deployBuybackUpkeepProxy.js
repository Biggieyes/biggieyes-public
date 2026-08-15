// Deploy BiggiBuybackUpkeepProxy (Chainlink Automation helper for buyback agent)
// Env: OWNER (optional, default deployer)
// Run: npx hardhat run scripts/deployBuybackUpkeepProxy.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Factory = await ethers.getContractFactory("BiggiBuybackUpkeepProxy");
  const proxy = await Factory.deploy(owner);
  await proxy.deployed();
  console.log("BiggiBuybackUpkeepProxy:", proxy.address);
  console.log("-> call setAgent() + setThreshold() after deploy");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
