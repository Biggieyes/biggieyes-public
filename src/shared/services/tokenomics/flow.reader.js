import { Contract } from "ethers";

import { getProvider } from "../../../web3/provider";
import { BiggiToken as ABI_BiggiToken } from "@/config/abi/index.js";
import { getAddresses } from "@/config/addresses/index.js";
import {
  BPS_DENOM,
  DEV_BPS,
  DISTRIBUTOR_BPS,
  DIST_BUYBACK_BPS,
  DIST_COLLECTION_BPS,
  DIST_COMMUNITY_BPS,
  DIST_RESERVE_BPS,
  DIST_TREASURY_BPS,
} from "@/shared/bps.js";
import { ADDR } from "@/shared/utils/addresses.js";
import { getBiggiTokenomicsReaderRO } from "@/shared/utils/contract";
import {
  getFullStatusSafe,
  normalizeTokenomicsFullStatus,
} from "@/shared/utils/tokenomicsFullStatus.js";
import { multicallReadContract } from "@/shared/utils/multicall.js";

const DISTRIBUTOR_VIEW_ABI = [
  "function pendingOf(address) view returns (uint256)",
];

const BUYBACK_VIEW_ABI = [
  "function totalNativeReceived() view returns (uint256)",
];

const COMMUNITY_VIEW_ABI = [
  "function poolBalance() view returns (uint256)",
];

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function _getBalance(provider, addr) {
  if (!provider || !addr) return null;
  try {
    return await provider.getBalance(addr);
  } catch {
    return null;
  }
}

async function _getTokenBalance(token, addr) {
  if (!token || !addr) return null;
  return _callOptional(() => token.balanceOf(addr), null);
}

function _toBigInt(value) {
  if (value == null) return null;
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    try {
      return BigInt(value?.toString?.());
    } catch {
      return null;
    }
  }
}

function _sumBigNumberish(...values) {
  let total = 0n;
  let hasAny = false;
  for (const value of values) {
    const normalized = _toBigInt(value);
    if (normalized == null) continue;
    total += normalized;
    hasAny = true;
  }
  return hasAny ? total : null;
}

function _getReadProvider(signerOrProvider) {
  return (
    signerOrProvider?.provider ||
    signerOrProvider?.runner?.provider ||
    signerOrProvider?.runner ||
    signerOrProvider
  );
}

async function _multicallOptional(provider, contract, entries, label) {
  try {
    return await multicallReadContract(provider, contract, entries);
  } catch (error) {
    console.warn(`Flow snapshot ${label} multicall failed`, error);
    return null;
  }
}

async function _getFullStatus(provider) {
  try {
    const reader = getBiggiTokenomicsReaderRO(provider);
    if (!reader) return null;
    const decoded = await getFullStatusSafe(reader);
    return normalizeTokenomicsFullStatus(decoded);
  } catch {
    return null;
  }
}

/**
 * Flow overview snapshot.
 * - Uses tokenomics reader addresses/status when available
 * - Falls back to canonical contract constants for BPS splits
 * - Shows current live balances of the key contracts
 */
