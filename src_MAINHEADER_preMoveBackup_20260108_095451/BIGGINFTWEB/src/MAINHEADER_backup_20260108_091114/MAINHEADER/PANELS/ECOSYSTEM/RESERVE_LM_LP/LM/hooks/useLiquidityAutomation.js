// src/HOOKS/useLiquidityAutomation.js
import * as React from "react";
import { getLiquidityAutomationRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

function toNumber(value) {
  if (value == null) return 0;
  try {
    return Number(value?.toString?.() ?? value);
  } catch {
    return 0;
  }
}

export default function useLiquidityAutomation() {
  const [data, setData] = React.useState({
    address: null,
    reserve: null,
    router: null,
    tokenPct: 0,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getLiquidityAutomationRO();
      if (!contract) throw new Error("LiquidityAutomation contract not found");
      const cacheKey = `liquidityAutomation:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const [reserve, router, tokenPct] = await Promise.all([
            contract.reserve?.().catch(() => null),
            contract.router?.().catch(() => null),
            contract.tokenPct?.().catch(() => 0),
          ]);

          return {
            address: contract.address,
            reserve: reserve || null,
            router: router || null,
            tokenPct: toNumber(tokenPct),
          };
        },
        { force: options?.force === true },
      );

      setData(snapshot);
    } catch (e) {
      console.error("useLiquidityAutomation.refresh", e);
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


