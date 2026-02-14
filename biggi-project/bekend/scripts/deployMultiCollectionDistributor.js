// Deploy MultiCollectionDistributor
// Env: OWNER (optional, default deployer)
// Run: npx hardhat run scripts/deployMultiCollectionDistributor.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Factory = await ethers.getContractFactory("MultiCollectionDistributor");
  const distributor = await Factory.deploy(owner);
  await distributor.deployed();
  console.log("MultiCollectionDistributor:", distributor.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
