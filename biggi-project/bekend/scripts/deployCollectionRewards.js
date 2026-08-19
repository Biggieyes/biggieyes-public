// Deploy BiggiCollectionRewards
// Env: MAIN_NFT (required), OWNER (optional, default deployer)
// Run: MAIN_NFT=<addr> npx hardhat run scripts/deployCollectionRewards.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const mainNft = process.env.MAIN_NFT;
  if (!mainNft) throw new Error("MAIN_NFT env var required");

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("MAIN_NFT:", mainNft);

  const Factory = await ethers.getContractFactory("BiggiCollectionRewards");
  const rewards = await Factory.deploy(mainNft);
  await rewards.deployed();
  console.log("BiggiCollectionRewards:", rewards.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

