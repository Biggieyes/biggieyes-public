import * as ethers from "ethers";

const FULL_STATUS_TYPES_CURRENT = [
  "tuple(address token,address weth,address router,address pair,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBuyback,address collectionRewards,address reserve,address buybackAgent,address treasury,address communityCenter)",
  "tuple(address buybackAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBuybackEnabled,bool paused,uint256 lastBuybackAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 polBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address liquidityManager,address keeper,address liquidityVault,bool pairWhitelisted,uint256 lpBalanceInVault)",
  "tuple(address dripDistributor,uint256 availableTokens,uint256 totalReceived,uint256 totalClaimed,uint256 totalNotified,uint256 tokensPerMint,address dripLM,address dripReserve,address dripModeratorCenter,uint16 reserveShareBps,uint16 moderatorShareBps,uint8 sellPct,uint256 slippageBps,uint256 txDeadlineSec,address dripRouter,address dripBuyback)",
  "tuple(address tokenRewards,uint256 rewardsCap,uint256 rewardsMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
];

const FULL_STATUS_TYPES_LEGACY_V2 = [
  "tuple(address token,address weth,address router,address pair,address token0,address token1,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBUYBACK,address COLLECTIONREWARDS,address reserve,address BUYBACKAgent,address treasury,address COMMUNITYCENTER)",
  "tuple(address BUYBACKAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBUYBACKEnabled,bool paused,uint256 lastBUYBACKAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
  "tuple(address DRIPDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address DRIPLM)",
  "tuple(address tokenREWARDS,uint256 REWARDSCap,uint256 REWARDSMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
];

const FULL_STATUS_TYPES_LEGACY_V1 = [
  "tuple(address token,address weth,address router,address pair,uint112 reserveNative,uint112 reserveBiggi,uint256 lpTotalSupply,uint256 biggiPerNative,uint256 nativePerBiggi)",
  "tuple(address distributor,uint256 totalReceived,uint256 pendingBUYBACK,address COLLECTIONREWARDS,address reserve,address BUYBACKAgent,address treasury,address COMMUNITYCENTER)",
  "tuple(address BUYBACKAgent,uint256 nativeBalance,uint256 biggiBalance,uint256 totalNativeReceived,uint256 totalNativeSpent,uint256 totalBiggiAcquired,bool autoBUYBACKEnabled,bool paused,uint256 lastBUYBACKAt,address router,address wrappedNative,address treasury)",
  "tuple(address reserve,uint256 maticBalance,uint256 waitingBiggi,uint256 dexRefillBiggi,address keeper,bool pairWhitelisted,uint256 lpBalanceInVault,address liquidityManager,address liquidityVault)",
  "tuple(address DRIPDistributor,uint256 totalTopUp,uint256 totalClaimed,uint256 totalNotified,uint256 availableTokens,uint256 tokensPerMint,address DRIPLM)",
  "tuple(address tokenREWARDS,uint256 REWARDSCap,uint256 REWARDSMinted,uint256 balance,uint256 unitReward,uint8[11] blockWeights,address token)",
];

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const isAddressLike = (value) =>
  typeof value === "string" && ADDRESS_RE.test(value);

const pickDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

