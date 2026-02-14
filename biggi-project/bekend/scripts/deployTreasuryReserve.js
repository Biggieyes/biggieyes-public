// Deploy BiggiTreasury and BiggiReserveV4
// Run: TOKEN=<addr> npx hardhat run scripts/deployTreasuryReserve.js --network <network>
// Env: OWNER (optional, defaults to deployer), TOKEN (required)

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const tokenAddr = process.env.TOKEN;
  if (!tokenAddr) {
    throw new Error("TOKEN env var required");
  }
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("TOKEN:", tokenAddr);

  // Treasury
  const Treasury = await ethers.getContractFactory("BiggiTreasury");
  const treasury = await Treasury.deploy(tokenAddr, owner);
  await treasury.deployed();
  console.log("BiggiTreasury:", treasury.address);

  // Reserve
  const Reserve = await ethers.getContractFactory("BiggiReserveV4");
  const reserve = await Reserve.deploy(tokenAddr, owner);
  await reserve.deployed();
  console.log("BiggiReserveV4:", reserve.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

