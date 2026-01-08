// src/hooks/useBuybackKeeper.js
import * as React from "react";
import { getUpkeepRO, getUpkeep } from "../utils/contract";
import { getCached, invalidateCache } from "../utils/fetchCache";

export default function useBuybackKeeper() {
  const [data, setData] = React.useState({
    address: null,
    upkeepNeeded: null,
    performData: "0x",
  });
  const [loading, setLoading] = React.useState(false);
  const [performing, setPerforming] = React.useState(false);
  const [error, setError] = React.useState(null);

  const checkUpkeep = React.useCallback(async (performData = "0x") => {
    const contract = getUpkeepRO();
    if (!contract) throw new Error("Upkeep contract not found");
    const res = await contract.checkUpkeep(performData);
    const upkeepNeeded = Boolean(res?.upkeepNeeded ?? res?.[0]);
    const nextData = res?.performData ?? res?.[1] ?? "0x";
    return { upkeepNeeded, performData: nextData };
  }, []);

  const refresh = React.useCallback(
    async (options = {}) => {
      setLoading(true);
      setError(null);
      try {
        const contract = getUpkeepRO();
        if (!contract) throw new Error("Upkeep contract not found");
        const cacheKey = `buybackKeeper:${contract.address || "unknown"}:0x`;
        const snapshot = await getCached(
          cacheKey,
          async () => {
            const { upkeepNeeded, performData } = await checkUpkeep("0x");
            return {
              address: contract.address,
              upkeepNeeded,
              performData,
            };
          },
          { force: options?.force === true },
        );
        setData(snapshot);
      } catch (e) {
        console.error("useBuybackKeeper.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [checkUpkeep],
  );

  const performUpkeep = React.useCallback(
    async (performData = "0x", overrides = {}) => {
      setPerforming(true);
      setError(null);
      try {
        const contract = getUpkeep();
        if (!contract) throw new Error("Upkeep contract not found");
        const tx = await contract.performUpkeep(performData, overrides);
        const receipt = await tx.wait(1);
        const cacheKey = `buybackKeeper:${contract.address || "unknown"}:0x`;
        invalidateCache(cacheKey);
        await refresh({ force: true }).catch(() => {});
        return receipt;
      } catch (e) {
        console.error("useBuybackKeeper.performUpkeep", e);
        setError(e);
        throw e;
      } finally {
        setPerforming(false);
      }
    },
    [refresh],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    performing,
    error,
    refresh,
    checkUpkeep,
    performUpkeep,
  };
}

