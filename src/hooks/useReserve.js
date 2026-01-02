import * as React from "react";
import { ethers } from "ethers";
import { getReserveRO } from "../utils/contract";

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

  const fetchReserveInfo = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getReserveRO();
      if (!contract) throw new Error("Reserve contract not found");

      const fmt = (v) => {
        try { return ethers.utils.formatEther(v); } catch { return "0"; }
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
        contract.totalMaticReceived?.().catch(() => ethers.constants.Zero),
        contract.waitingBiggi?.().catch(() => ethers.constants.Zero),
        contract.dexRefillBiggi?.().catch(() => ethers.constants.Zero),
        contract.biggiBalance?.().catch(() => ethers.constants.Zero),
        contract.maticBalance?.().catch(() => ethers.constants.Zero),
      ]);

      setData({
        address: contract.address,
        liquidityManager: liquidityManager || "—",
        totalMaticReceived: fmt(totalMaticReceived),
        waitingBiggi: fmt(waitingBiggi),
        dexRefillBiggi: fmt(dexRefillBiggi),
        biggiBalance: fmt(biggiBalance),
        maticBalance: fmt(maticBalance),
      });
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
