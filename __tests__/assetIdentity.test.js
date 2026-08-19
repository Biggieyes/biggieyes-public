import { describe, expect, it } from "vitest";

import {
  getAssetIdentity,
  getAssetReference,
  getAssetTokenId,
  isAssetReferenceMatch,
  normalizeAssetContractAddress,
} from "../src/shared/utils/assetIdentity.js";

describe("asset identity", () => {
  it("keeps equal token IDs from different collection contracts distinct", () => {
    const first = getAssetIdentity({
      contractAddress: "0xAa00000000000000000000000000000000000001",
      tokenId: 10001n,
    });
    const second = getAssetIdentity({
      contractAddress: "0xBb00000000000000000000000000000000000002",
      tokenId: 10001n,
    });

    expect(first).not.toBe(second);
    expect(first).toBe(
      "0xaa00000000000000000000000000000000000001:10001",
    );
  });

  it("normalizes token and contract values", () => {
    expect(getAssetTokenId({ id: " 42 " })).toBe("42");
    expect(normalizeAssetContractAddress(" 0xABC ")).toBe("0xabc");
    expect(getAssetIdentity({ tokenId: 42 }, "0xABC")).toBe("0xabc:42");
  });

  it("matches composite references without confusing equal cross-collection IDs", () => {
    const first = {
      collectionAddress: "0xAa00000000000000000000000000000000000001",
      tokenId: "42",
    };
    const second = {
      contractAddress: "0xBb00000000000000000000000000000000000002",
      tokenId: "42",
    };
    const reference = getAssetReference(first);

    expect(reference).toBe(
      "0xaa00000000000000000000000000000000000001:42",
    );
    expect(isAssetReferenceMatch(first, reference)).toBe(true);
    expect(isAssetReferenceMatch(second, reference)).toBe(false);
    expect(isAssetReferenceMatch(second, "42")).toBe(true);
  });
});
