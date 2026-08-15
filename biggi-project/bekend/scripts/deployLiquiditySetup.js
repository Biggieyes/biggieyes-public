// scripts/deployLiquiditySetup.js
// Run: npx hardhat run scripts/deployLiquiditySetup.js --network polygon
// Env: BIGGI, ROUTER, LIQUIDITY_VAULT, LIQUIDITY_MANAGER, RESERVE, PRIVATE_KEY
// Optional: WETH, GAS_PRIORITY_GWEI, GAS_FEE_GWEI

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
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
  const required = [
    "BIGGI",
    "ROUTER",
    "LIQUIDITY_VAULT",
    "LIQUIDITY_MANAGER",
    "RESERVE",
    "PRIVATE_KEY",
  ];
  for (const k of required) if (!env[k]) throw new Error(`Chybí ${k} v .env`);

  const provider = hre.ethers.provider;
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);

  const router = new ethers.Contract(
    env.ROUTER,
    ["function WETH() view returns (address)"],
    provider,
  );
  const wNative = env.WETH || (await router.WETH());

  const factory = await ethers.getContractFactory("LiquiditySetup", wallet);
  const gas = gasOverrides();

  console.log("Deployer:", wallet.address);
  console.log("Args:", {
    owner: wallet.address,
    biggi: env.BIGGI,
    router: env.ROUTER,
    vault: env.LIQUIDITY_VAULT,
    lm: env.LIQUIDITY_MANAGER,
    reserve: env.RESERVE,
    wNative,
  });

  const contract = await factory.deploy(
    wallet.address,
    env.BIGGI,
    env.ROUTER,
    env.LIQUIDITY_VAULT,
    env.LIQUIDITY_MANAGER,
    env.RESERVE,
    wNative,
    gas,
  );

  console.log("tx deploy:", contract.deployTransaction.hash);
  await contract.deployed();
  console.log("LiquiditySetup deployed:", contract.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
