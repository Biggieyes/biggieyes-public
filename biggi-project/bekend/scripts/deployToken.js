// Deploy BiggiToken
// Run: npx hardhat run scripts/deployToken.js --network <network>
// Uses env OWNER (optional, defaults to deployer)

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  const Token = await ethers.getContractFactory("BiggiToken");
  const token = await Token.deploy(owner);
  await token.deployed();
  console.log("BiggiToken deployed at:", token.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

