// src/HOOKS/useDRIPKeeper.js
import * as React from "react";
import { useContracts } from "../providers/ContractsProvider";
import { getCached, invalidateCache } from "../utils/fetchCache";

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
        // ...existing code...
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, DRIPKeeperRead],
  );

  return { data, loading, performing, error, refresh };
}
// ...existing code...



