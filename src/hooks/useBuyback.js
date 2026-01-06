import * as React from "react";
import { ethers } from "ethers";
import { createBuybackService } from "../services/factories";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení dat z Buyback Agentu (native+BIGGI zůstatky, statistiky nákupů, stav pause).
 */
export default function useBuyback() {
  const [data, setData] = React.useState({
    address: null,
    biggiBalance: "0",
    nativeBalance: "0",
    totalNativeReceived: "0",
    totalNativeSpent: "0",
    totalBiggiAcquired: "0",
    autoBuybackEnabled: false,
    paused: false,
    lastBuybackAt: null,
    policy: null,
    treasury: null,
    dripLM: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const svc = createBuybackService();
      const cacheKey = `buyback:${svc.address || "unknown"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const raw = await svc.getAllStats();
          const fmt = (bn) => {
            try {
              return ethers.utils.formatUnits(bn || 0, 18);
            } catch {
              return "0";
            }
          };
          const toTs = (bn) => {
            try {
              const n = Number(bn?.toString?.() || bn || 0);
              return Number.isFinite(n) && n > 0 ? n : null;
            } catch {
              return null;
            }
          };

          return {
            address: svc.address,
            biggiBalance: fmt(raw.biggiBalance),
            nativeBalance: fmt(raw.nativeBalance),
            totalNativeReceived: fmt(raw.totalNativeReceived),
            totalNativeSpent: fmt(raw.totalNativeSpent),
            totalBiggiAcquired: fmt(raw.totalBiggiAcquired),
            autoBuybackEnabled: Boolean(raw.autoBuybackEnabled),
            paused: Boolean(raw.paused),
            lastBuybackAt: toTs(raw.lastBuybackAt),
            policy: raw.policy || null,
            treasury: raw.treasury || null,
            dripLM: raw.dripLM || null,
          };
        },
        { force: options?.force === true },
      );
      setData(snapshot);
    } catch (e) {
      console.error("useBuyback.refresh", e);
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
