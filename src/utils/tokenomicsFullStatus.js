import * as ethers from "ethers";

const FULL_STATUS_TYPES_V2 = [
  "tuple(address token,address weth,address router,address pair,address token0,address token1,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBUYBACK,address COLLECTIONREWARDS,address reserve,address BUYBACKAgent,address treasury,address COMMUNITYCENTER)",
  "tuple(address BUYBACKAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBUYBACKEnabled,bool paused,uint256 lastBUYBACKAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
  "tuple(address DRIPDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address DRIPLM)",
  "tuple(address tokenREWARDS,uint256 REWARDSCap,uint256 REWARDSMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
];

const FULL_STATUS_TYPES_V1 = [
  "tuple(address token,address weth,address router,address pair,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBUYBACK,address COLLECTIONREWARDS,address reserve,address BUYBACKAgent,address treasury,address COMMUNITYCENTER)",
  "tuple(address BUYBACKAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBUYBACKEnabled,bool paused,uint256 lastBUYBACKAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
  "tuple(address DRIPDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address DRIPLM)",
  "tuple(address tokenREWARDS,uint256 REWARDSCap,uint256 REWARDSMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
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






