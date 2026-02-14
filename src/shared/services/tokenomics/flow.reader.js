import { Contract } from "ethers";

import { getProvider } from "../../../web3/provider";
import { BiggiToken as ABI_BiggiToken } from "@/config/abi/index.js";
import { getAddresses } from "@/config/addresses/index.js";
import { ADDR } from "@/shared/utils/addresses.js";

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

/**
 * Flow overview snapshot.
 * - Shows the *intended* splits (static, per your tokenomics)
 * - Shows *current balances* of the key contracts (live)
 */
export async function fetchFlowSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const addrs = getAddresses(chainId);
  const resolved = {
    biggi:
      addrs?.biggi ||
      addrs?.BIGGI ||
      addrs?.BIGGI_TOKEN ||
      ADDR?.BIGGI ||
      ADDR?.BIGGI_TOKEN ||
      null,
    reserve: addrs?.reserve || addrs?.RESERVE || null,
    buyback: addrs?.BUYBACK || addrs?.BUYBACK_AGENT || null,
    treasury: addrs?.treasury || addrs?.TREASURY || null,
    communityCenter:
      addrs?.communityCenter ||
      addrs?.COMMUNITY_CENTER ||
      addrs?.COMMUNITYCENTER ||
      ADDR?.COMMUNITY_CENTER ||
      ADDR?.COMMUNITYCENTER ||
      null,
    collectionRewards:
      addrs?.collectionRewards ||
      addrs?.COLLECTION_REWARDS ||
      addrs?.COLLECTIONREWARDS ||
      ADDR?.COLLECTION_REWARDS ||
      null,
    tokenREWARDS:
      addrs?.tokenREWARDS ||
      addrs?.TOKEN_REWARDS ||
      ADDR?.TOKEN_REWARDS ||
      null,
    DRIPDistributor:
      addrs?.DRIPDistributor ||
      addrs?.DRIP_DISTRIBUTOR ||
      ADDR?.DRIP_DISTRIBUTOR ||
      null,
  };

  const token = resolved.biggi
    ? new Contract(resolved.biggi, ABI_BiggiToken, signerOrProvider)
    : null;

  const [
    reserveNative,
    buybackNative,
    treasuryNative,
    communityNative,
    collectionRewardsNative,
  ] = await Promise.all([
    _getBalance(signerOrProvider, resolved.reserve),
    _getBalance(signerOrProvider, resolved.buyback),
    _getBalance(signerOrProvider, resolved.treasury),
    _getBalance(signerOrProvider, resolved.communityCenter),
    _getBalance(signerOrProvider, resolved.collectionRewards),
  ]);

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
        _getTokenBalance(token, resolved.reserve),
        _getTokenBalance(token, resolved.DRIPDistributor),
        _getTokenBalance(token, resolved.tokenREWARDS),
        _getTokenBalance(token, resolved.treasury),
        _getTokenBalance(token, resolved.buyback),
        _callOptional(() => token.totalSupply(), null),
        _callOptional(() => token.remainingMintable?.(), null),
        _callOptional(() => token.name?.(), null),
        _callOptional(() => token.symbol?.(), null),
        _callOptional(() => token.decimals?.(), 18),
      ])
    : [null, null, null, null, null, null, null, null, null, 18];

  const ts = Date.now();

  return {
    ts,
    tsLabel: new Date(ts).toLocaleString(),
    intendedSplits: {
      // Based on your canonical Distributor split (60% bucket)
      nativeFromMint: {
        collectionRewardsBps: 3000,
        reserveBps: 3000,
        buybackBps: 2000,
        communityCenterBps: 1000,
        treasuryBps: 1000,
        devBps: 4000,
      },
      // Based on your canonical BIGGI initial distribution (600M/200M/200M)
      tokenInitial: {
        reservePct: 60,
        tokenRewardsPct: 20,
        dripDistributorPct: 20,
      },
    },
    liveBalances: {
      native: {
        reserve: reserveNative,
        buyback: buybackNative,
        treasury: treasuryNative,
        communityCenter: communityNative,
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
    },
  };
}
