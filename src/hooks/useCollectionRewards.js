// src/hooks/useCollectionRewards.js
import * as React from "react";
import { ethers } from "ethers";
import { ABI_REWARDS_READER, getROProvider } from "../utils/contract";
import {
  BLOCK_INDICES,
  ORANGE_MAIN_IDS,
} from "../services/collectionRewardsService";
import { getCached } from "../utils/fetchCache";

function toNumber(value) {
  if (value == null) return 0;
  try {
    return Number(value?.toString?.() ?? value);
  } catch {
    return 0;
  }
}

function toEther(value) {
  try {
    return ethers.utils.formatEther(value ?? 0);
  } catch {
    return "0";
  }
}

export function useCollectionRewards(walletAddress, providerOverride) {
  const [data, setData] = React.useState({
    address: "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
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
    async (options = {}) => {
      setLoading(true);
      setError(null);
      try {
        const provider = providerOverride || getROProvider();
        if (!provider) throw new Error("Read-only provider not available");

        // RewardsReader contract instance
        const rewardsReader = new ethers.Contract(
          "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
          ABI_REWARDS_READER,
          provider,
        );

        // Čtení globálního snapshotu (viz ABI)
        const global = await rewardsReader.globalSnapshot();

        // Načtení odměn pro všechny bloky
        const blockPaid = await Promise.all(
          BLOCK_INDICES.map((idx) => rewardsReader.blockPaid(idx)),
        );

        setData((prev) => ({
          ...prev,
          address: "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
          blockReward: global.remainingBlock?.toString?.() ?? "0",
          orangeReward: global.remainingOrange?.toString?.() ?? "0",
          blockPaid, // pole s odměnami pro každý blok
          // ...další pole podle potřeby
        }));
      } catch (e) {
        console.error("useCollectionRewards.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, providerOverride],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
