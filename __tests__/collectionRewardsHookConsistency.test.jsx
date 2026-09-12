import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ stats: vi.fn() }));
vi.mock("@/shared/services/collectionRewardsService.js", () => ({
  default: vi.fn(function () {
    return { getAllStats: mocks.stats };
  }),
}));
vi.mock("@/shared/utils/contract", () => ({ getROProvider: () => null }));
import useCollectionRewards from "../src/hooks/useCollectionRewards.js";
const provider = {};
const address = "0x1111111111111111111111111111111111111111";
beforeEach(() => {
  mocks.stats.mockReset();
});
describe("collection reward context", () => {
  it.each(["wallet", "collection"])(
    "discards old data after a %s change",
    async (field) => {
      let resolveOld;
      mocks.stats
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValue({ blockReward: 2n });
      const initialProps = { wallet: "wallet-a", collection: "collection-a" };
      const { result, rerender } = renderHook(
        ({ wallet, collection }) =>
          useCollectionRewards(wallet, provider, address, collection),
        { initialProps },
      );
      await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
      rerender({ ...initialProps, [field]: `${field}-b` });
      await waitFor(() => expect(result.current.data?.blockReward).toBe(2n));
      await act(async () => resolveOld({ blockReward: 99n }));
      expect(result.current.data.blockReward).toBe(2n);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    },
  );
  it("clears claim data on a failed refresh instead of returning a zero balance", async () => {
    mocks.stats.mockResolvedValue({ blockReward: 2n });
    const { result } = renderHook(() =>
      useCollectionRewards("wallet", provider, address, "collection"),
    );
    await waitFor(() => expect(result.current.data?.blockReward).toBe(2n));
    mocks.stats.mockRejectedValue(new Error("RPC unavailable"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error.message).toBe("RPC unavailable");
    expect(result.current.loading).toBe(false);
  });
});
