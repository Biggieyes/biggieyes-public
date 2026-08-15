// Nasazení BiggiTokenomikReader
// Spuštění: npx hardhat run scripts/deployTokenomikReader.js --network polygon

// Načti root .env; pokud spouštíš jinde, doplň env proměnné ručně.
require("dotenv").config();
const hre = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Chybí env proměnná: ${name}`);
  return v;
}

function getGasOverrides(ethers) {
  const overrides = {};
  const maxFee = process.env.MAX_FEE_PER_GAS || process.env.GAS_FEE_GWEI;
  const maxPrio = process.env.MAX_PRIORITY_FEE_PER_GAS || process.env.GAS_PRIORITY_GWEI;
  if (maxFee && maxPrio) {
    // pokud jsou v Gwei, použij parseUnits
    const fee = maxFee.includes("0x") ? ethers.BigNumber.from(maxFee) : ethers.utils.parseUnits(maxFee, "gwei");
    const prio = maxPrio.includes("0x") ? ethers.BigNumber.from(maxPrio) : ethers.utils.parseUnits(maxPrio, "gwei");
    overrides.maxFeePerGas = fee;
    overrides.maxPriorityFeePerGas = prio;
  }
  return overrides;
}

async function main() {
    // NOTE: totalSupply/reserves are scaled in the core to 18 decimals. Ensure pair decimals are 18, otherwise adjust constructor.
  const ethers = hre.ethers;
  const args = {
    token: requireEnv("BIGGI"),
    router: requireEnv("ROUTER"),
    pair: requireEnv("PAIR"),
    distributor: requireEnv("DISTRIBUTOR"),
    buyback: requireEnv("BUYBACK_AGENT"),
    reserve: requireEnv("RESERVE"),
    lm: requireEnv("LIQUIDITY_MANAGER"),
    vault: requireEnv("LIQUIDITY_VAULT"),
    drip: requireEnv("DRIP_DISTRIBUTOR"),
    tokenRewards: requireEnv("TOKEN_REWARDS"),
  };

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Args:", args);

  const overrides = getGasOverrides(ethers);
  const Factory = await ethers.getContractFactory("BiggiTokenomikReader");
  const reader = await Factory.deploy(
    args.token,
    args.router,
    args.pair,
    args.distributor,
    args.buyback,
    args.reserve,
    args.lm,
    args.vault,
    args.drip,
    args.tokenRewards,
    overrides
  );
  console.log("Deploy tx:", reader.deployTransaction.hash);
  await reader.deployed();
  console.log("BiggiTokenomikReader deployed at:", reader.address);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