function normalizeCoreTuple(coreRaw) {
  if (!coreRaw) return null;

  const hasTokenPair =
    isAddressLike(coreRaw?.token0) ||
    isAddressLike(coreRaw?.token1) ||
    (isAddressLike(coreRaw?.[4]) && isAddressLike(coreRaw?.[5]));

  const reserveNativeIndex = hasTokenPair ? 6 : 4;
  const reserveBiggiIndex = hasTokenPair ? 7 : 5;
  const lpTotalSupplyIndex = hasTokenPair ? 8 : 6;
  const biggiPerNativeIndex = hasTokenPair ? 9 : 7;
  const nativePerBiggiIndex = hasTokenPair ? 10 : 8;

  return {
    ...coreRaw,
    token: pickDefined(coreRaw?.token, coreRaw?.[0]),
    weth: pickDefined(coreRaw?.weth, coreRaw?.[1]),
    router: pickDefined(coreRaw?.router, coreRaw?.[2]),
    pair: pickDefined(coreRaw?.pair, coreRaw?.[3]),
    token0: pickDefined(coreRaw?.token0, hasTokenPair ? coreRaw?.[4] : null),
    token1: pickDefined(coreRaw?.token1, hasTokenPair ? coreRaw?.[5] : null),
    reserveNative: pickDefined(coreRaw?.reserveNative, coreRaw?.[reserveNativeIndex]),
    reserveBiggi: pickDefined(coreRaw?.reserveBiggi, coreRaw?.[reserveBiggiIndex]),
    lpTotalSupply: pickDefined(coreRaw?.lpTotalSupply, coreRaw?.[lpTotalSupplyIndex]),
    biggiPerNative: pickDefined(coreRaw?.biggiPerNative, coreRaw?.[biggiPerNativeIndex]),
    nativePerBiggi: pickDefined(coreRaw?.nativePerBiggi, coreRaw?.[nativePerBiggiIndex]),
  };
}

function normalizeDistributorTuple(distRaw) {
  if (!distRaw) return null;
  const collectionRewards = pickDefined(
    distRaw?.collectionRewards,
    distRaw?.COLLECTIONREWARDS,
    distRaw?.[3],
  );
  const buybackAgent = pickDefined(
    distRaw?.buybackAgent,
    distRaw?.BUYBACKAgent,
    distRaw?.[5],
  );
  const communityCenter = pickDefined(
    distRaw?.communityCenter,
    distRaw?.COMMUNITYCENTER,
    distRaw?.[7],
  );
  const pendingBuyback = pickDefined(
    distRaw?.pendingBuyback,
    distRaw?.pendingBUYBACK,
    distRaw?.[2],
  );

  return {
    ...distRaw,
    distributor: pickDefined(distRaw?.distributor, distRaw?.[0]),
    totalReceived: pickDefined(distRaw?.totalReceived, distRaw?.[1]),
    pendingBuyback,
    pendingBUYBACK: pendingBuyback,
    collectionRewards,
    COLLECTIONREWARDS: collectionRewards,
    reserve: pickDefined(distRaw?.reserve, distRaw?.[4]),
    buybackAgent,
    BUYBACKAgent: buybackAgent,
    treasury: pickDefined(distRaw?.treasury, distRaw?.[6]),
    communityCenter,
    COMMUNITYCENTER: communityCenter,
  };
}

function normalizeBuybackTuple(buyRaw) {
  if (!buyRaw) return null;
  const buybackAgent = pickDefined(
    buyRaw?.buybackAgent,
    buyRaw?.BUYBACKAgent,
    buyRaw?.[0],
  );
  const autoBuybackEnabled = pickDefined(
    buyRaw?.autoBuybackEnabled,
    buyRaw?.autoBUYBACKEnabled,
    buyRaw?.[6],
  );
  const lastBuybackAt = pickDefined(
    buyRaw?.lastBuybackAt,
    buyRaw?.lastBUYBACKAt,
    buyRaw?.[8],
  );

  return {
    ...buyRaw,
    buybackAgent,
    BUYBACKAgent: buybackAgent,
    nativeBalance: pickDefined(buyRaw?.nativeBalance, buyRaw?.[1]),
    biggiBalance: pickDefined(buyRaw?.biggiBalance, buyRaw?.[2]),
    totalNativeReceived: pickDefined(buyRaw?.totalNativeReceived, buyRaw?.[3]),
    totalNativeSpent: pickDefined(buyRaw?.totalNativeSpent, buyRaw?.[4]),
    totalBiggiAcquired: pickDefined(buyRaw?.totalBiggiAcquired, buyRaw?.[5]),
    autoBuybackEnabled,
    autoBUYBACKEnabled: autoBuybackEnabled,
    paused: pickDefined(buyRaw?.paused, buyRaw?.[7]),
    lastBuybackAt,
    lastBUYBACKAt: lastBuybackAt,
    router: pickDefined(buyRaw?.router, buyRaw?.[9]),
    wrappedNative: pickDefined(buyRaw?.wrappedNative, buyRaw?.[10]),
    treasury: pickDefined(buyRaw?.treasury, buyRaw?.[11]),
  };
}

