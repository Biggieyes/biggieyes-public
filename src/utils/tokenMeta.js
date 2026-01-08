import { Contract } from "@ethersproject/contracts";
import { keccak256, arrayify, hexlify, isAddress } from "ethers";
import { BiggiToken as ABI_TOKEN } from "../config/abi/index.js";
import { ADDR } from "./addresses";
import { getFullStatusSafe } from "./tokenomicsFullStatus.js";

export async function refreshTokenMeta({
  getReadOnlyLiquidityContract,
  callFirst,
  getBiggiTokenomicsReaderRO,
  fetchCommunityCenterStats,
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
  let tokenRewardsAddr = null;
  let rewardsOperator = null;
  let distributed = null;
  try {
    const [ts, _cap, rem, res, dex, rwd, oper, dist] = await Promise.all([
      biggi.totalSupply().catch(() => null),
      biggi.cap?.().catch?.(() => null),
      biggi.remainingMintable?.().catch?.(() => null),
      biggi.reserveAddr?.().catch?.(() => null),
      biggi.dexRecipientAddr?.().catch?.(() => null),
      biggi.tokenRewardsAddr?.().catch?.(() => null),
      biggi.rewardsOperator?.().catch?.(() => null),
      biggi.distributed?.().catch?.(() => null),
    ]);
    if (ts) totalSupply = formatEther(ts);
    if (_cap) cap = formatEther(_cap);
    if (rem) remainingMintable = formatEther(rem);
    reserveAddr = res || null;
    dexRecipientAddr = dex || null;
    tokenRewardsAddr = rwd || null;
    rewardsOperator = oper || null;
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
      rewardsRemainingCap:
        capLeft != null ? formatEther(capLeft) : "\u2014",
      totalSupply: totalSupply ?? "\u2014",
      cap: cap ?? null,
      remainingMintable: remainingMintable ?? null,
      reserveAddr,
      dexRecipientAddr,
      tokenRewardsAddr,
      rewardsOperator,
      distributed,
    },
  }));

  const reader = getBiggiTokenomicsReaderRO();
  const [core, dist, buy, res, drip, tr] = await getFullStatusSafe(reader);
  const fmt = (v) => (v != null ? formatEther(v) : null);
  const communitySnapshot = await fetchCommunityCenterStats();

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
      collectionRewardsAddr:
        dist?.collectionRewards || prev.token.collectionRewardsAddr,
      communityCenterAddr:
        dist?.communityCenter || prev.token.communityCenterAddr,
      tokenRewardsAddr:
        tr?.tokenRewards || prev.token.tokenRewardsAddr || tokenRewardsAddr,
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
      pendingBuyback:
        fmt(dist?.pendingBuyback) ?? prev.distributor?.pendingBuyback,
      collectionRewards:
        dist?.collectionRewards || prev.distributor?.collectionRewards,
      reserve: dist?.reserve || prev.distributor?.reserve,
      buybackAgent: dist?.buybackAgent || prev.distributor?.buybackAgent,
      treasury: dist?.treasury || prev.distributor?.treasury,
      communityCenter:
        dist?.communityCenter || prev.distributor?.communityCenter,
      pendingCommunity:
        communitySnapshot?.pendingCommunity ??
        prev.distributor?.pendingCommunity,
      communityPoolBalance:
        communitySnapshot?.communityPoolBalance ??
        prev.distributor?.communityPoolBalance,
    },
    buyback: {
      ...prev.buyback,
      buybackAgent:
        buy?.buybackAgent || dist?.buybackAgent || prev.buyback?.buybackAgent,
      nativeBalance: fmt(buy?.nativeBalance) ?? prev.buyback?.nativeBalance,
      biggiBalance: fmt(buy?.biggiBalance) ?? prev.buyback?.biggiBalance,
      totalNativeReceived:
        fmt(buy?.totalNativeReceived) ?? prev.buyback?.totalNativeReceived,
      totalNativeSpent:
        fmt(buy?.totalNativeSpent) ?? prev.buyback?.totalNativeSpent,
      totalBiggiAcquired:
        fmt(buy?.totalBiggiAcquired) ?? prev.buyback?.totalBiggiAcquired,
      autoBuybackEnabled:
        buy?.autoBuybackEnabled ?? prev.buyback?.autoBuybackEnabled,
      paused: buy?.paused ?? prev.buyback?.paused,
      lastBuybackAt: Number(
        buy?.lastBuybackAt || prev.buyback?.lastBuybackAt || 0,
      ),
      router: buy?.router || core?.router || prev.router.routerAddress,
      wrappedNative:
        buy?.wrappedNative || core?.weth || prev.router.wrappedNative,
      treasury: buy?.treasury || dist?.treasury || prev.buyback?.treasury,
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
    rewards: {
      ...prev.rewards,
      unitReward:
        tr?.unitReward != null ? fmt(tr.unitReward) : prev.rewards.unitReward,
      rewardsCap:
        tr?.rewardsCap != null ? fmt(tr.rewardsCap) : prev.rewards.rewardsCap,
      rewardsMinted:
        tr?.rewardsMinted != null
          ? fmt(tr.rewardsMinted)
          : prev.rewards.rewardsMinted,
      balance: tr?.balance != null ? fmt(tr.balance) : prev.rewards.balance,
      blockWeights: Array.isArray(tr?.blockWeights)
        ? Array.from(tr.blockWeights, (x) => Number(x))
        : prev.rewards.blockWeights,
      dripAvailable:
        drip?.availableTokens != null
          ? fmt(drip.availableTokens)
          : prev.rewards.dripAvailable,
      dripTotalClaimed:
        drip?.totalClaimed != null
          ? fmt(drip.totalClaimed)
          : prev.rewards.dripTotalClaimed,
      dripTotalNotified:
        drip?.totalNotified != null
          ? fmt(drip.totalNotified)
          : prev.rewards.dripTotalNotified,
      dripTokensPerMint:
        drip?.tokensPerMint != null
          ? fmt(drip.tokensPerMint)
          : prev.rewards.dripTokensPerMint,
      dripDistributor: drip?.dripDistributor || prev.rewards.dripDistributor,
      dripLm: drip?.dripLM || drip?.dripLm || prev.rewards.dripLm,
      dripTotalTopUp:
        drip?.totalTopUp != null
          ? fmt(drip.totalTopUp)
          : prev.rewards.dripTotalTopUp,
      tokenRewardsToken: tr?.token || prev.rewards.tokenRewardsToken,
    },
  }));
}

