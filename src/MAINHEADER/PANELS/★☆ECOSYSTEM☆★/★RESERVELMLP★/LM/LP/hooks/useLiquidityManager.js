// src/HOOKS/useLiquidityManager.js
import * as React from "react";
import { getLMRawRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

function toNumber(value) {
  if (value == null) return 0;
  try {
    return Number(value?.toString?.() ?? value);
  } catch {
    return 0;
  }
}

export default function useLiquidityManager() {
  const [data, setData] = React.useState({
    address: null,
    biggiToken: null,
    factory: null,
    router: null,
    reserve: null,
    liquidityVault: null,
    keeper: null,
    slippageBps: 0,
    tokenPct: 0,
    txDeadlineSec: 0,
    owner: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getLMRawRO();
      if (!contract) throw new Error("LiquidityManager contract not found");
      const cacheKey = `liquidityManager:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const safeCall = async (name, args = [], fallback = null) => {
            try {
              const fn = contract?.[name];
              if (typeof fn !== "function") return fallback;
              const res = await fn(...args);
              return res ?? fallback;
            } catch {
              return fallback;
            }
          };

          const [
            biggiToken,
            factory,
            router,
            reserve,
            liquidityVault,
            keeper,
            slippageBps,
            tokenPct,
            txDeadlineSec,
            owner,
          ] = await Promise.all([
            safeCall("BIGGI", [], null),
            safeCall("factory", [], null),
            safeCall("router", [], null),
            safeCall("reserve", [], null),
            safeCall("liquidityVault", [], null),
            safeCall("keeper", [], null),
            safeCall("slippageBps", [], 0),
            safeCall("tokenPct", [], 0),
            safeCall("txDeadlineSec", [], 0),
            safeCall("owner", [], null),
          ]);

          return {
            address: contract.address,
            biggiToken: biggiToken || null,
            factory: factory || null,
            router: router || null,
            reserve: reserve || null,
            liquidityVault: liquidityVault || null,
            keeper: keeper || null,
            slippageBps: toNumber(slippageBps),
            tokenPct: toNumber(tokenPct),
            txDeadlineSec: toNumber(txDeadlineSec),
            owner: owner || null,
          };
        },
        { force: options?.force === true },
      );

      setData(snapshot);
    } catch (e) {
      console.error("useLiquidityManager.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}


