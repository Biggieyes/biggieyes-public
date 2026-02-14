// Deploy BiggiNftRewardsReader
// Env: NFT_REWARDS (optional, fallback addresses.json)
// Run: NFT_REWARDS=<addr> WRITE_ADDR=1 npx hardhat run scripts/deployNftRewardsReader.js --network amoy

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const addresses = require("../addresses.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const nftRewards = process.env.NFT_REWARDS || addresses.NFT_REWARDS || addresses.NFT_REWARDS_CONTRACT;
  if (!nftRewards) throw new Error("NFT_REWARDS is required");

  console.log("Deployer:", deployer.address);
  console.log("NFT_REWARDS:", nftRewards);

  const Factory = await hre.ethers.getContractFactory("BiggiNftRewardsReader");
  const reader = await Factory.deploy(nftRewards);
  await reader.deployed();
  console.log("BiggiNftRewardsReader:", reader.address);

  if (process.env.WRITE_ADDR === "1") {
    addresses.NFT_REWARDS_READER = reader.address;
    const outPath = path.resolve(__dirname, "../addresses.json");
    fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
    console.log("addresses.json updated with NFT_REWARDS_READER");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
