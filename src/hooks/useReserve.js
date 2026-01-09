import * as React from "react";
import { formatEther } from "ethers/lib.esm/utils.js";
import { getReserveRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení dat z Reserve kontraktu (rezervní fond, POL + BIGGI zůstatky).
 * Využívá read-only provider, bez nutnosti podpisu.
 */
export default function useReserve() {
  const [data, setData] = React.useState({
    address: null,
    liquidityManager: null,
    totalMaticReceived: "0",
    waitingBiggi: "0",
    dexRefillBiggi: "0",
    biggiBalance: "0",
    maticBalance: "0",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchReserveInfo = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getReserveRO();
      if (!contract) throw new Error("Reserve contract not found");
      const cacheKey = `reserve:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const fmt = (v) => {
            try {
              return formatEther(v);
            } catch {
              return "0";
            }
          };

          const [
            liquidityManager,
            totalMaticReceived,
            waitingBiggi,
            dexRefillBiggi,
            biggiBalance,
            maticBalance,
          ] = await Promise.all([
            contract.liquidityManager?.().catch(() => null),
            contract.totalMaticReceived?.().catch(() => 0n),
            contract.waitingBiggi?.().catch(() => 0n),
            contract.dexRefillBiggi?.().catch(() => 0n),
            contract.biggiBalance?.().catch(() => 0n),
            contract.maticBalance?.().catch(() => 0n),
          ]);

          return {
            address: contract.address,
            liquidityManager: liquidityManager || "",
            totalMaticReceived: fmt(totalMaticReceived),
            waitingBiggi: fmt(waitingBiggi),
            dexRefillBiggi: fmt(dexRefillBiggi),
            biggiBalance: fmt(biggiBalance),
            maticBalance: fmt(maticBalance),
          };
        },
        { force: options?.force === true },
      );

      setData(snapshot);
    } catch (e) {
      console.error("useReserve.fetchReserveInfo", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReserveInfo();
  }, [fetchReserveInfo]);

  return { data, loading, error, refresh: fetchReserveInfo };
}
