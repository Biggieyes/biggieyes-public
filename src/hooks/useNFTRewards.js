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
};
const asNumber = (value) => {
  const parsed = Number(value?.toString?.() ?? value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid NFT Rewards counter.");
  }
  return parsed;
};

export default function useNFTRewards(
  providerOverride,
  addressOverride,
  walletAddress,
) {
  const [state, setState] = React.useState(null);
  const [pages, setPages] = React.useState(null);
  const requestId = React.useRef(0);
  const provider = React.useMemo(() => {
    if (providerOverride) return providerOverride;
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, [providerOverride]);
  const address = addressOverride || ADDR.NFT_REWARDS;
  const source = React.useMemo(
    () => ({ provider, address, walletAddress }),
    [provider, address, walletAddress],
  );
  const rewardPage = pages?.source === source ? pages.rewardPage : 0;
  const eventPage = pages?.source === source ? pages.eventPage : 0;
  const context = React.useMemo(
    () => ({ source, rewardPage, eventPage }),
    [source, rewardPage, eventPage],
  );

  const refresh = React.useCallback(async () => {
    const id = ++requestId.current;
    const empty = { ...DEFAULT_SUMMARY, contractAddress: address || null };
    setState({ context, data: empty, loading: true, error: null });
    try {
      if (!provider || !address)
        throw new Error("NFT Rewards connection unavailable.");
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 137) {
        throw new Error("NFT Rewards requires Polygon mainnet (137).");
      }
      const snapshotBlock = await provider.getBlockNumber();
      const service = new NFTRewardsService(address, provider, {
        blockTag: snapshotBlock,
      });
      const stats = await service.getAllStats();
      if (id !== requestId.current) return null;
      const totalRewardsCreated = asNumber(stats.totalRewardsCreated);
      const totalEventsCreated = asNumber(stats.totalEventsCreated);
      const rewardPages = Math.max(
        1,
        Math.ceil(totalRewardsCreated / REWARD_SCAN_LIMIT),
      );
      const eventPages = Math.max(
        1,
        Math.ceil(totalEventsCreated / EVENT_LIMIT),
      );
      const currentRewardPage = Math.min(rewardPage, rewardPages - 1);
      const currentEventPage = Math.min(eventPage, eventPages - 1);
      const lastRewardId =
        totalRewardsCreated - currentRewardPage * REWARD_SCAN_LIMIT;
      const firstRewardId = Math.max(1, lastRewardId - REWARD_SCAN_LIMIT + 1);
      const [events, rewards] = await Promise.all([
        service.fetchEventsDetailed({
          limit: EVENT_LIMIT,
          offset: currentEventPage * EVENT_LIMIT,
        }),
        lastRewardId
          ? service.fetchREWARDSRange(firstRewardId, lastRewardId + 1)
          : [],
      ]);
      const linkedRewards = rewards.map((reward) => {
        const event = events.find(
          (item) =>
            reward.rewardId >= item.rewardStartId &&
            reward.rewardId < item.rewardStartId + item.rewardCount,
        );
        return {
          ...reward,
          eventId: event?.eventId ?? null,
          kind: event?.kind ?? null,
        };
      });
      const normalizedWallet = String(walletAddress || "").toLowerCase();
      const next = {
        ...stats,
        contractAddress: address,
        snapshotBlock,
        events,
        rewards: linkedRewards,
        userRewards: normalizedWallet
          ? linkedRewards.filter(
              (reward) =>
                String(reward.assigned || "").toLowerCase() ===
                normalizedWallet,
            )
          : [],
        totalEventsCreated,
        totalRewardsCreated,
        totalClaimed: linkedRewards.filter((reward) => reward.isClaimed).length,
        totalAssigned: linkedRewards.filter(
          (reward) =>
            reward.assigned &&
            String(reward.assigned).toLowerCase() !== ZERO_ADDRESS,
        ).length,
        rewardsTruncated: totalRewardsCreated > linkedRewards.length,
        rewardPage: currentRewardPage,
        rewardPages,
        eventPage: currentEventPage,
        eventPages,
        firstRewardId: lastRewardId ? firstRewardId : 0,
        lastRewardId,
      };
      if (id === requestId.current)
        setState({ context, data: next, loading: false, error: null });
      return next;
    } catch (error) {
      if (id === requestId.current)
        setState({ context, data: empty, loading: false, error });
      return null;
    }
  }, [provider, address, walletAddress, context, rewardPage, eventPage]);

  React.useEffect(() => {
    refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const current = state?.context === context ? state : null;
  const setRewardPage = (page) => {
    if (
      !current ||
      current.loading ||
      current.error ||
      !Number.isInteger(page) ||
      page < 0 ||
      page >= current.data.rewardPages
    )
      return;
    setPages({ source, rewardPage: page, eventPage });
  };
  const setEventPage = (page) => {
    if (
      !current ||
      current.loading ||
      current.error ||
      !Number.isInteger(page) ||
      page < 0 ||
      page >= current.data.eventPages
    )
      return;
    setPages({ source, rewardPage, eventPage: page });
  };
  return {
    data: current?.data || { ...DEFAULT_SUMMARY, contractAddress: address },
    loading: current?.loading ?? true,
    error: current?.error || null,
    refresh,
    setRewardPage,
    setEventPage,
  };
}
