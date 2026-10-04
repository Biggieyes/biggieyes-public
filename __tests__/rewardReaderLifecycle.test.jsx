import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("ethers", async (importOriginal) => ({
  ...(await importOriginal()),
  Contract: vi.fn(function (...args) {
    return mocks.create(...args);
  }),
}));

import useNftRewardsReader from "../src/hooks/useNftRewardsReader.js";
import useTokenRewardsReader from "../src/hooks/useTokenRewardsReader.js";

const provider = {};
const oldAddress = `0x${"1".repeat(40)}`;
const nextAddress = `0x${"2".repeat(40)}`;

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  mocks.create.mockReset();
});

describe("reward reader lifecycle", () => {
  it("does not publish a stale Token Rewards response after its address changes", async () => {
    const oldRead = deferred();
    mocks.create.mockImplementation((address) => ({
      getStatus: vi.fn(() =>
        address === oldAddress
          ? oldRead.promise
          : Promise.resolve([
              { tokenRewards: nextAddress, currentWeek: 2n },
              ["BIGGI", "BIGGI", 18n],
            ]),
      ),
    }));

    const { result, rerender } = renderHook(
      ({ address }) => useTokenRewardsReader(provider, address),
      { initialProps: { address: oldAddress } },
    );
    rerender({ address: nextAddress });
    await waitFor(() =>
      expect(result.current.data?.tokenRewards).toBe(nextAddress),
    );

    await act(async () => {
      oldRead.resolve([
        { tokenRewards: oldAddress, currentWeek: 1n },
        ["BIGGI", "BIGGI", 18n],
      ]);
    });
    expect(result.current.data?.tokenRewards).toBe(nextAddress);
  });

  it("does not publish a stale NFT Rewards response after its address changes", async () => {
    const oldRead = deferred();
    mocks.create.mockImplementation((address) => ({
      getStatus: vi.fn(() =>
        address === oldAddress
          ? oldRead.promise
          : Promise.resolve({ nftRewards: nextAddress, nextEventId: 2n }),
      ),
    }));

    const { result, rerender } = renderHook(
      ({ address }) => useNftRewardsReader(provider, address),
      { initialProps: { address: oldAddress } },
    );
    rerender({ address: nextAddress });
    await waitFor(() =>
      expect(result.current.data?.contractAddress).toBe(nextAddress),
    );

    await act(async () => {
      oldRead.resolve({ nftRewards: oldAddress, nextEventId: 1n });
    });
    expect(result.current.data?.contractAddress).toBe(nextAddress);
  });
});
