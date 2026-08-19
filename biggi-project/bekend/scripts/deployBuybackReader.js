// Deploy BiggiBuybackReader
// Env: BUYBACK_AGENT (req), TREASURY (req), POLICY (req), KEEPER_PROXY (opt, default 0), OWNER unused (reader has no owner)
// Run: BUYBACK_AGENT=<addr> TREASURY=<addr> POLICY=<addr> [KEEPER_PROXY=<addr>] npx hardhat run scripts/deployBuybackReader.js --network <net>

const { ethers } = require("hardhat");

function gasOverrides(ethers) {
  const feeGwei = process.env.MAX_FEE_GWEI || process.env.MAX_FEE_PER_GAS;
  const prioGwei = process.env.MAX_PRIORITY_GWEI || process.env.MAX_PRIORITY_FEE_PER_GAS;
  if (!feeGwei || !prioGwei) return {};
  return {
    maxFeePerGas: ethers.utils.parseUnits(feeGwei, "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits(prioGwei, "gwei"),
  };
}

async function main() {
  const agent = process.env.BUYBACK_AGENT;
  const treasury = process.env.TREASURY;
  const policy = process.env.POLICY;
  const keeperProxy = process.env.KEEPER_PROXY || ethers.constants.AddressZero;
  if (!agent || !treasury || !policy) throw new Error("BUYBACK_AGENT, TREASURY, POLICY are required");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Agent:", agent);
  console.log("Treasury:", treasury);
  console.log("Policy:", policy);
  console.log("KeeperProxy:", keeperProxy);

  const overrides = gasOverrides(ethers);
  const Factory = await ethers.getContractFactory("BiggiBuybackReader");
  const reader = await Factory.deploy(agent, treasury, policy, keeperProxy, overrides);
  await reader.deployed();
  console.log("BiggiBuybackReader:", reader.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
