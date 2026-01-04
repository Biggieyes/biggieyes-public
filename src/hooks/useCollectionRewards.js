// src/hooks/useCollectionRewards.js
import * as React from "react";
import { ethers } from "ethers";
import { getCollectionRewardsRO } from "../utils/contract";
import { BLOCK_INDICES, ORANGE_MAIN_IDS } from "../services/collectionRewardsService";
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

export default function useCollectionRewards(walletAddress = "", providerOverride = null) {
  const [data, setData] = React.useState({
    address: null,
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

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getCollectionRewardsRO(providerOverride || undefined);
      if (!contract) throw new Error("CollectionRewards contract not found");
      const cacheKey = `collectionRewards:${contract.address || "unknown"}:${walletAddress || "anon"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const safeCall = async (name, args = [], fallback = null) => {
            try {
              const fn = contract?.[name];
              if (typeof fn !== "function") return fallback;
              const res = await fn(...args);
              return res ?? fallback;
            } catch {
              return fallback;
            }
          };

          const [
            blockReward,
            blockWinnersCount,
            orangeReward,
            orangeWinnersCount,
            rainbowReward,
            rainbowRewardClaimedGlobal,
            distributor,
            main,
            owner,
          ] = await Promise.all([
            safeCall("blockReward", [], ethers.constants.Zero),
            safeCall("blockWinnersCount", [], 0),
            safeCall("orangeReward", [], ethers.constants.Zero),
            safeCall("orangeWinnersCount", [], 0),
            safeCall("rainbowReward", [], ethers.constants.Zero),
            safeCall("rainbowRewardClaimedGlobal", [], false),
            safeCall("distributor", [], null),
            safeCall("main", [], null),
            safeCall("owner", [], null),
          ]);

          const blockPaidRaw = await Promise.all(
            BLOCK_INDICES.map((idx) => safeCall("blockPaid", [idx], false))
          );
          const orangePaidRaw = await Promise.all(
            ORANGE_MAIN_IDS.map((id) => safeCall("orangeMainIdPaid", [id], false))
          );
          const claimedOrangeRaw = walletAddress
            ? await safeCall("claimedOrange", [walletAddress], false)
            : false;

          return {
            address: contract.address,
            blockReward: toEther(blockReward),
            blockWinnersCount: toNumber(blockWinnersCount),
            blockPaid: blockPaidRaw.map(Boolean),
            orangeReward: toEther(orangeReward),
            orangeWinnersCount: toNumber(orangeWinnersCount),
            orangeMainIdPaid: orangePaidRaw.map(Boolean),
            rainbowReward: toEther(rainbowReward),
            rainbowRewardClaimedGlobal: Boolean(rainbowRewardClaimedGlobal),
            rainbowClaimed: Boolean(rainbowRewardClaimedGlobal),
            claimedOrange: Boolean(claimedOrangeRaw),
            distributor: distributor || null,
            main: main || null,
            owner: owner || null,
          };
        },
        { force: options?.force === true }
      );

      setData(snapshot);
    } catch (e) {
      console.error("useCollectionRewards.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, providerOverride]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
