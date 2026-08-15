import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChapterSeriesPanel from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.ChapterSeriesPanel.jsx";
import { ADDR } from "../src/shared/utils/addresses.js";

const readerData = {
  reader: ADDR.CHAPTER_SERIES_READER,
  global: {
    controller: ADDR.CHAPTER_CONTROLLER,
    registry: ADDR.SERIES_REGISTRY,
    seriesCount: "1",
    chapterCount: "1",
    controllerRegistry: ADDR.SERIES_REGISTRY,
    controllerMatchesRegistry: true,
  },
  collections: [
    {
      collection: ADDR.COLLECTION_VRF,
      chapterId: "1",
      seriesId: "1",
      chapterNumber: "1",
      tokenRewardsEligible: true,
      collectionRewardsEligible: true,
      isVrfCollection: true,
      isPublicCollection: false,
    },
    {
      collection: ADDR.COLLECTION_PUBLIC,
      chapterId: "1",
      seriesId: "1",
      chapterNumber: "1",
      tokenRewardsEligible: true,
      collectionRewardsEligible: false,
      isVrfCollection: false,
      isPublicCollection: true,
    },
  ],
  chapters: [
    {
      chapterId: "1",
      configured: true,
      chapterExists: true,
      seriesId: "1",
      chapterNumber: "1",
      vrfCollection: ADDR.COLLECTION_VRF,
      publicCollection: ADDR.COLLECTION_PUBLIC,
      ticketHub: ADDR.TICKET_HUB,
      saleCap: "0",
      marketingCap: "550",
      totalCap: "550",
      saleMinted: "0",
      marketingMinted: "50",
      totalMinted: "50",
      publicUnlocked: false,
      priceProvider: ADDR.COLLECTION_VRF,
      tokenRewardsEligibleVRF: true,
      tokenRewardsEligiblePublic: true,
      collectionRewardsEligibleVRF: true,
    },
  ],
  series: [
    {
      seriesId: "1",
      exists: true,
      name: "BIGGI MASTER Core Launch",
      chapterCount: "1",
    },
  ],
};

describe("collection chapter / series panel", () => {
  it("renders mainnet ChapterSeriesReader data without bad amount output", () => {
    const { container } = render(
      <ChapterSeriesPanel
        chapterSeries={readerData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Chapter / Series wiring")).toBeTruthy();
    expect(screen.getByText("Polygon mainnet / chainId 137")).toBeTruthy();
    expect(screen.getAllByText("BIGGI MASTER Core Launch").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Eligible").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Matched").length).toBeGreaterThan(1);
    expect(container.textContent).toContain("1 POL");
    expect(container.textContent).not.toMatch(/\d+(?:\.\d+)?e\+\d+/i);
    expect(container.textContent).not.toMatch(/amoy|mumbai|testnet|80002/i);
  });
});
