// src/hooks/useDripKeeper.js
import * as React from "react";
import { useContracts } from "../providers/ContractsProvider";
import { getCached, invalidateCache } from "../utils/fetchCache";

export default function useDripKeeper(walletAddress = "") {
  const { dripKeeperRead, dripKeeperWrite } = useContracts();
  const [data, setData] = React.useState({
    address: null,
    dripLM: null,
    owner: null,
    paused: false,
    isKeeper: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [performing, setPerforming] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = dripKeeperRead?.();
      if (!contract) throw new Error("DripKeeper contract not found");

      const cacheKey = `dripKeeper:${contract.address || "unknown"}:${walletAddress || "anon"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const [dripLM, owner, paused] = await Promise.all([
            contract.dripLM?.().catch(() => null),
            contract.owner?.().catch(() => null),
            contract.paused?.().catch(() => false),
          ]);

          let isKeeper = false;
          if (walletAddress) {
            try {
              isKeeper = Boolean(await contract.keepers(walletAddress));
            } catch {
              isKeeper = false;
            }
          }

          return {
            address: contract.address,
            dripLM: dripLM || null,
            owner: owner || null,
            paused: Boolean(paused),
            isKeeper,
          };
        },
        { force: options?.force === true }
      );
      setData(snapshot);
    } catch (e) {
      console.error("useDripKeeper.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [dripKeeperRead, walletAddress]);

  const checkUpkeep = React.useCallback(async (performData = "0x") => {
    const contract = dripKeeperRead?.();
    if (!contract) throw new Error("DripKeeper contract not found");
    const res = await contract.checkUpkeep(performData);
    const upkeepNeeded = Boolean(res?.upkeepNeeded ?? res?.[0]);
    const nextData = res?.[1] ?? res?.performData ?? "0x";
    return { upkeepNeeded, performData: nextData };
  }, [dripKeeperRead]);

  const performUpkeep = React.useCallback(async (performData = "0x", overrides = {}) => {
    setPerforming(true);
    setError(null);
    try {
      const contract = dripKeeperWrite?.();
      if (!contract) throw new Error("Signer not available for DripKeeper");
      const tx = await contract.performUpkeep(performData, overrides);
      const receipt = await tx.wait(1);
      const cacheKey = `dripKeeper:${contract.address || "unknown"}:${walletAddress || "anon"}`;
      invalidateCache(cacheKey);
      await refresh({ force: true }).catch(() => {});
      return receipt;
    } catch (e) {
      console.error("useDripKeeper.performUpkeep", e);
      setError(e);
      throw e;
    } finally {
      setPerforming(false);
    }
  }, [dripKeeperWrite, refresh, walletAddress]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, performing, error, refresh, checkUpkeep, performUpkeep };
}
