// Deploy BiggiNftRewards
// Env: OWNER (optional, default deployer)
// Run: npx hardhat run scripts/deployNftRewards.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Factory = await ethers.getContractFactory("BiggiNFTRewards");
  const r = await Factory.deploy(owner);
  await r.deployed();
  console.log("BiggiNftRewards:", r.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
