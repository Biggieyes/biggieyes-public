import * as React from "react";
import { createDRIPLMService } from "../../../../services/factories";
import { getCached } from "../../../../utils/fetchCache";

/**
 * Hook pro DRIP Liquidity Manager (prodeje do BUYBACKu / DRIP distribuci).
 */
export default function useDRIPLM() {
  const [data, setData] = React.useState({
    address: null,
    biggiToken: null,
    BUYBACKAgent: null,
    DRIPDistributor: null,
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
      const svc = createDRIPLMService();
      const cacheKey = `DRIPLM:${svc.address || "unknown"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const raw = await svc.getAllStats();
          return {
            address: svc.address,
            biggiToken: raw.BIGGI || null,
            BUYBACKAgent: raw.BUYBACKAgent || null,
            DRIPDistributor: raw.DRIPDistributor || null,
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
      console.error("useDRIPLM.refresh", e);
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



