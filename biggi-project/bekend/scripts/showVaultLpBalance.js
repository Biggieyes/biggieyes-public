// Spusť: npx hardhat run scripts/showVaultLpBalance.js --network polygon
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const pair = process.env.PAIR || "0x59133d46598D178be59f2c6E1eFF222FFAf92229"; // LP BIGGI/MATIC
  const vault = process.env.LIQUIDITY_VAULT || "0x91359936f14337CED7c1Ce03C64A872378a9650e"; // LiquidityVault
  const erc20 = await ethers.getContractAt("IERC20", pair);
  const bal = await erc20.balanceOf(vault);
  console.log("LP balance (wei):", bal.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
