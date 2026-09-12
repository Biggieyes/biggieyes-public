import { describe, expect, it, vi } from "vitest";

import {
  computeDiff,
  isExplicitlyEmptyContractCode,
  normalizeMetadataConsistency,
  normalizeNftInfo,
  readCollectionBlockSnapshot,
  summarizeCollectionBlocks,
} from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.utils.js";

describe("collection block reads", () => {
  it("distinguishes an absent contract from an unavailable code probe", () => {
    expect(isExplicitlyEmptyContractCode("0x")).toBe(true);
    expect(isExplicitlyEmptyContractCode("0x0")).toBe(true);
    expect(isExplicitlyEmptyContractCode("0x00")).toBe(true);
    expect(isExplicitlyEmptyContractCode("0x6000")).toBe(false);
    expect(isExplicitlyEmptyContractCode(null)).toBe(false);
    expect(isExplicitlyEmptyContractCode(undefined)).toBe(false);
  });

  it("does not show a price delta while live price equals contract base", () => {
    expect(computeDiff(600, 600)).toBeNull();
    expect(computeDiff(630, 600)).toMatchObject({ positive: true });
  });

  it("uses 1-based contract helpers for block number 1", async () => {
    const contract = {
      getCurrentBlockPrice: vi.fn(async () => 100n),
      getBlockMintCount: vi.fn(async () => 7n),
      blockInfos: vi.fn(),
    };

    await expect(readCollectionBlockSnapshot(contract, 1)).resolves.toEqual({
      basePriceWei: null,
      priceWei: 100n,
      mintedRaw: 7n,
    });
    expect(contract.getCurrentBlockPrice).toHaveBeenCalledWith(1);
    expect(contract.getBlockMintCount).toHaveBeenCalledWith(1);
    expect(contract.blockInfos).toHaveBeenCalledWith(0);
  });

  it("uses the 0-based storage getter for base data and helper fallbacks", async () => {
    const contract = {
      blockInfos: vi.fn(async () => ({
        basePrice: 250n,
        currentPrice: 300n,
        mintCount: 9n,
      })),
    };

    await expect(readCollectionBlockSnapshot(contract, 3)).resolves.toEqual({
      basePriceWei: 250n,
      priceWei: 300n,
      mintedRaw: null,
    });
    expect(contract.blockInfos).toHaveBeenCalledWith(2);
  });

  it("normalizes public NFT and metadata consistency tuples", () => {
    expect(normalizeNftInfo([false, 1n, 5n, 44n, 0n, 0n, 0n])).toMatchObject({
      configured: true,
      minted: false,
      background: 1,
      blockIdx: 5,
      mainId: "44",
    });
    expect(normalizeMetadataConsistency([100n, true, true])).toEqual({
      configuredCount: 100,
      fullyConfigured: true,
      rewardMatrixConsistent: true,
    });
  });

  it("does not report the unused blockInfos mintCount when live counters fail", async () => {
    const fail = vi.fn(async () => { throw new Error("RPC offline"); });
    const contract = {
      getBlockMintCount: fail,
      blockMintCounts: fail,
      blockInfos: async () => [100n, 10000n, 100n, 0n],
    };
    expect((await readCollectionBlockSnapshot(contract, 1)).mintedRaw).toBeNull();
  });

  it("uses the Public chapter provider price, never the stale local price", async () => {
    const contract = {
      getCurrentBlockPrice: async () => { throw new Error("RPC offline"); },
      getEffectiveBlockPrice: vi.fn(async () => 150n),
      blockInfos: async () => [100n, 10000n, 100n, 0n],
    };
    expect((await readCollectionBlockSnapshot(contract, 1)).priceWei).toBe(150n);
    contract.getEffectiveBlockPrice.mockRejectedValue(new Error("RPC offline"));
    expect((await readCollectionBlockSnapshot(contract, 1)).priceWei).toBeNull();
  });

  it("keeps the minus sign when an owner lowers a current price", () => {
    expect(computeDiff(90, 100)).toMatchObject({
      value: expect.stringMatching(/^-10/),
      percent: expect.stringMatching(/^-10/),
      positive: false,
    });
  });

  it("keeps fractional averages and confirmed zero minted totals", () => {
    const prices = Array.from({ length: 10 }, (_, index) => (index + 1) * 100 + 0.25);
    expect(summarizeCollectionBlocks(prices, Array(10).fill(0))).toMatchObject({
      averagePrice: 550.25,
      totalMinted: 0,
      highestPrice: { index: 9, value: 1000.25 },
      lowestPrice: { index: 0, value: 100.25 },
    });
  });

  it.each([[], Array(10), Array(10).fill(null), [100, ...Array(9).fill(null)]].map(values => ({ values })))(
    "does not treat incomplete reads as collection totals or price extremes: %j",
    ({ values }) => {
      expect(summarizeCollectionBlocks(values, values)).toEqual({
        averagePrice: null, totalMinted: null,
        highestPrice: null, lowestPrice: null, topMinted: null,
      });
    },
  );
});
