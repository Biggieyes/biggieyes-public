// Deploy DripDistributor + DripLMToModerator
// Run: TOKEN=<addr> ROUTER=<addr> npx hardhat run scripts/deployDrip.js --network <network>
// Env: OWNER (optional, defaults to deployer), TOKEN, ROUTER required

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const token = process.env.TOKEN;
  const router = process.env.ROUTER;
  if (!token || !router) {
    throw new Error("TOKEN and ROUTER env vars required");
  }
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("TOKEN:", token);
  console.log("ROUTER:", router);

  const DripDistributor = await ethers.getContractFactory("BiggiDripDistributor");
  const distributor = await DripDistributor.deploy(token, owner);
  await distributor.deployed();
  console.log("BiggiDripDistributor:", distributor.address);

  const DripLM = await ethers.getContractFactory("BiggiDripLMToModerator");
  const dripLM = await DripLM.deploy(token, router, owner);
  await dripLM.deployed();
  console.log("BiggiDripLMToModerator:", dripLM.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

