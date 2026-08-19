// Deploy BiggiTokenRewards
// Env: MAIN_NFT (required), MAIN2_NFT (optional, pass 0x0 to skip), TOKEN (required), OWNER (optional -> deployer)
// Run: MAIN_NFT=<addr> TOKEN=<addr> MAIN2_NFT=<addr|0x000...0> npx hardhat run scripts/deployTokenRewards.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const main1 = process.env.MAIN_NFT;
  const main2 = process.env.MAIN2_NFT || ethers.constants.AddressZero;
  const token = process.env.TOKEN;
  if (!main1 || !token) throw new Error("MAIN_NFT and TOKEN env vars required");

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("MAIN_NFT:", main1);
  console.log("MAIN2_NFT:", main2);
  console.log("TOKEN:", token);

  const Factory = await ethers.getContractFactory("BiggiTokenRewards");
  const rewards = await Factory.deploy(main1, main2, token, owner);
  await rewards.deployed();
  console.log("BiggiTokenRewards:", rewards.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

