// Deploy BiggiTokenRewardsReader
// Env: TOKEN_REWARDS (optional, fallback addresses.json)
// Run: TOKEN_REWARDS=<addr> WRITE_ADDR=1 npx hardhat run scripts/deployTokenRewardsReader.js --network polygon

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const addresses = require("../addresses.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const tokenRewards = process.env.TOKEN_REWARDS || addresses.TOKEN_REWARDS;
  if (!tokenRewards) throw new Error("TOKEN_REWARDS is required");

  console.log("Deployer:", deployer.address);
  console.log("TOKEN_REWARDS:", tokenRewards);

  const Factory = await hre.ethers.getContractFactory("BiggiTokenRewardsReader");
  const reader = await Factory.deploy(tokenRewards);
  await reader.deployed();
  console.log("BiggiTokenRewardsReader:", reader.address);

  if (process.env.WRITE_ADDR === "1") {
    addresses.TOKEN_REWARDS_READER = reader.address;
    const outPath = path.resolve(__dirname, "../addresses.json");
    fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
    console.log("addresses.json updated with TOKEN_REWARDS_READER");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
