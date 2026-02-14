// Set LiquidityManager keeper
// Run: npx hardhat run scripts/setLmKeeper.js --network amoy

const { ethers } = require("hardhat");

async function main() {
  const LM = process.env.LM || "0xd4818d563674560FFDD53dca0C85e665A533885a";
  const KEEPER =
    process.env.LIQUIDITY_AUTOMATION ||
    "0x30C23F4DC63212eCeDa7612c9434f5368A5c6071";

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("LM:", LM);
  console.log("Keeper:", KEEPER);

  const abi = ["function keeper() view returns (address)", "function setKeeper(address)"];
  const lm = new ethers.Contract(LM, abi, deployer);
  const current = await lm.keeper();
  console.log("Current keeper:", current);

  if (current.toLowerCase() === KEEPER.toLowerCase()) {
    console.log("Keeper already set.");
    return;
  }

  const tx = await lm.setKeeper(KEEPER);
  console.log("setKeeper tx:", tx.hash);
  await tx.wait();
  console.log("setKeeper done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
