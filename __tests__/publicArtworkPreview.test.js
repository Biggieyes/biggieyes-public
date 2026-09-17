import { describe, expect, it } from "vitest";
import { getPublicArtworkPreview } from "../src/features/rewards/COLLECTION/publicArtworkPreview.js";
import publishedRelease from "../src/features/rewards/COLLECTION/publicOriginalsArtwork.json";

const release = {
  chainId: 137,
  chapterId: 1,
  contract: `0x${"a".repeat(40)}`,
  sourceMetadataCid: "source",
  metadataCid: "metadata",
  imagesCid: "images",
  missingIds: [29, 30],
  webpIds: [15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28],
};
const input = (id = 1, color = "ORANGE") => ({
  release,
  chainId: 137,
  chapterId: 1,
  contractAddress: release.contract,
  index: id,
  artwork: {
    valid: true,
    finalized: false,
    metadataUri: `ipfs://source/Biggi_${id}_${color}_PUBLIC.json`,
  },
});

describe("Public artwork prerelease isolation", () => {
  it.each([29, 30])(
    "includes the completed white artwork #%s in the current release",
    (id) => {
      const args = input(id, "WHITE");
      args.release = publishedRelease;
      args.contractAddress = publishedRelease.contract;
      args.artwork.metadataUri = `ipfs://${publishedRelease.sourceMetadataCid}/Biggi_${id}_WHITE_PUBLIC.json`;
      expect(publishedRelease.missingIds).toEqual([]);
      expect(getPublicArtworkPreview(args)).toEqual({
        imageUri: `ipfs://${publishedRelease.imagesCid}/Biggi_${id}_WHITE_PUBLIC.webp`,
        metadataUri: `ipfs://${publishedRelease.metadataCid}/Biggi_${id}_WHITE_PUBLIC.json`,
        awaitingArtwork: false,
      });
      expect(args.artwork.finalized).toBe(false);
    },
  );
  it("resolves a pinned PNG without marking on-chain metadata final", () => {
    const args = input();
    expect(getPublicArtworkPreview(args)).toEqual({
      imageUri: "ipfs://images/Biggi_1_ORANGE_PUBLIC.png",
      metadataUri: "ipfs://metadata/Biggi_1_ORANGE_PUBLIC.json",
      awaitingArtwork: false,
    });
    expect(args.artwork.finalized).toBe(false);
  });
  it("preserves WebP extensions instead of pretending the file is PNG", () => {
    expect(getPublicArtworkPreview(input(23, "WHITE")).imageUri).toBe(
      "ipfs://images/Biggi_23_WHITE_PUBLIC.webp",
    );
  });
  it.each([29, 30])("keeps missing NFT #%s pending", (id) => {
    expect(getPublicArtworkPreview(input(id, "WHITE"))).toMatchObject({
      awaitingArtwork: true,
      imageUri: "",
    });
  });
  it.each([
    { chainId: 80002 },
    { chapterId: 2 },
    { contractAddress: `0x${"b".repeat(40)}` },
    { contractAddress: undefined },
    { index: 0 },
    { index: 101 },
    { index: 1.5 },
  ])(
    "does not cross contract, chain, chapter or ID boundaries: %j",
    (change) => {
      expect(getPublicArtworkPreview({ ...input(), ...change })).toBeNull();
    },
  );
  it.each([
    { valid: false },
    { finalized: true },
    { finalized: null },
    { metadataUri: "ipfs://another-release/Biggi_1_ORANGE_PUBLIC.json" },
    { metadataUri: "ipfs://source/Biggi_2_ORANGE_PUBLIC.json" },
  ])(
    "never overrides finalized, unrelated or unverified metadata: %j",
    (change) => {
      const args = input();
      args.artwork = { ...args.artwork, ...change };
      expect(getPublicArtworkPreview(args)).toBeNull();
    },
  );
});
