// Deploy BiggiCommunityCenter
// Env: OWNER (optional, defaults to deployer)
// Run: npx hardhat run scripts/deployCommunityCenter.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Factory = await ethers.getContractFactory("BiggiCommunityCenter");
  const cc = await Factory.deploy(owner);
  await cc.deployed();
  console.log("BiggiCommunityCenter:", cc.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

