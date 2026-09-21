import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  polls: vi.fn(),
  provider: {},
}));
vi.mock("ethers", async (importOriginal) => ({
  ...(await importOriginal()),
  Contract: vi.fn(function (...args) {
    return mocks.create(...args);
  }),
}));
vi.mock("@/shared/utils/contract", () => ({
  getROProvider: () => mocks.provider,
  ADDR: { COMMUNITY_CENTER: "0x1111111111111111111111111111111111111111" },
}));
vi.mock("@/shared/services/communityVotingApi.js", () => ({
  fetchCommunityPolls: mocks.polls,
}));
import useTokenRewards from "../src/hooks/useTokenRewards.js";
import useCommunityCenterUserSnapshot from "../src/hooks/useCommunityCenterUserSnapshot.js";

beforeEach(() => {
  mocks.create.mockReset();
  mocks.polls.mockReset().mockResolvedValue({ polls: [] });
});
describe("reward read failures", () => {
  it("keeps successful onchain rewards when only the polling API is unavailable", async () => {
    mocks.create.mockReturnValue({
      getEvents: async () => [],
      paused: async () => false,
      owner: async () => "owner",
      distributor: async () => "distributor",
      poolBalance: async () => 5n,
      totalLocked: async () => 0n,
    });
    mocks.polls.mockRejectedValue(new Error("HTTP 503"));
    const { result } = renderHook(() =>
      useCommunityCenterUserSnapshot({ walletAddress: "wallet" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot.poolBalance).toBe(5n);
    expect(result.current.snapshot.pollsCount).toBeNull();
    expect(result.current.snapshot.pollsError.message).toBe("HTTP 503");
  });
  it("exposes token RPC errors without a successful zero snapshot", async () => {
    mocks.create.mockReturnValue({
      unitReward: async () => {
        throw new Error("429");
      },
      currentWeek: async () => 1n,
      getBlockWeights: async () => [],
    });
    const { result } = renderHook(() => useTokenRewards(mocks.provider));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error.message).toBe("429");
  });

  it("exposes the onchain paused state for reward claim controls", async () => {
    const paused = vi.fn().mockResolvedValue(true);
    mocks.create.mockReturnValue({
      unitReward: async () => 1n,
      currentWeek: async () => 7n,
      getBlockWeights: async () => [1n],
      paused,
    });

    const { result } = renderHook(() => useTokenRewards(mocks.provider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data.paused).toBe(true);
    expect(paused).toHaveBeenCalledOnce();
  });

  it("ignores an outdated token contract snapshot", async () => {
    let resolveOld;
    mocks.create.mockImplementation((address) => ({
      unitReward: () =>
        address.endsWith("1")
          ? new Promise((resolve) => {
              resolveOld = resolve;
            })
          : Promise.resolve(2n),
      currentWeek: async () => 1n,
      getBlockWeights: async () => [1n],
    }));
    const { result, rerender } = renderHook(
      ({ address }) => useTokenRewards(mocks.provider, address),
      { initialProps: { address: "contract1" } },
    );
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    rerender({ address: "contract2" });
    await waitFor(() => expect(result.current.data?.unitReward).toBe(2n));
    await act(async () => resolveOld(99n));
    expect(result.current.data.unitReward).toBe(2n);
  });

  it("uses unknown community balances after RPC failure and real zero only on success", async () => {
    const contract = {
      getEvents: vi.fn().mockResolvedValue([]),
      paused: async () => false,
      owner: async () => "owner",
      distributor: async () => "distributor",
      poolBalance: vi.fn().mockResolvedValue(0n),
      totalLocked: async () => 0n,
    };
    mocks.create.mockReturnValue(contract);
    const { result } = renderHook(() =>
      useCommunityCenterUserSnapshot({ walletAddress: "wallet" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot.poolBalance).toBe(0n);
    expect(result.current.snapshot.claimableEvents).toBe(0);
    contract.poolBalance.mockRejectedValue(new Error("timeout"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error.message).toBe("timeout");
    expect(result.current.snapshot.poolBalance).toBeNull();
    expect(result.current.snapshot.claimableEvents).toBeNull();
    expect(result.current.snapshot.paused).toBeNull();
  });
});
