import { describe, expect, it, vi } from "vitest";

import {
  computeDiff,
  isExplicitlyEmptyContractCode,
  normalizeMetadataConsistency,
  normalizeNftInfo,
  readCollectionBlockSnapshot,
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
      mintedRaw: 9n,
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
});
