import { describe, expect, it } from "vitest";

import {
  mergeGalleryItem,
  mergeGalleryLists,
} from "../src/shared/services/gallery/gallery.merge.js";
import { buildRewardClaimPayload } from "../src/shared/utils/assetIdentity.js";
import { CORE_CHAPTERS } from "../src/shared/utils/addresses.js";

const MAIN = "0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4";
const MAIN2 = "0xe56cC0657A89daf10994204eD745985a61b0E36F";
const PLACEHOLDER = "/images/Biggi.png";

describe("gallery mainnet consistency", () => {
  it("does not replace a resolved NFT image with the placeholder during refresh", () => {
    const previous = {
      tokenId: "42",
      contractAddress: MAIN,
      image: "https://gateway.pinata.cloud/ipfs/bafy-real/42.png",
      meta: {
        name: "Biggi #42",
        attributes: [{ trait_type: "Block", value: "ORANGE" }],
      },
      isTicket: false,
      isPending: false,
    };

    const incoming = {
      tokenId: "42",
      contractAddress: MAIN,
      image: PLACEHOLDER,
      meta: { description: "Metadata is updating on-chain." },
      isTicket: false,
    };

    const merged = mergeGalleryItem(previous, incoming);

    expect(merged.image).toBe(previous.image);
    expect(merged.meta.name).toBe("Biggi #42");
    expect(merged.meta.description).toBe("Metadata is updating on-chain.");
    expect(merged.isTicket).toBe(false);
  });

  it("keeps equal token IDs from different mainnet collections separate", () => {
    const merged = mergeGalleryLists(
      [
        {
          tokenId: "7",
          contractAddress: MAIN,
          image: "https://example.com/main-7.png",
          meta: { name: "Main #7" },
          isTicket: false,
        },
      ],
      [
        {
          tokenId: "7",
          contractAddress: MAIN2,
          image: "https://example.com/main2-7.png",
          meta: { name: "Main2 #7" },
          isTicket: false,
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(
      merged.map(
        (item) => `${item.contractAddress.toLowerCase()}::${item.tokenId}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        `${MAIN.toLowerCase()}::7`,
        `${MAIN2.toLowerCase()}::7`,
      ]),
    );
  });

  it("builds collection-aware token rewards payload for multi-collection NFT claims", () => {
    const chapterFiveMain = CORE_CHAPTERS[4].main;
    const payload = buildRewardClaimPayload(
      [
        {
          tokenId: "7",
          contractAddress: MAIN,
          isTicket: false,
        },
        {
          tokenId: "7",
          contractAddress: MAIN2,
          isTicket: false,
        },
        {
          tokenId: "7",
          contractAddress: chapterFiveMain,
          isTicket: false,
        },
        {
          tokenId: "1000000000000000000000000000001",
          contractAddress: MAIN,
          isTicket: false,
        },
        {
          tokenId: "8",
          contractAddress: MAIN,
          isTicket: true,
        },
      ],
      {
        primaryCollectionAddress: MAIN,
        allowedCollectionAddresses: CORE_CHAPTERS.flatMap((chapter) => [
          chapter.main,
          chapter.main2,
        ]),
        maxSupply: 550,
      },
    );

    expect(payload.trackedCount).toBe(3);
    expect(payload.tokenIds.map((id) => id.toString())).toEqual([
      "7",
      "7",
      "7",
    ]);
    expect(payload.collections).toEqual([
      MAIN.toLowerCase(),
      MAIN2.toLowerCase(),
      chapterFiveMain.toLowerCase(),
    ]);
    expect(payload.hasTokenIdCollisions).toBe(true);
    expect(payload.shouldUseCollectionAware).toBe(true);
  });
});
