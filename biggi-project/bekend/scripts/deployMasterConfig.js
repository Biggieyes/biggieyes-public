// scripts/deployMasterConfig.js
// Spusť: npx hardhat run scripts/deployMasterConfig.js --network amoy

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("BiggiMasterTokenomicsConfig");
  const contract = await Factory.deploy(deployer.address); // initialOwner = deployer
  await contract.deployed();

  console.log("MasterTokenomicsConfig deployed at:", contract.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
