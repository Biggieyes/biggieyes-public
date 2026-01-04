import * as React from "react";
import { ethers } from "ethers";
import { createDripDistributorService } from "../services/factories";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení dat z DripDistributor kontraktu.
 */
export default function useDripDistributor() {
  const [data, setData] = React.useState({
    address: null,
    cap: "0",
    capRemaining: "0",
    availableTokens: "0",
    tokensPerMint: "0",
    totalClaimed: "0",
    totalNotified: "0",
    totalTopUp: "0",
    dripLM: null,
    treasury: null,
    paused: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const svc = createDripDistributorService();
      const cacheKey = `dripDistributor:${svc.address || "unknown"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const raw = await svc.getAllStats();
          const fmt = (bn) => {
            try { return ethers.utils.formatUnits(bn || 0, 18); } catch { return "0"; }
          };

          return {
            address: svc.address,
            cap: fmt(raw.CAP),
            capRemaining: fmt(raw.capRemaining),
            availableTokens: fmt(raw.availableTokens ?? raw.getAvailable),
            tokensPerMint: fmt(raw.tokensPerMint),
            totalClaimed: fmt(raw.totalClaimed ?? raw.getTotalClaimed),
            totalNotified: fmt(raw.totalNotified ?? raw.getTotalNotified),
            totalTopUp: fmt(raw.totalTopUp ?? raw.getTotalTopUp),
            dripLM: raw.dripLM || null,
            treasury: raw.treasury || null,
            paused: Boolean(raw.paused),
          };
        },
        { force: options?.force === true }
      );
      setData(snapshot);
    } catch (e) {
      console.error("useDripDistributor.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
