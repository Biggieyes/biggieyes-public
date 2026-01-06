// src/hooks/useTokenRewards.js
import * as React from "react";
import { ethers } from "ethers";
import { getROProvider, ABI_REWARDS_READER } from "../utils/contract";

const DEFAULT_DATA = {
  address: "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
  unitReward: "0",
  rewardsMinted: "0",
  rewardsCap: "0",
  remainingCap: "0",
  totalDistributed: "0",
  distributedThisWeek: "0",
  currentWeek: 0,
  lastRecordedWeek: 0,
  lastWeekDistributed: "0",
  blockWeights: [],
  tokenMeta: null,
  tokenSymbol: "BIGGI",
  tokenDecimals: 18,
  mainNFT: null,
  main2NFT: null,
  owner: null,
  paused: false,
  treasure: null,
};

export default function useTokenRewards(providerOverride = null) {
  const [data, setData] = React.useState(DEFAULT_DATA);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(
    async () => {
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
        // Další data lze načíst podle potřeby

        setData((prev) => ({
          ...prev,
          address: "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
          currentWeek: Number(global.weekNow),
          rewardsMinted: global.tokenRewardsMinted?.toString?.() ?? "0",
          rewardsCap: global.tokenRewardsCap?.toString?.() ?? "0",
          totalDistributed: global.treasuryBiggi?.toString?.() ?? "0",
          // ...další pole podle potřeby
        }));
      } catch (e) {
        console.error("useTokenRewards.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [providerOverride],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
