// src/HOOKS/useDRIPKeeper.js
import * as React from "react";
import { useContracts } from "../../../../providers/ContractsProvider";
import { getCached, invalidateCache } from "../../../../utils/fetchCache";

export default function useDRIPKeeper(walletAddress = "") {
  const { DRIPKeeperRead, DRIPKeeperWrite } = useContracts();
  const [data, setData] = React.useState({
    address: null,
    DRIPLM: null,
    owner: null,
    paused: false,
    isKeeper: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [performing, setPerforming] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(
    async (options = {}) => {
      setLoading(true);
      setError(null);
      try {
        const contract = DRIPKeeperRead?.();
        if (!contract) throw new Error("DRIPKeeper contract not found");

        const cacheKey = `DRIPKeeper:${contract.address || "unknown"}:${walletAddress || "anon"}`;
        const snapshot = await getCached(
          cacheKey,
          async () => {
            const [DRIPLM, owner, paused] = await Promise.all([
              contract.DRIPLM?.().catch(() => null),
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
              DRIPLM: DRIPLM || null,
              owner: owner || null,
              paused: Boolean(paused),
              isKeeper,
            };
          },
          { force: options?.force === true },
        );
        setData(snapshot);
      } catch (e) {
        console.error("useDRIPKeeper.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [DRIPKeeperRead, walletAddress],
  );

  const checkUpkeep = React.useCallback(
    async (performData = "0x") => {
      const contract = DRIPKeeperRead?.();
      if (!contract) throw new Error("DRIPKeeper contract not found");
      const res = await contract.checkUpkeep(performData);
      const upkeepNeeded = Boolean(res?.upkeepNeeded ?? res?.[0]);
      const nextData = res?.[1] ?? res?.performData ?? "0x";
      return { upkeepNeeded, performData: nextData };
    },
    [DRIPKeeperRead],
  );

  const performUpkeep = React.useCallback(
    async (performData = "0x", overrides = {}) => {
      setPerforming(true);
      setError(null);
      try {
        const contract = DRIPKeeperWrite?.();
        if (!contract) throw new Error("Signer not available for DRIPKeeper");
        const tx = await contract.performUpkeep(performData, overrides);
        const receipt = await tx.wait(1);
        const cacheKey = `DRIPKeeper:${contract.address || "unknown"}:${walletAddress || "anon"}`;
        invalidateCache(cacheKey);
        await refresh({ force: true }).catch(() => {});
        return receipt;
      } catch (e) {
        console.error("useDRIPKeeper.performUpkeep", e);
        setError(e);
        throw e;
      } finally {
        setPerforming(false);
      }
    },
    [DRIPKeeperWrite, refresh, walletAddress],
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



