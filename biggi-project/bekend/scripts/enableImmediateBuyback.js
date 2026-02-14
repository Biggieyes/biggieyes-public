// Enable immediate auto-buyback (no interval) on BuybackAgent + Policy
// Run: npx hardhat run scripts/enableImmediateBuyback.js --network amoy

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const env = process.env;

  const addressesPath = path.join(__dirname, "..", "addresses.json");
  const addresses = fs.existsSync(addressesPath)
    ? JSON.parse(fs.readFileSync(addressesPath, "utf8"))
    : {};

  const cfg = {
    BUYBACK_AGENT:
      env.BUYBACK_AGENT ||
      addresses.BUYBACK_AGENT ||
      "0x06fC8552119d8B46e8dd19C54c81b9E3bDEfa266",
    POLICY:
      env.POLICY ||
      addresses.POLICY ||
      "0xeaf0b4561CF70D130ff4E68C3558f77b432C2EC1",
  };

  console.log("Deployer:", deployer.address);
  console.log("Config:", cfg);

  const policyAbi = [
    "function minBuybackInterval() view returns (uint256)",
    "function buybacksPaused() view returns (bool)",
    "function setMinBuybackInterval(uint256)",
    "function setBuybacksPaused(bool)",
  ];
  const buybackAbi = [
    "function fallbackSwapSlippageBps() view returns (uint256)",
    "function fallbackTxDeadlineSec() view returns (uint256)",
    "function fallbackMinIntervalSec() view returns (uint256)",
    "function autoBuybackEnabled() view returns (bool)",
    "function setFallbacks(uint256,uint256,uint256)",
    "function toggleAutoBuyback(bool)",
  ];

  const policy = new ethers.Contract(cfg.POLICY, policyAbi, deployer);
  const buyback = new ethers.Contract(cfg.BUYBACK_AGENT, buybackAbi, deployer);

  const currentInterval = await policy.minBuybackInterval();
  if (currentInterval.toString() !== "0") {
    const tx = await policy.setMinBuybackInterval(0);
    console.log("policy.setMinBuybackInterval tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("policy.minBuybackInterval already 0");
  }

  const paused = await policy.buybacksPaused();
  if (paused) {
    const tx = await policy.setBuybacksPaused(false);
    console.log("policy.setBuybacksPaused tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("policy.buybacksPaused already false");
  }

  const curSlip = await buyback.fallbackSwapSlippageBps();
  const curDeadline = await buyback.fallbackTxDeadlineSec();
  const curCooldown = await buyback.fallbackMinIntervalSec();
  if (curCooldown.toString() !== "0") {
    const tx = await buyback.setFallbacks(
      curSlip,
      curDeadline,
      0,
    );
    console.log("buyback.setFallbacks tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("buyback.fallbackMinIntervalSec already 0");
  }

  const auto = await buyback.autoBuybackEnabled();
  if (!auto) {
    const tx = await buyback.toggleAutoBuyback(true);
    console.log("buyback.toggleAutoBuyback tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("buyback.autoBuybackEnabled already true");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
