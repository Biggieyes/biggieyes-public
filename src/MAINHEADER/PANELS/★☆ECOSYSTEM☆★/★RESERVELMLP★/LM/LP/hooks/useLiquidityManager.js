// src/hooks/useLiquidityManager.js
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
      // ...existing code...
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh };
}

