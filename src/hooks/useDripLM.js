import * as React from "react";
import { createDripLMService } from "../services/factories";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro Drip Liquidity Manager (prodeje do buybacku / drip distribuci).
 */
export default function useDripLM() {
  const [data, setData] = React.useState({
    address: null,
    biggiToken: null,
    buybackAgent: null,
    dripDistributor: null,
    reserve: null,
    router: null,
    sellPct: null,
    slippageBps: null,
    txDeadlineSec: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const svc = createDripLMService();
      const cacheKey = `dripLM:${svc.address || "unknown"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const raw = await svc.getAllStats();
          return {
            address: svc.address,
            biggiToken: raw.BIGGI || null,
            buybackAgent: raw.buybackAgent || null,
            dripDistributor: raw.dripDistributor || null,
            reserve: raw.reserve || null,
            router: raw.router || null,
            sellPct: raw.sellPct?.toString?.() ?? raw.sellPct ?? null,
            slippageBps:
              raw.slippageBps?.toString?.() ?? raw.slippageBps ?? null,
            txDeadlineSec:
              raw.txDeadlineSec?.toString?.() ?? raw.txDeadlineSec ?? null,
          };
        },
        { force: options?.force === true },
      );
      setData(snapshot);
    } catch (e) {
      console.error("useDripLM.refresh", e);
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

