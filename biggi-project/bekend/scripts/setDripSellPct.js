require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const signer = (await ethers.getSigners())[0];
  const dripLM = process.env.DRIP_LM;
  const targetPct = 75; // sell 75% (o 25% méně než buyback nakoupil)

  if (!dripLM) throw new Error("Missing env var DRIP_LM");

  const abi = [
    "function sellPct() view returns (uint8)",
    "function setSellPct(uint8 pct) external",
  ];
  const c = new ethers.Contract(dripLM, abi, signer);

  const current = await c.sellPct();
  console.log(`DripLM: ${dripLM}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Current sellPct: ${current}%`);

  if (current == targetPct) {
    console.log("sellPct already set, nothing to do.");
    return;
  }

  const tx = await c.setSellPct(targetPct);
  console.log(`setSellPct(${targetPct}) tx: ${tx.hash}`);
  await tx.wait();
  const updated = await c.sellPct();
  console.log(`Updated sellPct: ${updated}%`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
