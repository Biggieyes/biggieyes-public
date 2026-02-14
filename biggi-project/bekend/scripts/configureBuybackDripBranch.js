// Configure Buyback/Drip branch + whitelist collections
// Run: npx hardhat run scripts/configureBuybackDripBranch.js --network amoy

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
    SETUP:
      env.BIGGIBUYBACKDRIPSETUP ||
      addresses.BIGGIBUYBACKDRIPSETUP ||
      "0x53e6eC54C5c1e249c5d00c64494722deB1085637",
    BUYBACK_AGENT:
      env.BUYBACK_AGENT ||
      addresses.BUYBACK_AGENT ||
      "0x06fC8552119d8B46e8dd19C54c81b9E3bDEfa266",
    DRIP_DISTRIBUTOR:
      env.DRIP_DISTRIBUTOR ||
      addresses.DRIP_DISTRIBUTOR ||
      "0xbA5f786863a17a79A08bc1C35171aD5F32cDC310",
    DRIP_LM:
      env.DRIP_LM ||
      addresses.DRIP_LM ||
      "0xD32fC50c153Ab47F68763c739A2deA8b5Da81373",
    RESERVE:
      env.RESERVE ||
      addresses.RESERVE ||
      "0xC700EA8E43259C832C2438D01F60C88752894B8f",
    TREASURY:
      env.TREASURY ||
      addresses.TREASURY ||
      "0xE2fa9DFFc69f53b42dC41681bfFd22dA74c64461",
    ROUTER:
      env.ROUTER ||
      addresses.ROUTER ||
      "0xB767E3Cd07fD0Dd96827895AB8b3801A3b141e8a",
    POLICY:
      env.POLICY ||
      addresses.POLICY ||
      "0xeaf0b4561CF70D130ff4E68C3558f77b432C2EC1",
    MAIN:
      env.MAIN ||
      env.COLLECTION ||
      addresses.COLLECTION ||
      "0x3430f378032Cead7A82f38047e906C1E3cAFc703",
    MAIN2:
      env.MAIN2 ||
      env.COLLECTION2 ||
      addresses.COLLECTION2 ||
      "0xf511267b2A08Cd2f94ACc0eF74c4Eb1Ac799980B",
  };

  const defaults = {
    buybackPath: [],
    buybackSlipBps: Number(env.BUYBACK_SLIP_BPS || 300),
    buybackDeadline: Number(env.BUYBACK_DEADLINE_SEC || 900),
    buybackCooldown: Number(env.BUYBACK_COOLDOWN_SEC || 900),
    autoEnable: env.BUYBACK_AUTO_ENABLE === "true" ? true : false,
    dripSellPct: Number(env.DRIP_SELL_PCT || 70),
    dripSlippage: Number(env.DRIP_SLIP_BPS || 300),
    dripDeadline: Number(env.DRIP_DEADLINE_SEC || 900),
    tokensPerMint: env.TOKENS_PER_MINT ? BigInt(env.TOKENS_PER_MINT) : 0n,
  };

  console.log("Deployer:", deployer.address);
  console.log("Config:", cfg);
  console.log("Defaults:", defaults);

  const buybackAbi = [
    "function router() view returns (address)",
    "function treasury() view returns (address)",
    "function policy() view returns (address)",
    "function dripLM() view returns (address)",
    "function fallbackSwapSlippageBps() view returns (uint256)",
    "function fallbackTxDeadlineSec() view returns (uint256)",
    "function fallbackMinIntervalSec() view returns (uint256)",
    "function autoBuybackEnabled() view returns (bool)",
    "function setRouter(address)",
    "function setTreasury(address)",
    "function setPolicy(address)",
    "function setDripLM(address)",
    "function setSwapPath(address[] calldata)",
    "function clearSwapPath()",
    "function setFallbacks(uint256,uint256,uint256)",
    "function toggleAutoBuyback(bool)",
  ];
  const dripLmAbi = [
    "function router() view returns (address)",
    "function reserve() view returns (address)",
    "function dripDistributor() view returns (address)",
    "function buybackAgent() view returns (address)",
    "function sellPct() view returns (uint8)",
    "function slippageBps() view returns (uint256)",
    "function txDeadlineSec() view returns (uint256)",
    "function setRouter(address)",
    "function setReserve(address)",
    "function setDripDistributor(address)",
    "function setBuybackAgent(address)",
    "function setSellPct(uint8)",
    "function setSlippageBps(uint256)",
    "function setTxDeadlineSec(uint256)",
  ];
  const dripAbi = [
    "function treasury() view returns (address)",
    "function dripLM() view returns (address)",
    "function tokensPerMint() view returns (uint256)",
    "function tokensPerMintOperator() view returns (address)",
    "function collections(address) view returns (bool)",
    "function setTreasury(address)",
    "function setDripLM(address)",
    "function setTokensPerMint(uint256)",
    "function setTokensPerMintOperator(address)",
    "function setCollection(address,bool)",
  ];

  const buyback = new ethers.Contract(
    cfg.BUYBACK_AGENT || addresses.BUYBACK_AGENT || "0x06fC8552119d8B46e8dd19C54c81b9E3bDEfa266",
    buybackAbi,
    deployer,
  );
  const dripLm = new ethers.Contract(cfg.DRIP_LM, dripLmAbi, deployer);
  const drip = new ethers.Contract(cfg.DRIP_DISTRIBUTOR, dripAbi, deployer);

  // BuybackAgent wiring + defaults
  const curRouter = await buyback.router();
  if (curRouter.toLowerCase() !== cfg.ROUTER?.toLowerCase?.()) {
    const tx = await buyback.setRouter(cfg.ROUTER || addresses.ROUTER || "0xB767E3Cd07fD0Dd96827895AB8b3801A3b141e8a");
    console.log("buyback.setRouter tx:", tx.hash);
    await tx.wait();
  }
  const curTreasury = await buyback.treasury();
  if (curTreasury.toLowerCase() !== cfg.TREASURY.toLowerCase()) {
    const tx = await buyback.setTreasury(cfg.TREASURY);
    console.log("buyback.setTreasury tx:", tx.hash);
    await tx.wait();
  }
  const curPolicy = await buyback.policy();
  const policyAddr = cfg.POLICY || addresses.POLICY || "0xeaf0b4561CF70D130ff4E68C3558f77b432C2EC1";
  if (curPolicy.toLowerCase() !== policyAddr.toLowerCase()) {
    const tx = await buyback.setPolicy(policyAddr);
    console.log("buyback.setPolicy tx:", tx.hash);
    await tx.wait();
  }
  const curDripLm = await buyback.dripLM();
  if (curDripLm.toLowerCase() !== cfg.DRIP_LM.toLowerCase()) {
    const tx = await buyback.setDripLM(cfg.DRIP_LM);
    console.log("buyback.setDripLM tx:", tx.hash);
    await tx.wait();
  }
  if (defaults.buybackPath.length === 0) {
    const tx = await buyback.clearSwapPath();
    console.log("buyback.clearSwapPath tx:", tx.hash);
    await tx.wait();
  } else {
    const tx = await buyback.setSwapPath(defaults.buybackPath);
    console.log("buyback.setSwapPath tx:", tx.hash);
    await tx.wait();
  }
  const curSlip = await buyback.fallbackSwapSlippageBps();
  const curDeadline = await buyback.fallbackTxDeadlineSec();
  const curCooldown = await buyback.fallbackMinIntervalSec();
  if (
    curSlip.toString() !== String(defaults.buybackSlipBps) ||
    curDeadline.toString() !== String(defaults.buybackDeadline) ||
    curCooldown.toString() !== String(defaults.buybackCooldown)
  ) {
    const tx = await buyback.setFallbacks(
      defaults.buybackSlipBps,
      defaults.buybackDeadline,
      defaults.buybackCooldown,
    );
    console.log("buyback.setFallbacks tx:", tx.hash);
    await tx.wait();
  }
  const curAuto = await buyback.autoBuybackEnabled();
  if (curAuto !== defaults.autoEnable) {
    const tx = await buyback.toggleAutoBuyback(defaults.autoEnable);
    console.log("buyback.toggleAutoBuyback tx:", tx.hash);
    await tx.wait();
  }

  // DripLM wiring + defaults
  if ((await dripLm.router()).toLowerCase() !== (cfg.ROUTER || addresses.ROUTER).toLowerCase()) {
    const tx = await dripLm.setRouter(cfg.ROUTER || addresses.ROUTER);
    console.log("dripLm.setRouter tx:", tx.hash);
    await tx.wait();
  }
  if ((await dripLm.reserve()).toLowerCase() !== (addresses.RESERVE || cfg.RESERVE).toLowerCase()) {
    const tx = await dripLm.setReserve(addresses.RESERVE || cfg.RESERVE);
    console.log("dripLm.setReserve tx:", tx.hash);
    await tx.wait();
  }
  if ((await dripLm.dripDistributor()).toLowerCase() !== cfg.DRIP_DISTRIBUTOR.toLowerCase()) {
    const tx = await dripLm.setDripDistributor(cfg.DRIP_DISTRIBUTOR);
    console.log("dripLm.setDripDistributor tx:", tx.hash);
    await tx.wait();
  }
  if ((await dripLm.buybackAgent()).toLowerCase() !== (cfg.BUYBACK_AGENT || addresses.BUYBACK_AGENT).toLowerCase()) {
    const tx = await dripLm.setBuybackAgent(cfg.BUYBACK_AGENT || addresses.BUYBACK_AGENT);
    console.log("dripLm.setBuybackAgent tx:", tx.hash);
    await tx.wait();
  }
  if ((await dripLm.sellPct()).toString() !== String(defaults.dripSellPct)) {
    const tx = await dripLm.setSellPct(defaults.dripSellPct);
    console.log("dripLm.setSellPct tx:", tx.hash);
    await tx.wait();
  }
  if ((await dripLm.slippageBps()).toString() !== String(defaults.dripSlippage)) {
    const tx = await dripLm.setSlippageBps(defaults.dripSlippage);
    console.log("dripLm.setSlippageBps tx:", tx.hash);
    await tx.wait();
  }
  if ((await dripLm.txDeadlineSec()).toString() !== String(defaults.dripDeadline)) {
    const tx = await dripLm.setTxDeadlineSec(defaults.dripDeadline);
    console.log("dripLm.setTxDeadlineSec tx:", tx.hash);
    await tx.wait();
  }

  // DripDistributor wiring + operator + whitelist
  if ((await drip.treasury()).toLowerCase() !== cfg.TREASURY.toLowerCase()) {
    const tx = await drip.setTreasury(cfg.TREASURY);
    console.log("drip.setTreasury tx:", tx.hash);
    await tx.wait();
  }
  if ((await drip.dripLM()).toLowerCase() !== cfg.DRIP_LM.toLowerCase()) {
    const tx = await drip.setDripLM(cfg.DRIP_LM);
    console.log("drip.setDripLM tx:", tx.hash);
    await tx.wait();
  }
  if ((await drip.tokensPerMint()).toString() !== String(defaults.tokensPerMint)) {
    const tx = await drip.setTokensPerMint(defaults.tokensPerMint);
    console.log("drip.setTokensPerMint tx:", tx.hash);
    await tx.wait();
  }
  const currentOp = await drip.tokensPerMintOperator();
  if (currentOp.toLowerCase() !== cfg.DRIP_LM.toLowerCase()) {
    const tx = await drip.setTokensPerMintOperator(cfg.DRIP_LM);
    console.log("drip.setTokensPerMintOperator tx:", tx.hash);
    await tx.wait();
  }
  for (const [label, addr] of [
    ["MAIN", cfg.MAIN],
    ["MAIN2", cfg.MAIN2],
  ]) {
    const allowed = await drip.collections(addr);
    if (!allowed) {
      const tx = await drip.setCollection(addr, true);
      console.log(`drip.setCollection ${label} tx:`, tx.hash);
      await tx.wait();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
