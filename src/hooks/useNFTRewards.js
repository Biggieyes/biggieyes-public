import * as React from "react";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import NFTRewardsService from "@/shared/services/nftRewardsService.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVENT_LIMIT = 100;
const REWARD_SCAN_LIMIT = 500;

const DEFAULT_SUMMARY = {
  events: [],
  rewards: [],
  userRewards: [],
  totalEventsCreated: 0,
  totalRewardsCreated: 0,
  totalClaimed: 0,
  totalAssigned: 0,
  rewardsTruncated: false,
  contractAddress: ADDR.NFT_REWARDS,
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value?.toString?.() ?? value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const findRewardEvent = (events, rewardId) =>
  events.find((event) => {
    const start = asNumber(event.rewardStartId);
    const count = asNumber(event.rewardCount);
    return rewardId >= start && rewardId < start + count;
  });

export default function useNFTRewards(
  providerOverride,
  addressOverride,
  walletAddress,
) {
  const [data, setData] = React.useState(DEFAULT_SUMMARY);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const provider = React.useMemo(() => {
    if (providerOverride) return providerOverride;
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, [providerOverride]);

  const address = addressOverride || ADDR.NFT_REWARDS;

  const refresh = React.useCallback(async () => {
    if (!provider || !address) {
      const fallback = { ...DEFAULT_SUMMARY, contractAddress: address || null };
      setData(fallback);
      return fallback;
    }
    setLoading(true);
    setError(null);
    try {
      const service = new NFTRewardsService(address, provider);
      const [stats, events] = await Promise.all([
        service.getAllStats(),
        service.fetchEventsDetailed({ limit: EVENT_LIMIT }),
      ]);
      const totalRewardsCreated = asNumber(stats.totalRewardsCreated);
      const firstRewardId = Math.max(
        1,
        totalRewardsCreated - REWARD_SCAN_LIMIT + 1,
      );
      const rewards = totalRewardsCreated
        ? await service.fetchREWARDSRange(
            firstRewardId,
            totalRewardsCreated + 1,
          )
        : [];
      const linkedRewards = rewards.map((reward) => {
        const event = findRewardEvent(events, reward.rewardId);
        return {
          ...reward,
          eventId: event?.eventId ?? null,
          kind: event?.kind ?? 0,
        };
      });
      const normalizedWallet = String(walletAddress || "").toLowerCase();
      const userRewards = normalizedWallet
        ? linkedRewards.filter(
            (reward) =>
              String(reward.assigned || "").toLowerCase() === normalizedWallet,
          )
        : [];
      const assignedRewards = linkedRewards.filter(
        (reward) =>
          reward.assigned &&
          String(reward.assigned).toLowerCase() !== ZERO_ADDRESS,
      );

      const next = {
        ...DEFAULT_SUMMARY,
        ...stats,
        contractAddress: address,
        events,
        rewards: linkedRewards,
        userRewards,
        totalEventsCreated: asNumber(stats.totalEventsCreated),
        totalRewardsCreated,
        totalClaimed: linkedRewards.filter((reward) => reward.isClaimed).length,
        totalAssigned: assignedRewards.length,
        rewardsTruncated: totalRewardsCreated > linkedRewards.length,
      };
      setData(next);
      return next;
    } catch (refreshError) {
      setError(refreshError);
      const fallback = { ...DEFAULT_SUMMARY, contractAddress: address };
      setData(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [provider, address, walletAddress]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
