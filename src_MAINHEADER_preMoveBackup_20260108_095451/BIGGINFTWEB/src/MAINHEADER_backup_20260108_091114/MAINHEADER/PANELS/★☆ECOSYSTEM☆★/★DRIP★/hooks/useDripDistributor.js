import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { createDRIPDistributorService } from "../services/factories";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení dat z DRIPDistributor kontraktu.
 */
export default function useDRIPDistributor() {
  const [data, setData] = React.useState({
    address: null,
    cap: "0",
    capRemaining: "0",
    availableTokens: "0",
    tokensPerMint: "0",
    totalClaimed: "0",
    totalNotified: "0",
    totalTopUp: "0",
    DRIPLM: null,
    treasury: null,
    paused: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const svc = createDRIPDistributorService();
      const cacheKey = `DRIPDistributor:${svc.address || "unknown"}`;
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
          return {
            address: svc.address,
            cap: fmt(raw.CAP),
            capRemaining: fmt(raw.capRemaining),
            availableTokens: fmt(raw.availableTokens ?? raw.getAvailable),
            tokensPerMint: fmt(raw.tokensPerMint),
            totalClaimed: fmt(raw.totalClaimed ?? raw.getTotalClaimed),
            totalNotified: fmt(raw.totalNotified ?? raw.getTotalNotified),
            totalTopUp: fmt(raw.totalTopUp ?? raw.getTotalTopUp),
            DRIPLM: raw.DRIPLM || null,
            treasury: raw.treasury || null,
            paused: Boolean(raw.paused),
          };
        },
        { force: options?.force === true },
      );
      setData(snapshot);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh };
}


