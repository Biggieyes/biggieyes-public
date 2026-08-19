import { describe, expect, it } from "vitest";
import {
  buildLiveStatsAssetIdentity,
  selectLiveStatsImage,
} from "@/components/liveStatsImageState.js";

describe("LiveStats image selection", () => {
  it("separates equal token IDs from different chapter contracts", () => {
    expect(buildLiveStatsAssetIdentity("0xAAA", "1")).toBe("0xaaa:1");
    expect(buildLiveStatsAssetIdentity("0xBBB", "1")).toBe("0xbbb:1");
    expect(buildLiveStatsAssetIdentity("0xAAA", "1")).not.toBe(
      buildLiveStatsAssetIdentity("0xBBB", "1"),
    );
  });

  it("does not reuse an image when the current collection has no NFT", () => {
    expect(
      selectLiveStatsImage({
        tokenId: "-",
        directImage: "https://example.test/old.png",
        directTokenId: "42",
        stableImage: "https://example.test/old.png",
        stableTokenId: "42",
      }),
    ).toBe("");
  });

  it("rejects direct and stable images belonging to another token", () => {
    expect(
      selectLiveStatsImage({
        tokenId: "43",
        directImage: "https://example.test/42.png",
        directTokenId: "42",
        stableImage: "https://example.test/42.png",
        stableTokenId: "42",
      }),
    ).toBe("");
  });

  it("uses a cached image scoped to the current token", () => {
    expect(
      selectLiveStatsImage({
        tokenId: "43",
        cachedImage: "https://example.test/43.png",
      }),
    ).toBe("https://example.test/43.png");
  });
});
