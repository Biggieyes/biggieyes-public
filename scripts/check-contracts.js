#!/usr/bin/env node
// Quick connectivity checker for frontend contracts (Polygon Amoy)
// Usage: RPC=https://... npm run check:contracts

import { ethers } from "ethers";
import { readFile } from "fs/promises";
import { ADDR } from "../src/utils/addresses.js";

async function loadJson(path) {
  const raw = await readFile(new URL(path, import.meta.url), "utf8");
  return JSON.parse(raw);
}

const FALLBACK_RPCS = [
  process.env.VITE_AMOY_RPC_URL,
  process.env.RPC,
  "https://polygon-amoy.drpc.org",
  "https://rpc-amoy.polygon.technology",
  "https://1rpc.io/polygon/amoy",
].filter(Boolean);

function pickRpc() {
  const u = FALLBACK_RPCS.find(Boolean);
  if (!u) throw new Error("No RPC provided (set VITE_AMOY_RPC_URL or RPC env)");
  return u;
}

async function main() {
  const [ABI_MAIN, ABI_TOKENOMIC_READER] = await Promise.all([
    loadJson("../src/utils/abi/BiggiMain.json"),
    loadJson("../src/utils/abi/BiggiTokenomicReader.json"),
  ]);
  const rpc = pickRpc();
  const provider = new ethers.providers.JsonRpcProvider(rpc, 80002);

  console.log("RPC:", rpc);
  const block = await provider.getBlockNumber();
  console.log("✔️  Connected, latest block:", block);

  const mainAddr = ADDR.MAIN;
  if (!mainAddr) throw new Error("ADDR.MAIN missing");
  const main = new ethers.Contract(mainAddr, ABI_MAIN, provider);
  const owner = await main.owner().catch(() => null);
  console.log("✔️  MAIN:", mainAddr, owner ? `(owner ${owner})` : "owner read failed");

  const readerAddr = ADDR.BIGGI_TOKENOMICS_READER;
  if (!readerAddr) throw new Error("ADDR.BIGGI_TOKENOMICS_READER missing");
  const reader = new ethers.Contract(readerAddr, ABI_TOKENOMIC_READER, provider);
  let status;
  try {
    status = await reader.getFullStatus();
  } catch (err) {
    const data = err?.data;
    if (data) {
      try {
        const coder = ethers.utils.defaultAbiCoder;
        status = coder.decode([
          "tuple(address token,address weth,address router,address pair,address token0,address token1,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
          "tuple(address distributor,uint256 totalReceived,uint256 pendingBuyback,address collectionRewards,address reserve,address buybackAgent,address treasury,address communityCenter)",
          "tuple(address buybackAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBuybackEnabled,bool paused,uint256 lastBuybackAt,address router,address wrappedNative,address treasury)",
          "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
          "tuple(address dripDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address dripLM)",
          "tuple(address tokenRewards,uint256 rewardsCap,uint256 rewardsMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)"
        ], data);
        console.log("(decoded from revert data)");
      } catch (decodeErr) {
        console.error("Decode of revert data failed", decodeErr?.message || decodeErr);
      }
    }
    if (!status) throw err;
  }
  const core = status?.core ?? status?.[0];
  const dist = status?.dist ?? status?.[1];
  const token = core?.token || core?.[0];
  const router = core?.router || core?.[2];
  const pair = core?.pair || core?.[3];
  const distributor = dist?.distributor || dist?.[0];
  const collectionRewards = dist?.collectionRewards || dist?.[3];
  const reserve = dist?.reserve || dist?.[4];
  const buyback = dist?.buybackAgent || dist?.[5];
  const treasury = dist?.treasury || dist?.[6];
  const community = dist?.communityCenter || dist?.[7];
  const lm = (status?.[3]?.liquidityManager) || (status?.[3]?.[7]) || null;
  const vault = (status?.[3]?.liquidityVault) || (status?.[3]?.[8]) || null;
  const drip = status?.[4] || {};
  const dripDistributor = drip.dripDistributor || drip[0];
  const dripLm = drip.dripLM || drip.dripLm || drip[6];
  const tr = status?.[5] || {};
  const tokenRewards = tr.tokenRewards || tr[0];

  const show = (label, v) => console.log("    " + label.padEnd(14) + (v || "0x0"));

  console.log("✔️  TokenomicsReader:", readerAddr);
  show("token", token);
  show("router", router);
  show("pair", pair);
  show("distributor", distributor);
  show("collectionRw", collectionRewards);
  show("reserve", reserve);
  show("buyback", buyback);
  show("treasury", treasury);
  show("community", community);
  show("lm", lm);
  show("vault", vault);
  show("dripDist", dripDistributor);
  show("dripLM", dripLm);
  show("tokenRewards", tokenRewards);
}

main().catch((err) => {
  console.error("✖️  Check failed:", err?.message || err);
  process.exit(1);
});
