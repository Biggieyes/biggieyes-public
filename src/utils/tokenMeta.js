import { Contract } from "@ethersproject/contracts";
import { keccak256, arrayify, hexlify, isAddress } from "ethers";
import { BiggiToken as ABI_TOKEN } from "../config/abi/index.js";
import { ADDR } from "./addresses";
import { getFullStatusSafe } from "./tokenomicsFullStatus.js";

export async function refreshTokenMeta({
  getReadOnlyLiquidityContract,
  callFirst,
  getBiggiTokenomicsReaderRO,
  fetchCOMMUNITYCENTERStats,
  setBiggiData,
}) {
  const brl = await getReadOnlyLiquidityContract();

  const tokenAddr =
    (await callFirst(brl, [
      "tokenAddress",
      "token",
      "getToken",
      "biggi",
      "biggiToken",
    ])) ||
    ADDR.BIGGI ||
    ADDR.BIGGI_TOKEN ||
    null;

  if (!tokenAddr)
    throw new Error(
      "Unable to resolve BIGGI token address. Configure ADDR.BIGGI or expose tokenAddress().",
    );

  const meta = await callFirst(brl, ["tokenMeta", "getTokenMeta", "biggiMeta"]);
  const capLeft = await callFirst(brl, [
    "remainingCap",
    "capLeft",
    "getRemainingCap",
  ]);

  const biggi = new Contract(tokenAddr, ABI_TOKEN, brl.provider);

  let totalSupply = null;
  let cap = null;
  let remainingMintable = null;
  let reserveAddr = null;
  let dexRecipientAddr = null;
  let tokenREWARDSAddr = null;
  let REWARDSOperator = null;
  let distributed = null;
  try {
    const [ts, _cap, rem, res, dex, rwd, oper, dist] = await Promise.all([
      biggi.totalSupply().catch(() => null),
      biggi.cap?.().catch?.(() => null),
      biggi.remainingMintable?.().catch?.(() => null),
      biggi.reserveAddr?.().catch?.(() => null),
      biggi.dexRecipientAddr?.().catch?.(() => null),
      biggi.tokenREWARDSAddr?.().catch?.(() => null),
      biggi.REWARDSOperator?.().catch?.(() => null),
      biggi.distributed?.().catch?.(() => null),
    ]);
    if (ts) totalSupply = formatEther(ts);
    if (_cap) cap = formatEther(_cap);
    if (rem) remainingMintable = formatEther(rem);
    reserveAddr = res || null;
    dexRecipientAddr = dex || null;
    tokenREWARDSAddr = rwd || null;
    REWARDSOperator = oper || null;
    distributed =
      typeof dist === "boolean" ? dist : dist != null ? !!dist : null;
  } catch {
    // ignore token meta failures
  }

  setBiggiData((prev) => ({
    ...prev,
    token: {
      address: tokenAddr,
      name: meta?.[0] ?? prev.token?.name,
      symbol: meta?.[1] ?? prev.token?.symbol,
      decimals: meta?.[2] ?? prev.token?.decimals,
      REWARDSRemainingCap:
        capLeft != null ? formatEther(capLeft) : "\u2014",
      totalSupply: totalSupply ?? "\u2014",
      cap: cap ?? null,
      remainingMintable: remainingMintable ?? null,
      reserveAddr,
      dexRecipientAddr,
      tokenREWARDSAddr,
      REWARDSOperator,
      distributed,
    },
  }));

  const reader = getBiggiTokenomicsReaderRO();
  const [core, dist, buy, res, DRIP, tr] = await getFullStatusSafe(reader);
  const fmt = (v) => (v != null ? formatEther(v) : null);
  const communitySnapshot = await fetchCOMMUNITYCENTERStats();

  setBiggiData((prev) => ({
    ...prev,
    token: {
      ...prev.token,
      address: core?.token || prev.token.address,
      pair: core?.pair || prev.token.pair,
      routerAddr: core?.router || prev.token.routerAddr,
      weth: core?.weth || prev.token.weth,
      token0Addr: core?.token0 || prev.token.token0Addr,
      token1Addr: core?.token1 || prev.token.token1Addr,
      reserveAddr: dist?.reserve || prev.token.reserveAddr || reserveAddr,
      treasuryAddr: dist?.treasury || prev.token.treasuryAddr,
      distributorAddr: dist?.distributor || prev.token.distributorAddr,
      COLLECTIONREWARDSAddr:
        dist?.COLLECTIONREWARDS || prev.token.COLLECTIONREWARDSAddr,
      COMMUNITYCENTERAddr:
        dist?.COMMUNITYCENTER || prev.token.COMMUNITYCENTERAddr,
      tokenREWARDSAddr:
        tr?.tokenREWARDS || prev.token.tokenREWARDSAddr || tokenREWARDSAddr,
    },
    router: {
      ...prev.router,
      routerAddress: core?.router || prev.router.routerAddress,
      wrappedNative: core?.weth || prev.router.wrappedNative,
    },
    liquidity: {
      ...prev.liquidity,
      pairAddress: core?.pair || prev.liquidity.pairAddress || prev.token.pair,
      token0: core?.token0 || prev.liquidity.token0,
      token1: core?.token1 || prev.liquidity.token1,
      reserveNative: fmt(core?.reserveNative) ?? prev.liquidity.reserveNative,
      reserveBiggi: fmt(core?.reserveBiggi) ?? prev.liquidity.reserveBiggi,
      lpTotalSupply: fmt(core?.lpTotalSupply) ?? prev.liquidity.lpTotalSupply,
      biggiPerNative:
        fmt(core?.biggiPerNative) ?? prev.liquidity.biggiPerNative,
      nativePerBiggi:
        fmt(core?.nativePerBiggi) ?? prev.liquidity.nativePerBiggi,
    },
    distributor: {
      ...prev.distributor,
      address: dist?.distributor || prev.distributor?.address,
      totalReceived:
        fmt(dist?.totalReceived) ?? prev.distributor?.totalReceived,
      pendingBUYBACK:
        fmt(dist?.pendingBUYBACK) ?? prev.distributor?.pendingBUYBACK,
      COLLECTIONREWARDS:
        dist?.COLLECTIONREWARDS || prev.distributor?.COLLECTIONREWARDS,
      reserve: dist?.reserve || prev.distributor?.reserve,
      BUYBACKAgent: dist?.BUYBACKAgent || prev.distributor?.BUYBACKAgent,
      treasury: dist?.treasury || prev.distributor?.treasury,
      COMMUNITYCENTER:
        dist?.COMMUNITYCENTER || prev.distributor?.COMMUNITYCENTER,
      pendingCommunity:
        communitySnapshot?.pendingCommunity ??
        prev.distributor?.pendingCommunity,
      communityPoolBalance:
        communitySnapshot?.communityPoolBalance ??
        prev.distributor?.communityPoolBalance,
    },
    BUYBACK: {
      ...prev.BUYBACK,
      BUYBACKAgent:
        buy?.BUYBACKAgent || dist?.BUYBACKAgent || prev.BUYBACK?.BUYBACKAgent,
      nativeBalance: fmt(buy?.nativeBalance) ?? prev.BUYBACK?.nativeBalance,
      biggiBalance: fmt(buy?.biggiBalance) ?? prev.BUYBACK?.biggiBalance,
      totalNativeReceived:
        fmt(buy?.totalNativeReceived) ?? prev.BUYBACK?.totalNativeReceived,
      totalNativeSpent:
        fmt(buy?.totalNativeSpent) ?? prev.BUYBACK?.totalNativeSpent,
      totalBiggiAcquired:
        fmt(buy?.totalBiggiAcquired) ?? prev.BUYBACK?.totalBiggiAcquired,
      autoBUYBACKEnabled:
        buy?.autoBUYBACKEnabled ?? prev.BUYBACK?.autoBUYBACKEnabled,
      paused: buy?.paused ?? prev.BUYBACK?.paused,
      lastBUYBACKAt: Number(
        buy?.lastBUYBACKAt || prev.BUYBACK?.lastBUYBACKAt || 0,
      ),
      router: buy?.router || core?.router || prev.router.routerAddress,
      wrappedNative:
        buy?.wrappedNative || core?.weth || prev.router.wrappedNative,
      treasury: buy?.treasury || dist?.treasury || prev.BUYBACK?.treasury,
    },
    reserve: {
      ...prev.reserve,
      reserveAddress:
        res?.reserve || prev.reserve?.reserveAddress || reserveAddr,
      maticBalance: fmt(res?.maticBalance) ?? prev.reserve?.maticBalance,
      waitingBiggi: fmt(res?.waitingBiggi) ?? prev.reserve?.waitingBiggi,
      dexRefillBiggi: fmt(res?.dexRefillBiggi) ?? prev.reserve?.dexRefillBiggi,
      biggiBalance: prev.reserve?.biggiBalance,
      liquidityManager: res?.liquidityManager || prev.reserve?.liquidityManager,
      keeperProxy: res?.keeper || prev.reserve?.keeperProxy,
      keeperAddress: res?.keeper || prev.reserve?.keeperAddress,
      liquidityVault: res?.liquidityVault || prev.reserve?.liquidityVault,
      lpBalanceInVault:
        fmt(res?.lpBalanceInVault) ?? prev.reserve?.lpBalanceInVault,
      pairWhitelisted: res?.pairWhitelisted ?? prev.reserve?.pairWhitelisted,
    },
    REWARDS: {
      ...prev.REWARDS,
      unitReward:
        tr?.unitReward != null ? fmt(tr.unitReward) : prev.REWARDS.unitReward,
      REWARDSCap:
        tr?.REWARDSCap != null ? fmt(tr.REWARDSCap) : prev.REWARDS.REWARDSCap,
      REWARDSMinted:
        tr?.REWARDSMinted != null
          ? fmt(tr.REWARDSMinted)
          : prev.REWARDS.REWARDSMinted,
      balance: tr?.balance != null ? fmt(tr.balance) : prev.REWARDS.balance,
      blockWeights: Array.isArray(tr?.blockWeights)
        ? Array.from(tr.blockWeights, (x) => Number(x))
        : prev.REWARDS.blockWeights,
      DRIPAvailable:
        DRIP?.availableTokens != null
          ? fmt(DRIP.availableTokens)
          : prev.REWARDS.DRIPAvailable,
      DRIPTotalClaimed:
        DRIP?.totalClaimed != null
          ? fmt(DRIP.totalClaimed)
          : prev.REWARDS.DRIPTotalClaimed,
      DRIPTotalNotified:
        DRIP?.totalNotified != null
          ? fmt(DRIP.totalNotified)
          : prev.REWARDS.DRIPTotalNotified,
      DRIPTokensPerMint:
        DRIP?.tokensPerMint != null
          ? fmt(DRIP.tokensPerMint)
          : prev.REWARDS.DRIPTokensPerMint,
      DRIPDistributor: DRIP?.DRIPDistributor || prev.REWARDS.DRIPDistributor,
      DRIPLm: DRIP?.DRIPLM || DRIP?.DRIPLm || prev.REWARDS.DRIPLm,
      DRIPTotalTopUp:
        DRIP?.totalTopUp != null
          ? fmt(DRIP.totalTopUp)
          : prev.REWARDS.DRIPTotalTopUp,
      tokenREWARDSToken: tr?.token || prev.REWARDS.tokenREWARDSToken,
    },
  }));
}