function normalizeReserveTuple(resRaw) {
  if (!resRaw) return null;

  const usesCurrentOrder =
    typeof pickDefined(resRaw?.pairWhitelisted, resRaw?.[7]) === "boolean";

  const liquidityManager = usesCurrentOrder
    ? pickDefined(resRaw?.liquidityManager, resRaw?.[4])
    : pickDefined(resRaw?.liquidityManager, resRaw?.[7]);
  const keeper = usesCurrentOrder
    ? pickDefined(resRaw?.keeper, resRaw?.[5])
    : pickDefined(resRaw?.keeper, resRaw?.[4]);
  const liquidityVault = usesCurrentOrder
    ? pickDefined(resRaw?.liquidityVault, resRaw?.[6])
    : pickDefined(resRaw?.liquidityVault, resRaw?.[8]);
  const pairWhitelisted = usesCurrentOrder
    ? pickDefined(resRaw?.pairWhitelisted, resRaw?.[7])
    : pickDefined(resRaw?.pairWhitelisted, resRaw?.[5]);
  const lpBalanceInVault = usesCurrentOrder
    ? pickDefined(resRaw?.lpBalanceInVault, resRaw?.[8])
    : pickDefined(resRaw?.lpBalanceInVault, resRaw?.[6]);
  const polBalance = pickDefined(
    resRaw?.polBalance,
    resRaw?.maticBalance,
    resRaw?.[1],
  );

  return {
    ...resRaw,
    reserve: pickDefined(resRaw?.reserve, resRaw?.[0]),
    polBalance,
    maticBalance: polBalance,
    waitingBiggi: pickDefined(resRaw?.waitingBiggi, resRaw?.[2]),
    dexRefillBiggi: pickDefined(resRaw?.dexRefillBiggi, resRaw?.[3]),
    liquidityManager,
    keeper,
    liquidityVault,
    pairWhitelisted,
    lpBalanceInVault,
  };
}

function normalizeDripTuple(dripRaw) {
  if (!dripRaw) return null;

  const usesCurrentOrder =
    dripRaw?.dripReserve !== undefined ||
    dripRaw?.dripRouter !== undefined ||
    dripRaw?.length >= 16;

  const dripDistributor = pickDefined(
    dripRaw?.dripDistributor,
    dripRaw?.DRIPDistributor,
    dripRaw?.[0],
  );
  const dripLM = pickDefined(
    dripRaw?.dripLM,
    dripRaw?.DRIPLM,
    usesCurrentOrder ? dripRaw?.[6] : dripRaw?.[6],
  );
  const availableTokens = pickDefined(
    dripRaw?.availableTokens,
    usesCurrentOrder ? dripRaw?.[1] : dripRaw?.[4],
  );
  const totalReceived = pickDefined(
    dripRaw?.totalReceived,
    usesCurrentOrder ? dripRaw?.[2] : null,
  );
  const totalTopUp = pickDefined(
    dripRaw?.totalTopUp,
    !usesCurrentOrder ? dripRaw?.[1] : null,
  );
  const totalClaimed = pickDefined(
    dripRaw?.totalClaimed,
    usesCurrentOrder ? dripRaw?.[3] : dripRaw?.[2],
  );
  const totalNotified = pickDefined(
    dripRaw?.totalNotified,
    usesCurrentOrder ? dripRaw?.[4] : dripRaw?.[3],
  );
  const tokensPerMint = pickDefined(
    dripRaw?.tokensPerMint,
    usesCurrentOrder ? dripRaw?.[5] : dripRaw?.[5],
  );

  return {
    ...dripRaw,
    dripDistributor,
    DRIPDistributor: dripDistributor,
    availableTokens,
    totalReceived,
    totalTopUp,
    totalClaimed,
    totalNotified,
    tokensPerMint,
    dripLM,
    DRIPLM: dripLM,
    dripReserve: pickDefined(
      dripRaw?.dripReserve,
      usesCurrentOrder ? dripRaw?.[7] : null,
    ),
    dripModeratorCenter: pickDefined(
      dripRaw?.dripModeratorCenter,
      usesCurrentOrder ? dripRaw?.[8] : null,
    ),
    reserveShareBps: pickDefined(
      dripRaw?.reserveShareBps,
      usesCurrentOrder ? dripRaw?.[9] : null,
    ),
    moderatorShareBps: pickDefined(
      dripRaw?.moderatorShareBps,
      usesCurrentOrder ? dripRaw?.[10] : null,
    ),
    sellPct: pickDefined(dripRaw?.sellPct, usesCurrentOrder ? dripRaw?.[11] : null),
    slippageBps: pickDefined(
      dripRaw?.slippageBps,
      usesCurrentOrder ? dripRaw?.[12] : null,
    ),
    txDeadlineSec: pickDefined(
      dripRaw?.txDeadlineSec,
      usesCurrentOrder ? dripRaw?.[13] : null,
    ),
    dripRouter: pickDefined(
      dripRaw?.dripRouter,
      usesCurrentOrder ? dripRaw?.[14] : null,
    ),
    dripBuyback: pickDefined(
      dripRaw?.dripBuyback,
      usesCurrentOrder ? dripRaw?.[15] : null,
    ),
  };
}

