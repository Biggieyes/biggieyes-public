import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchTokenDexSnapshot } from "@/shared/services/tokenomics/tokenDex.reader";
import usePollingSnapshot from "./_usePollingSnapshot";
import { toNumberSafe } from "./_utils";

const formatTsLabel = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const resolvePriceFeedReserves = (priceFeed) => {
  const reserves = priceFeed?.reserves || null;
  if (!reserves) return null;
  const ok = reserves.ok ?? reserves[0];
  if (ok === false) return null;
  const reserveBiggi = reserves.reserveBiggi ?? reserves[1] ?? null;
  const reserveWeth = reserves.reserveWeth ?? reserves[2] ?? null;
  const blockTimestampLast =
    reserves.blockTimestampLast ?? reserves[3] ?? null;
  return {
    tokenReserve: reserveBiggi,
    nativeReserve: reserveWeth,
    reserve0: reserveBiggi,
    reserve1: reserveWeth,
    blockTimestampLast,
  };
};

const resolvePairReserves = (pair, tokenAddress, wethAddress) => {
  const reserves = pair?.reserves || {};
  const reserve0 = reserves.reserve0 ?? null;
  const reserve1 = reserves.reserve1 ?? null;
  const token0 = pair?.token0?.toLowerCase?.();
  const token1 = pair?.token1?.toLowerCase?.();
  const tokenAddr = tokenAddress?.toLowerCase?.();
  const wethAddr = wethAddress?.toLowerCase?.();

  let tokenReserve = null;
  let nativeReserve = null;

  if (tokenAddr && token0 === tokenAddr) tokenReserve = reserve0;
  if (tokenAddr && token1 === tokenAddr) tokenReserve = reserve1;
  if (wethAddr && token0 === wethAddr) nativeReserve = reserve0;
  if (wethAddr && token1 === wethAddr) nativeReserve = reserve1;

  if (tokenReserve == null || nativeReserve == null) {
    tokenReserve = tokenReserve ?? reserve0;
    nativeReserve = nativeReserve ?? reserve1;
  }

  return {
    tokenReserve,
    nativeReserve,
    reserve0,
    reserve1,
    blockTimestampLast: reserves.blockTimestampLast ?? null,
  };
};

export default function useTokenDexSnapshot(options = {}) {
  const { intervalMs = 20000 } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(async () => {
    const raw = await fetchTokenDexSnapshot({
      chainId,
      provider: readProvider,
    });
    if (!raw) return null;

    const tokenDecimals = Number(raw?.token?.decimals ?? 18);
    const pair = raw?.dex?.pair || null;
    const resolvedPair = resolvePairReserves(
      pair,
      raw?.token?.address,
      raw?.dex?.weth,
    );
    const priceFeedReserves = resolvePriceFeedReserves(raw?.dex?.priceFeed);
    const reserves =
      resolvedPair?.tokenReserve == null || resolvedPair?.nativeReserve == null
        ? priceFeedReserves || resolvedPair
        : resolvedPair;

    const nativeNum = toNumberSafe(reserves.nativeReserve, 18);
    const tokenNum = toNumberSafe(reserves.tokenReserve, tokenDecimals);
    const routerNativeOut = toNumberSafe(
      raw?.dex?.routerNativeOut ?? raw?.dex?.routerAmountsOut?.[1],
      18,
    );
    const priceNativePerToken =
      nativeNum != null && tokenNum != null && tokenNum > 0
        ? nativeNum / tokenNum
        : routerNativeOut ?? null;
    const priceTokenPerNative =
      nativeNum != null && nativeNum > 0 && tokenNum != null
        ? tokenNum / nativeNum
        : null;

    const ts = raw.ts ?? Date.now();
    const tsLabel = raw.tsLabel ?? formatTsLabel(ts);

    const routerAddress = raw?.dex?.router ?? null;
    return {
      ...raw,
      ts,
      tsLabel,
      token: {
        ...raw.token,
        decimals: tokenDecimals,
      },
      dex: {
        ...raw.dex,
        routerAddress,
        router: {
          routerAddress,
          factory: raw?.dex?.routerFactory ?? null,
          wrappedNative: raw?.dex?.weth ?? null,
        },
        pair: pair
          ? {
              address: pair.address ?? raw?.dex?.pairAddress ?? null,
              token0: pair.token0 ?? null,
              token1: pair.token1 ?? null,
              reserves: {
                native: reserves.nativeReserve,
                token: reserves.tokenReserve,
                reserve0: reserves.reserve0,
                reserve1: reserves.reserve1,
                blockTimestampLast: reserves.blockTimestampLast,
              },
              lpTotalSupply: pair.totalSupply ?? null,
            }
          : null,
      },
      derived: {
        priceNativePerToken,
        priceTokenPerNative,
      },
    };
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs });
}