export async function fetchFlowSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const readProvider = _getReadProvider(signerOrProvider);
  const addrs = getAddresses(chainId);
  const fullStatus = await _getFullStatus(signerOrProvider);
  const core = fullStatus?.core || null;
  const dist = fullStatus?.dist || null;
  const buy = fullStatus?.buy || null;
  const res = fullStatus?.res || null;
  const drip = fullStatus?.drip || null;
  const tr = fullStatus?.tr || null;

  const resolved = {
    biggi:
      core?.token ||
      addrs?.biggi ||
      addrs?.BIGGI ||
      addrs?.BIGGI_TOKEN ||
      ADDR?.BIGGI ||
      ADDR?.BIGGI_TOKEN ||
      null,
    distributor:
      dist?.distributor ||
      addrs?.distributor ||
      addrs?.MULTI_COLLECTION_DISTRIBUTOR ||
      addrs?.DISTRIBUTOR ||
      ADDR?.MULTI_COLLECTION_DISTRIBUTOR ||
      ADDR?.DISTRIBUTOR ||
      null,
    reserve:
      dist?.reserve ||
      res?.reserve ||
      addrs?.reserve ||
      addrs?.RESERVE ||
      ADDR?.RESERVE ||
      null,
    buyback:
      dist?.buybackAgent ||
      buy?.buybackAgent ||
      addrs?.buyback ||
      addrs?.BUYBACK ||
      addrs?.BUYBACK_AGENT ||
      ADDR?.BUYBACK_AGENT ||
      null,
    treasury:
      dist?.treasury ||
      buy?.treasury ||
      addrs?.treasury ||
      addrs?.TREASURY ||
      ADDR?.TREASURY ||
      null,
    communityCenter:
      dist?.communityCenter ||
      addrs?.communityCenter ||
      addrs?.COMMUNITY_CENTER ||
      addrs?.COMMUNITYCENTER ||
      ADDR?.COMMUNITY_CENTER ||
      ADDR?.COMMUNITYCENTER ||
      null,
    collectionRewards:
      dist?.collectionRewards ||
      addrs?.collectionRewards ||
      addrs?.COLLECTION_REWARDS ||
      addrs?.COLLECTIONREWARDS ||
      ADDR?.COLLECTION_REWARDS ||
      null,
    tokenREWARDS:
      tr?.tokenRewards ||
      addrs?.tokenREWARDS ||
      addrs?.TOKEN_REWARDS ||
      ADDR?.TOKEN_REWARDS ||
      null,
    DRIPDistributor:
      drip?.dripDistributor ||
      addrs?.DRIPDistributor ||
      addrs?.DRIP_DISTRIBUTOR ||
      ADDR?.DRIP_DISTRIBUTOR ||
      null,
  };

  const token = resolved.biggi
    ? new Contract(resolved.biggi, ABI_BiggiToken, signerOrProvider)
    : null;
  const distributorView = resolved.distributor
    ? new Contract(resolved.distributor, DISTRIBUTOR_VIEW_ABI, signerOrProvider)
    : null;
  const buybackView = resolved.buyback
    ? new Contract(resolved.buyback, BUYBACK_VIEW_ABI, signerOrProvider)
    : null;
  const communityView = resolved.communityCenter
    ? new Contract(resolved.communityCenter, COMMUNITY_VIEW_ABI, signerOrProvider)
    : null;

  const tokenMulticall = token
    ? await _multicallOptional(
        readProvider,
        token,
        [
          resolved.reserve
            ? {
                key: "reserveBiggi",
                method: "balanceOf",
                params: [resolved.reserve],
              }
            : null,
          resolved.DRIPDistributor
            ? {
                key: "dripDistributorBiggi",
                method: "balanceOf",
                params: [resolved.DRIPDistributor],
              }
            : null,
          resolved.tokenREWARDS
            ? {
                key: "tokenRewardsBiggi",
                method: "balanceOf",
                params: [resolved.tokenREWARDS],
              }
            : null,
          resolved.treasury
            ? {
                key: "treasuryBiggi",
                method: "balanceOf",
                params: [resolved.treasury],
              }
            : null,
          resolved.buyback
            ? {
                key: "buybackBiggi",
                method: "balanceOf",
                params: [resolved.buyback],
              }
            : null,
          { key: "totalSupply", method: "totalSupply" },
          { key: "remainingMintable", method: "remainingMintable" },
          { key: "name", method: "name" },
          { key: "symbol", method: "symbol" },
          { key: "decimals", method: "decimals" },
        ].filter(Boolean),
        "token",
      )
    : null;

  const [
    reserveNative,
    buybackNative,
    buybackTotalNativeReceived,
    treasuryNative,
    communityNative,
    communityPending,
    communityPoolBalance,
    collectionRewardsNative,
  ] = await Promise.all([
    res?.polBalance ?? _getBalance(signerOrProvider, resolved.reserve),
    buy?.nativeBalance ?? _getBalance(signerOrProvider, resolved.buyback),
    buy?.totalNativeReceived ??
      _callOptional(() => buybackView?.totalNativeReceived?.(), null),
    _getBalance(signerOrProvider, resolved.treasury),
    _getBalance(signerOrProvider, resolved.communityCenter),
    resolved.communityCenter
      ? _callOptional(
          () => distributorView?.pendingOf?.(resolved.communityCenter),
          null,
        )
      : null,
    _callOptional(() => communityView?.poolBalance?.(), null),
    _getBalance(signerOrProvider, resolved.collectionRewards),
  ]);

  const communityEffective = _sumBigNumberish(
    communityNative,
    communityPending,
  );

  const [
    reserveBiggi,
    dripDistributorBiggi,
    tokenRewardsBiggi,
    treasuryBiggi,
    buybackBiggi,
    totalSupply,
    remainingMintable,
    name,
    symbol,
    decimals,
  ] = token
    ? await Promise.all([
        tokenMulticall?.reserveBiggi ?? _getTokenBalance(token, resolved.reserve),
        tokenMulticall?.dripDistributorBiggi ??
          _getTokenBalance(token, resolved.DRIPDistributor),
        tokenMulticall?.tokenRewardsBiggi ??
          _getTokenBalance(token, resolved.tokenREWARDS),
        tokenMulticall?.treasuryBiggi ??
          _getTokenBalance(token, resolved.treasury),
        tokenMulticall?.buybackBiggi ?? _getTokenBalance(token, resolved.buyback),
        tokenMulticall?.totalSupply ?? _callOptional(() => token.totalSupply(), null),
        tokenMulticall?.remainingMintable ??
          _callOptional(() => token.remainingMintable?.(), null),
        tokenMulticall?.name ?? _callOptional(() => token.name?.(), null),
        tokenMulticall?.symbol ?? _callOptional(() => token.symbol?.(), null),
        tokenMulticall?.decimals ?? _callOptional(() => token.decimals?.(), 18),
      ])
    : [null, null, null, null, null, null, null, null, null, 18];

  const ts = Date.now();

  return {
    ts,
    tsLabel: new Date(ts).toLocaleString(),
    readerStatus: fullStatus,
    splitConfig: {
      source: "Canonical Biggi BPS constants",
      bpsDenom: BPS_DENOM,
    },
    intendedSplits: {
      mintEntry: {
        devBps: DEV_BPS,
        distributorBps: DISTRIBUTOR_BPS,
      },
      nativeFromMint: {
        collectionRewardsBps: DIST_COLLECTION_BPS,
        reserveBps: DIST_RESERVE_BPS,
        buybackBps: DIST_BUYBACK_BPS,
        communityCenterBps: DIST_COMMUNITY_BPS,
        treasuryBps: DIST_TREASURY_BPS,
      },
    },
    liveBalances: {
      native: {
        reserve: reserveNative,
        buyback: buybackNative,
        buybackTotalReceived: buybackTotalNativeReceived,
        treasury: treasuryNative,
        communityCenter: communityNative,
        communityPending,
        communityPoolBalance,
        communityEffective,
        collectionRewards: collectionRewardsNative,
      },
      token: {
        reserve: reserveBiggi,
        dripDistributor: dripDistributorBiggi,
        tokenRewards: tokenRewardsBiggi,
        treasury: treasuryBiggi,
        buyback: buybackBiggi,
      },
    },
    tokenMeta: {
      address: resolved.biggi,
      name,
      symbol,
      decimals,
      totalSupply,
      remainingMintable,
    },
    addresses: {
      ...addrs,
      ...resolved,
      BUYBACK: resolved.buyback,
      DISTRIBUTOR: resolved.distributor,
      DRIP_DISTRIBUTOR: resolved.DRIPDistributor,
    },
  };
}
