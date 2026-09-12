import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import usePollingSnapshot from "../src/hooks/tokenomics/_usePollingSnapshot.js";

describe("polling snapshot generations", () => {
  it.each(["resolve", "reject"])(
    "ignores stale %s after changing the data source",
    async (outcome) => {
      let resolve, reject;
      const old = vi.fn(
        () =>
          new Promise((ok, fail) => {
            resolve = ok;
            reject = fail;
          }),
      );
      const fresh = vi.fn().mockResolvedValue({ balance: 12n, paused: false });
      const { result, rerender } = renderHook(
        ({ fetcher, cacheKey }) =>
          usePollingSnapshot(fetcher, {
            cacheKey,
            intervalMs: 0,
            pauseWhenHidden: false,
          }),
        { initialProps: { fetcher: old, cacheKey: `old-${outcome}` } },
      );
      await waitFor(() => expect(old).toHaveBeenCalledOnce());
      rerender({ fetcher: fresh, cacheKey: `new-${outcome}` });
      await waitFor(() => expect(result.current.snapshot?.balance).toBe("12"));
      await act(async () =>
        outcome === "resolve"
          ? resolve({ balance: 0n })
          : reject(new Error("late")),
      );
      expect(result.current.snapshot).toEqual({ balance: "12", paused: false });
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(fresh).toHaveBeenCalledOnce();
    },
  );

  it("preserves real booleans and zeros when sanitizing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ paused: false, enabled: true, amount: 0n });
    const { result } = renderHook(() =>
      usePollingSnapshot(fetcher, { intervalMs: 0, pauseWhenHidden: false }),
    );
    await waitFor(() =>
      expect(result.current.snapshot).toEqual({
        paused: false,
        enabled: true,
        amount: "0",
      }),
    );
  });
});
