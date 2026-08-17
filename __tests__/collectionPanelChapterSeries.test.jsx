import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChapterSeriesPanel from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.ChapterSeriesPanel.jsx";
import { ADDR, CORE_CHAPTERS } from "../src/shared/utils/addresses.js";

const readerData = {
  reader: ADDR.CHAPTER_SERIES_READER,
  global: {
    controller: ADDR.CHAPTER_CONTROLLER,
    registry: ADDR.SERIES_REGISTRY,
    seriesCount: "5",
    chapterCount: "5",
    controllerRegistry: ADDR.SERIES_REGISTRY,
    controllerMatchesRegistry: true,
  },
  collections: CORE_CHAPTERS.flatMap((chapter) => [
    {
      collection: chapter.main,
      chapterId: String(chapter.chapterId),
      seriesId: String(chapter.seriesId),
      chapterNumber: String(chapter.chapterId),
      tokenRewardsEligible: true,
      collectionRewardsEligible: true,
      isVrfCollection: true,
      isPublicCollection: false,
    },
    {
      collection: chapter.main2,
      chapterId: String(chapter.chapterId),
      seriesId: String(chapter.seriesId),
      chapterNumber: String(chapter.chapterId),
      tokenRewardsEligible: true,
      collectionRewardsEligible: false,
      isVrfCollection: false,
      isPublicCollection: true,
    },
  ]),
  chapters: CORE_CHAPTERS.map((chapter) => ({
    chapterId: String(chapter.chapterId),
    configured: true,
    chapterExists: true,
    active: false,
    seriesId: String(chapter.seriesId),
    chapterNumber: String(chapter.chapterId),
    vrfCollection: chapter.main,
    publicCollection: chapter.main2,
    ticketHub: ADDR.TICKET_HUB,
    saleCap: "500",
    marketingCap: "50",
    totalCap: "550",
    saleMinted: "0",
    marketingMinted: "50",
    totalMinted: "50",
    publicUnlocked: false,
    priceProvider: chapter.main,
    tokenRewardsEligibleVRF: true,
    tokenRewardsEligiblePublic: true,
    collectionRewardsEligibleVRF: true,
  })),
  series: CORE_CHAPTERS.map((chapter) => ({
    seriesId: String(chapter.seriesId),
    exists: true,
    name: chapter.seriesName,
    chapterCount: "1",
  })),
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
    expect(screen.getByText("BIGGI MASTER Core Launch")).toBeTruthy();
    for (const chapter of CORE_CHAPTERS) {
      expect(
        screen.getByText(
          `Chapter ${chapter.chapterId}: ${chapter.displayName}`,
        ),
      ).toBeTruthy();
    }
    expect(screen.getAllByText("Eligible").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Matched").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Not active")).toHaveLength(5);
    expect(container.textContent).toContain("Available chapters0 / 5");
    expect(container.textContent).toMatch(
      /250 \/ 2[\s\u00a0]750 tickets minted/,
    );
    expect(container.textContent).not.toContain("Active pair");
    expect(container.textContent).toContain("1 POL");
    expect(container.textContent).not.toMatch(/\d+(?:\.\d+)?e\+\d+/i);
    expect(container.textContent).not.toMatch(/amoy|mumbai|testnet|80002/i);
  });
});