function normalizeTokenRewardsTuple(trRaw) {
  if (!trRaw) return null;
  const tokenRewards = pickDefined(
    trRaw?.tokenRewards,
    trRaw?.tokenREWARDS,
    trRaw?.[0],
  );
  const rewardsCap = pickDefined(
    trRaw?.rewardsCap,
    trRaw?.REWARDSCap,
    trRaw?.[1],
  );
  const rewardsMinted = pickDefined(
    trRaw?.rewardsMinted,
    trRaw?.REWARDSMinted,
    trRaw?.[2],
  );

  return {
    ...trRaw,
    tokenRewards,
    tokenREWARDS: tokenRewards,
    rewardsCap,
    REWARDSCap: rewardsCap,
    rewardsMinted,
    REWARDSMinted: rewardsMinted,
    balance: pickDefined(trRaw?.balance, trRaw?.[3]),
    unitReward: pickDefined(trRaw?.unitReward, trRaw?.[4]),
    blockWeights: pickDefined(trRaw?.blockWeights, trRaw?.[5]),
    token: pickDefined(trRaw?.token, trRaw?.[6]),
  };
}

export function normalizeTokenomicsFullStatus(decoded) {
  if (!decoded) return null;

  const tuples = Array.isArray(decoded)
    ? decoded
    : [decoded?.core, decoded?.dist, decoded?.buy, decoded?.res, decoded?.drip, decoded?.tr];

  const [coreRaw, distRaw, buyRaw, resRaw, dripRaw, trRaw] = tuples;

  return {
    core: normalizeCoreTuple(coreRaw),
    dist: normalizeDistributorTuple(distRaw),
    buy: normalizeBuybackTuple(buyRaw),
    res: normalizeReserveTuple(resRaw),
    drip: normalizeDripTuple(dripRaw),
    tr: normalizeTokenRewardsTuple(trRaw),
  };
}

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
  const coder = ethers.AbiCoder.defaultAbiCoder();
  try {
    return coder.decode(FULL_STATUS_TYPES_CURRENT, data);
  } catch {
    // Try legacy shapes used by older tokenomics readers.
  }
  try {
    return coder.decode(FULL_STATUS_TYPES_LEGACY_V2, data);
  } catch {
    // fall through to oldest supported tuple shape
  }
  try {
    return coder.decode(FULL_STATUS_TYPES_LEGACY_V1, data);
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






