// scripts/updateBuybackAgent.js
// Spusť: `npx hardhat run scripts/updateBuybackAgent.js --network polygon`
// Potřebné env proměnné:
//  - POLYGON_RPC_URL, PRIVATE_KEY
//  - NEW_BUYBACK_AGENT=0xB775Bd018053264033f9e8305DcF3BD7cf205F8e
//  - Volitelně adresy cílů, které má skript přenastavit (pokud nejsou, krok se přeskočí):
//      TREASURY, DRIP_LM, DISTRIBUTOR, UPKEEP_PROXY, MASTER_CONFIG, DRIP_DISTRIBUTOR, POLICY
//      (Master config používá pumpBundle pro zbytek hodnot)
//
// KROKY:
// 1) Treasury.setBuybackAgent
// 2) DripLM.setBuybackAgent
// 3) MultiCollectionDistributor.setBuybackAgent
// 4) UpkeepProxy.setAgent
// 5) MasterTokenomicsConfig.setPumpBranch (ponechá ostatní adresy z pumpBundle)

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_TREASURY = ["function setBuybackAgent(address b) external"];
const ABI_DRIP_LM = ["function setBuybackAgent(address a) external"];
const ABI_DISTRIBUTOR = ["function setBuybackAgent(address addr) external"];
const ABI_UPKEEP = ["function setAgent(address a) external"];
const ABI_MASTER = [
  "function pumpBundle() external view returns (address,address,address,address)",
  "function setPumpBranch(address _buybackAgent, address _dripLM, address _dripDistributor, address _policy) external",
];
const ABI_BUYBACK_AGENT = ["function setPolicy(address policy_) external"];

function gasOverridesFromEnv() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

async function maybeCall(label, addr, abi, callFn) {
  if (!addr) {
    console.log(`[${label}] přeskočeno (nenastavena adresa).`);
    return;
  }
  const signer = maybeCall.signer || (maybeCall.signer = new ethers.Wallet(process.env.PRIVATE_KEY, hre.ethers.provider));
  const c = new ethers.Contract(addr, abi, signer);
  await callFn(c);
}

async function main() {
  const env = process.env;
  if (!env.NEW_BUYBACK_AGENT) throw new Error("Chybí NEW_BUYBACK_AGENT v .env");
  if (!env.PRIVATE_KEY) throw new Error("Chybí PRIVATE_KEY v .env");

  const newAgent = env.NEW_BUYBACK_AGENT;
  console.log("New buyback agent:", newAgent);
  const gasOverrides = gasOverridesFromEnv();

  // 1) Treasury
  await maybeCall("Treasury", env.TREASURY, ABI_TREASURY, async (c) => {
    const tx = await c.setBuybackAgent(newAgent, gasOverrides);
    console.log("  Treasury.setBuybackAgent tx:", tx.hash);
    await tx.wait();
  });

  // 2) DripLM
  await maybeCall("DripLM", env.DRIP_LM, ABI_DRIP_LM, async (c) => {
    const tx = await c.setBuybackAgent(newAgent, gasOverrides);
    console.log("  DripLM.setBuybackAgent tx:", tx.hash);
    await tx.wait();
  });

  // 2b) BuybackAgent policy (optional)
  await maybeCall("BuybackAgent policy", env.NEW_BUYBACK_AGENT, ABI_BUYBACK_AGENT, async (c) => {
    if (!env.POLICY) {
      console.log("  POLICY not set, skipping BuybackAgent.setPolicy");
      return;
    }
    const tx = await c.setPolicy(env.POLICY, gasOverrides);
    console.log("  BuybackAgent.setPolicy tx:", tx.hash);
    await tx.wait();
  });

  // 3) MultiCollectionDistributor
  await maybeCall("Distributor", env.DISTRIBUTOR, ABI_DISTRIBUTOR, async (c) => {
    const tx = await c.setBuybackAgent(newAgent, gasOverrides);
    console.log("  Distributor.setBuybackAgent tx:", tx.hash);
    await tx.wait();
  });

  // 4) Upkeep proxy
  await maybeCall("UpkeepProxy", env.UPKEEP_PROXY, ABI_UPKEEP, async (c) => {
    const tx = await c.setAgent(newAgent, gasOverrides);
    console.log("  UpkeepProxy.setAgent tx:", tx.hash);
    await tx.wait();
  });

  // 5) MasterTokenomicsConfig
  await maybeCall("MasterConfig", env.MASTER_CONFIG, ABI_MASTER, async (c) => {
    const [_, dripLM, dripDistributor, policy] = await c.pumpBundle();
    const useDripLM = env.DRIP_LM || dripLM;
    const useDripDistributor = env.DRIP_DISTRIBUTOR || dripDistributor;
    const usePolicy = env.POLICY || policy;
    console.log("  pumpBundle (before):", { buybackAgent: newAgent, dripLM: useDripLM, dripDistributor: useDripDistributor, policy: usePolicy });
    const tx = await c.setPumpBranch(newAgent, useDripLM, useDripDistributor, usePolicy, gasOverrides);
    console.log("  MasterConfig.setPumpBranch tx:", tx.hash);
    await tx.wait();
  });

  console.log("Hotovo. Zkontroluj logy a block explorer.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
