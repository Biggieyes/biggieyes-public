import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  stats: vi.fn(),
  events: vi.fn(),
  rewards: vi.fn(),
}));
vi.mock("@/shared/services/nftRewardsService.js", () => ({
  default: vi.fn(function (...args) {
    mocks.create(...args);
    return {
      getAllStats: mocks.stats,
      fetchEventsDetailed: mocks.events,
      fetchREWARDSRange: mocks.rewards,
    };
  }),
}));
vi.mock("@/shared/utils/contract", () => ({ getROProvider: () => null }));
import useNFTRewards from "../src/hooks/useNFTRewards.js";

const CONTRACT = "0x2222222222222222222222222222222222222222";
const WALLET = "0x1111111111111111111111111111111111111111";
const OTHER = "0x3333333333333333333333333333333333333333";
let provider;
beforeEach(() => {
  vi.clearAllMocks();
  provider = {
    getNetwork: vi.fn().mockResolvedValue({ chainId: 137n }),
    getBlockNumber: vi.fn().mockResolvedValue(12345),
  };
  mocks.stats
    .mockReset()
    .mockResolvedValue({ totalEventsCreated: 0, totalRewardsCreated: 0 });
  mocks.events.mockReset().mockResolvedValue([]);
  mocks.rewards.mockReset().mockResolvedValue([]);
});

describe("NFT Rewards read consistency", () => {
  it("pins data to a Polygon block and distinguishes a real empty state", async () => {
    const { result } = renderHook(() =>
      useNFTRewards(provider, CONTRACT, WALLET),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data.snapshotBlock).toBe(12345);
    expect(mocks.create).toHaveBeenCalledWith(CONTRACT, provider, {
      blockTag: 12345,
    });
    expect(mocks.rewards).not.toHaveBeenCalled();
  });

  it("rejects a testnet read provider before reading the contract", async () => {
    provider.getNetwork.mockResolvedValue({ chainId: 80002n });
    const { result } = renderHook(() =>
      useNFTRewards(provider, CONTRACT, WALLET),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error.message).toContain("Polygon mainnet");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("can reach an assignment older than the latest 500 records", async () => {
    mocks.stats.mockResolvedValue({
      totalEventsCreated: 102,
      totalRewardsCreated: 501,
    });
    mocks.rewards.mockImplementation(async (first, end) =>
      Array.from({ length: end - first }, (_, i) => ({
        rewardId: first + i,
        assigned: first + i === 1 ? WALLET : OTHER,
        isClaimed: false,
      })),
    );
    const { result } = renderHook(() =>
      useNFTRewards(provider, CONTRACT, WALLET),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.userRewards).toHaveLength(0);
    expect(result.current.data.rewardPages).toBe(2);
    act(() => result.current.setRewardPage(1));
    await waitFor(() =>
      expect(result.current.data.userRewards).toHaveLength(1),
    );
    expect(result.current.data.userRewards[0]).toMatchObject({
      rewardId: 1,
      kind: null,
    });
    expect(mocks.rewards).toHaveBeenLastCalledWith(1, 2);
    act(() => result.current.setEventPage(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.events).toHaveBeenLastCalledWith({ limit: 100, offset: 100 });
  });

  it("ignores a delayed response for a previously connected wallet", async () => {
    let resolveOld;
    mocks.stats.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ wallet }) => useNFTRewards(provider, CONTRACT, wallet),
      { initialProps: { wallet: WALLET } },
    );
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    rerender({ wallet: OTHER });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () =>
      resolveOld({ totalEventsCreated: 10, totalRewardsCreated: 10 }),
    );
    expect(result.current.data.totalRewardsCreated).toBe(0);
    expect(result.current.data.userRewards).toEqual([]);
    expect(mocks.rewards).not.toHaveBeenCalled();
  });

  it("surfaces RPC failures and clears previously claimable data", async () => {
    mocks.stats.mockResolvedValue({
      totalEventsCreated: 1,
      totalRewardsCreated: 1,
    });
    mocks.rewards.mockResolvedValue([
      { rewardId: 1, assigned: WALLET, isClaimed: false },
    ]);
    const { result } = renderHook(() =>
      useNFTRewards(provider, CONTRACT, WALLET),
    );
    await waitFor(() =>
      expect(result.current.data.userRewards).toHaveLength(1),
    );
    mocks.stats.mockRejectedValue(new Error("RPC unavailable"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error.message).toBe("RPC unavailable");
    expect(result.current.data.userRewards).toEqual([]);
  });
});
