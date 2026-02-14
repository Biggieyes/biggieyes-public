// Deploy ModeratorCenter
// Env: OWNER (optional, defaults to deployer)
// Run: npx hardhat run scripts/deployModeratorCenter.js --network amoy

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Factory = await ethers.getContractFactory("ModeratorCenter");
  const mc = await Factory.deploy(owner);
  await mc.deployed();
  console.log("ModeratorCenter:", mc.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
