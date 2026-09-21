import { describe, expect, it } from "vitest";
import { buildRewardClaimPayload } from "../src/shared/utils/assetIdentity.js";

const oldMain = "0x1111111111111111111111111111111111111111";
const newMain = "0x2222222222222222222222222222222222222222";
const publicMain = "0x3333333333333333333333333333333333333333";
const options = {
  primaryCollectionAddress: oldMain,
  allowedCollectionAddresses: [oldMain, newMain, publicMain],
  maxSupply: 550,
};
const nft = (tokenId, contractAddress = newMain) => ({ tokenId, contractAddress });

describe("reward claim token identity after a VRF collection replacement", () => {
  it("passes actual ERC721 token IDs, not metadata indices, to claim calls", () => {
    const result = buildRewardClaimPayload([nft("1001"), nft("1550")], options);
    expect(result.tokenIds).toEqual([1001n, 1550n]);
    expect(result.collections).toEqual([newMain, newMain]);
    expect(result.shouldUseCollectionAware).toBe(true);
  });

  it("does not collapse a legacy token and a canonical token into one claim", () => {
    const result = buildRewardClaimPayload([nft("1"), nft("1001"), nft("1001")], options);
    expect(result.tokenIds).toEqual([1n, 1001n]);
    expect(result.trackedCount).toBe(2);
  });

  it("keeps matching token IDs from different collections distinct", () => {
    const result = buildRewardClaimPayload([nft("1001"), nft("1001", publicMain)], options);
    expect(result.tokenIds).toEqual([1001n, 1001n]);
    expect(result.collections).toEqual([newMain, publicMain]);
    expect(result.hasTokenIdCollisions).toBe(true);
  });

  it("excludes characters, rewards, pending NFTs, tickets and malformed IDs", () => {
    const result = buildRewardClaimPayload([
      nft("2001"), nft("3001"), nft("1551"), nft("0"), nft("NaN"),
      { ...nft("1001"), isPending: true }, { ...nft("1"), isTicket: true },
    ], options);
    expect(result.tokenIds).toEqual([]);
    expect(result.trackedCount).toBe(0);
  });
});
