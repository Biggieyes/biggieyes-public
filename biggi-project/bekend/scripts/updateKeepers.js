// scripts/updateKeepers.js
// Spusť: npx hardhat run scripts/updateKeepers.js --network amoy
//
// Env:
//  AMOY_RPC_URL, PRIVATE_KEY
//  UPKEEP_PROXY   = adresa BiggiBuybackUpkeepProxy
//  DRIP_KEEPER_PROXY = adresa DripKeeperProxy
//  KEEPER_ADDR    = adresa, kterou whitelis­tujeme do DripKeeperProxy (default signer)
//  MIN_NATIVE_WEI = min threshold pro buyback upkeep (např. 1000000000000000 pro 0.001 MATIC)
// Volitelně: GAS_PRIORITY_GWEI / GAS_FEE_GWEI (default 30/60)

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_UPKEEP = [
  "function setThreshold(uint256 t) external",
  "function setPaused(bool p) external",
];

const ABI_DRIP_PROXY = [
  "function setKeeper(address who, bool allowed) external",
  "function setDripLM(address _dripLM) external",
  "function pause() external",
  "function unpause() external",
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
  if (!env.UPKEEP_PROXY) throw new Error("Chybí UPKEEP_PROXY v .env");
  if (!env.DRIP_KEEPER_PROXY) throw new Error("Chybí DRIP_KEEPER_PROXY v .env");

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const keeperAddr = env.KEEPER_ADDR || signer.address;
  const minWei = env.MIN_NATIVE_WEI || "1000000000000000"; // 0.001 MATIC default
  const gas = gasOverrides();

  console.log("Signer:", signer.address);
  console.log("Keeper:", keeperAddr);
  console.log("minNativeWei:", minWei.toString());

  const upkeep = new ethers.Contract(env.UPKEEP_PROXY, ABI_UPKEEP, signer);
  const dripProxy = new ethers.Contract(env.DRIP_KEEPER_PROXY, ABI_DRIP_PROXY, signer);

  console.log("Setting buyback threshold...");
  await (await upkeep.setThreshold(minWei, gas)).wait();
  console.log("Unpausing buyback upkeep...");
  await (await upkeep.setPaused(false, gas)).wait();

  console.log("Whitelisting keeper for drip proxy...");
  await (await dripProxy.setKeeper(keeperAddr, true, gas)).wait();
  console.log("Unpausing drip proxy...");
  await (await dripProxy.unpause(gas)).wait();

  console.log("Hotovo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
