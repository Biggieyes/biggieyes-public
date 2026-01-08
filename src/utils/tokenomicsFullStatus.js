import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";

const FULL_STATUS_TYPES_V2 = [
  "tuple(address token,address weth,address router,address pair,address token0,address token1,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBuyback,address collectionRewards,address reserve,address buybackAgent,address treasury,address communityCenter)",
  "tuple(address buybackAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBuybackEnabled,bool paused,uint256 lastBuybackAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
  "tuple(address dripDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address dripLM)",
  "tuple(address tokenRewards,uint256 rewardsCap,uint256 rewardsMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
];

const FULL_STATUS_TYPES_V1 = [
  "tuple(address token,address weth,address router,address pair,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBuyback,address collectionRewards,address reserve,address buybackAgent,address treasury,address communityCenter)",
  "tuple(address buybackAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBuybackEnabled,bool paused,uint256 lastBuybackAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
  "tuple(address dripDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address dripLM)",
  "tuple(address tokenRewards,uint256 rewardsCap,uint256 rewardsMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
];

function pickRevertData(err) {
  const candidates = [
    err?.data,
    err?.error?.data,
    err?.error?.error?.data,
    err?.info?.error?.data,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.startsWith("0x") && v.length > 2) return v;
  }
  return null;
}

export function decodeTokenomicsFullStatus(data) {
  if (
    !data ||
    typeof data !== "string" ||
    !data.startsWith("0x") ||
    data.length <= 2
  )
    return null;
  const coder = ethers.utils.defaultAbiCoder;
  try {
    return coder.decode(FULL_STATUS_TYPES_V2, data);
  } catch {
    // fallback for older deployments (missing token0/token1 in core tuple)
  }
  try {
    return coder.decode(FULL_STATUS_TYPES_V1, data);
  } catch {
    return null;
  }
}

/**
 * Some TokenomicsReader deployments intentionally revert with ABI-encoded data
 * (off-chain decodes it). This helper makes `getFullStatus()` usable in FE.
 */
export async function getFullStatusSafe(reader) {
  if (!reader || typeof reader.getFullStatus !== "function") {
    throw new Error(
      "Tokenomics reader is not initialized or missing getFullStatus()",
    );
  }
  try {
    return await reader.getFullStatus();
  } catch (err) {
    const data = pickRevertData(err);
    const decoded = decodeTokenomicsFullStatus(data);
    if (decoded) return decoded;
    throw err;
  }
}

