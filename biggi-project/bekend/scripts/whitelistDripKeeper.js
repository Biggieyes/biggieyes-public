// Spusť: npx hardhat run scripts/whitelistDripKeeper.js --network amoy
// Whitelistuje keeper v DripKeeperProxy a vypíše paused flag.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI = [
  "function setKeeper(address who, bool allowed) external",
  "function paused() view returns (bool)",
];

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
  if (!env.DRIP_KEEPER_PROXY) throw new Error("Chybí DRIP_KEEPER_PROXY v .env");
  const keeper = env.KEEPER_ADDR || (await (await ethers.getSigners())[0].getAddress());
  const gas = gasOverrides();
  const signer = (await ethers.getSigners())[0];

  const proxy = new ethers.Contract(env.DRIP_KEEPER_PROXY, ABI, signer);
  const paused = await proxy.paused();
  console.log("DripKeeperProxy:", env.DRIP_KEEPER_PROXY, "paused:", paused);
  console.log("Whitelisting keeper:", keeper);
  const tx = await proxy.setKeeper(keeper, true, gas);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Hotovo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
