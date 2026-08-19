// Spusť: npx hardhat run scripts/showKeeper.js --network polygon
// Vypíše keeper adresu z BiggiLiquidityManager

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const LM_ADDR = process.env.LIQUIDITY_MANAGER || "0x1f60516dAb945297E7A12B729fE108e093b56e1e";
  const lm = await ethers.getContractAt("BiggiLiquidityManager", LM_ADDR);
  const keeper = await lm.keeper();
  console.log("LM:", LM_ADDR);
  console.log("Keeper:", keeper);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
