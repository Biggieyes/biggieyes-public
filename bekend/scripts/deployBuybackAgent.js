// Deploys BiggiBuybackAgent with keeper support and wires core addresses.
// Usage: npx hardhat run scripts/deployBuybackAgent.js --network polygon
// Env (scripts/.env or .env):
//  BIGGI, ROUTER, TREASURY, POLICY, DRIP_LM, UPKEEP_PROXY
//  PRIVATE_KEY (owner/deployer), POLYGON_RPC_URL (optional), GAS_PRIORITY_GWEI/GAS_FEE_GWEI (optional)

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

function gasOverrides() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

async function main() {
  const env = process.env;
  const required = ["BIGGI", "ROUTER", "TREASURY", "POLICY", "DRIP_LM", "UPKEEP_PROXY", "PRIVATE_KEY"];
  for (const k of required) if (!env[k]) throw new Error(`Missing ${k} in .env`);

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const gas = gasOverrides();
  console.log("Deployer:", signer.address);

  const BA = await ethers.getContractFactory("BiggiBuybackAgent", signer);
  console.log("Deploying BiggiBuybackAgent...");
  const ba = await BA.deploy(env.BIGGI, signer.address, gas);
  await ba.deployed();
  console.log("BuybackAgent deployed:", ba.address);

  // wire core addresses
  console.log("setRouter ->", env.ROUTER);
  await (await ba.setRouter(env.ROUTER, gas)).wait();
  console.log("setTreasury ->", env.TREASURY);
  await (await ba.setTreasury(env.TREASURY, gas)).wait();
  console.log("setPolicy ->", env.POLICY);
  await (await ba.setPolicy(env.POLICY, gas)).wait();
  console.log("setDripLM ->", env.DRIP_LM);
  await (await ba.setDripLM(env.DRIP_LM, gas)).wait();
  console.log("setKeeper ->", env.UPKEEP_PROXY);
  await (await ba.setKeeper(env.UPKEEP_PROXY, gas)).wait();

  console.log("Done. Update .env NEW_BUYBACK_AGENT=", ba.address, " then run scripts/updateBuybackAgent.js");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
