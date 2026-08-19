// Deploy BiggiMultiCollectionDistributorReader
// Env: DISTRIBUTOR (required)
// Run: DISTRIBUTOR=<addr> npx hardhat run scripts/deployMultiCollectionDistributorReader.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const distributor = process.env.DISTRIBUTOR;
  if (!distributor) throw new Error("DISTRIBUTOR env var required");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Distributor:", distributor);

  const Factory = await ethers.getContractFactory("BiggiMultiCollectionDistributorReader");
  const reader = await Factory.deploy(distributor);
  await reader.deployed();
  console.log("BiggiMultiCollectionDistributorReader:", reader.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
