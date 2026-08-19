// Deploy BiggiPolicy + BiggiBuyBackAgent
// Run: TOKEN=<addr> npx hardhat run scripts/deployBuyback.js --network <network>
// Env: OWNER optional (defaults to deployer), TOKEN required.

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const token = process.env.TOKEN;
  if (!token) throw new Error("TOKEN env var required");

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("TOKEN:", token);

  const Policy = await ethers.getContractFactory("BiggiPolicy");
  const policy = await Policy.deploy(owner);
  await policy.deployed();
  console.log("BiggiPolicy:", policy.address);

  const Buyback = await ethers.getContractFactory("BiggiBuybackAgent");
  const agent = await Buyback.deploy(token, owner);
  await agent.deployed();
  console.log("BiggiBuyBackAgent:", agent.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
