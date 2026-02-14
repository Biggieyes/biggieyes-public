// Deploy BiggiCompute (helper for Main1 background pricing)
// Run: npx hardhat run scripts/deployCompute.js --network amoy
// Env (opt): MAX_FEE_GWEI / MAX_PRIORITY_FEE_GWEI for gas control

const hre = require("hardhat");

function gasOverrides(ethers) {
  const feeGwei = process.env.MAX_FEE_GWEI || "40";
  const prioGwei = process.env.MAX_PRIORITY_FEE_GWEI || "30";
  return {
    maxFeePerGas: ethers.utils.parseUnits(feeGwei, "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits(prioGwei, "gwei"),
  };
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const overrides = gasOverrides(ethers);
  const Factory = await ethers.getContractFactory("BiggiCompute");
  const compute = await Factory.deploy(overrides);
  await compute.deployed();
  console.log("BiggiCompute deployed at:", compute.address);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
