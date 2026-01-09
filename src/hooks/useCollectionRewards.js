// src/HOOKS/useCOLLECTIONREWARDS.js
import * as React from "react";
import { formatUnits } from "ethers/lib.esm/utils.js";
import COLLECTIONREWARDSService from "../services/collectionRewardsService";
import { getROProvider } from "../utils/contract";
import { ADDR } from "../utils/addresses";

export function useCOLLECTIONREWARDS(walletAddress, providerOverride) {
  const [data, setData] = React.useState({
    address: ADDR.COLLECTION_REWARDS,
    blockReward: "0",
    blockWinnersCount: 0,
    blockPaid: [],
    orangeReward: "0",
    orangeWinnersCount: 0,
    orangeMainIdPaid: [],
    rainbowReward: "0",
    rainbowRewardClaimedGlobal: false,
    rainbowClaimed: false,
    claimedOrange: false,
    distributor: null,
    main: null,
    owner: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = providerOverride || getROProvider();
        if (!provider) throw new Error("Read-only provider not available");

        const address = ADDR.COLLECTION_REWARDS;
        if (!address) {
          setData((prev) => ({ ...prev }));
          return;
        }

        const svc = new COLLECTIONREWARDSService(address, provider);
        const raw = await svc.getAllStats(walletAddress);
        const fmt = (bn) => {
          try {
            return formatUnits(bn ?? 0, 18);
          } catch {
            return "0";
          }
        };

        setData((prev) => ({
          ...prev,
          address,
          blockReward: fmt(raw.blockReward),
          blockWinnersCount: Number(raw.blockWinnersCount ?? 0),
          blockPaid: raw.blockPaid || [],
          orangeReward: fmt(raw.orangeReward),
          orangeWinnersCount: Number(raw.orangeWinnersCount ?? 0),
          orangeMainIdPaid: raw.orangeMainIdPaid || [],
          rainbowReward: fmt(raw.rainbowReward),
          rainbowRewardClaimedGlobal: Boolean(raw.rainbowClaimed),
          rainbowClaimed: Boolean(raw.rainbowClaimed),
          claimedOrange: Boolean(raw.claimedOrange),
          distributor: raw.distributor || null,
          main: raw.main || null,
          owner: raw.owner || null,
        }));
      } catch (e) {
        console.error("useCOLLECTIONREWARDS.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [providerOverride, walletAddress],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export default useCOLLECTIONREWARDS;
