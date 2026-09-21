import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Collection1Panel from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.Collection1Panel.jsx";

const BLOCK_NAMES = [
  "ORANGE",
  "BLACK",
  "WHITE",
  "BROWN",
  "BLUE",
  "GREEN",
  "VIOLET",
  "RED",
  "PINK",
  "RAINBOW",
];

const makeBlocks = (minted = {}) =>
  BLOCK_NAMES.map((name, index) => ({
    id: `block-${index + 1}`,
    name,
    hasData: true,
    minted: Object.hasOwn(minted, name) ? minted[name] : 0,
    currentPrice: (index + 1) * 100,
    basePrice: (index + 1) * 100,
  }));

const renderPanel = (overrides = {}) =>
  render(
    <Collection1Panel
      renderBlockCardsGrid={() => null}
      renderChapterSwitcher={() => null}
      blockEntries={makeBlocks({ BLUE: 5 })}
      stats={{ totalMinted: 5 }}
      mintedSupply={5}
      maxSupply={550}
      paused={false}
      chapterId={1}
      chapterName="Originals"
      {...overrides}
    />,
  );

describe("Originals collection statistics", () => {
  it("shows VRF supply, remaining NFTs, the leading eye color, and status", () => {
    renderPanel();

    expect(screen.getByText("NFTs minted")).toBeInTheDocument();
    expect(screen.getByText("5 / 550")).toBeInTheDocument();
    expect(screen.getByText("NFTs remaining")).toBeInTheDocument();
    expect(screen.getByText("545")).toBeInTheDocument();
    expect(screen.getByText("Most drawn eye color")).toBeInTheDocument();
    expect(screen.getAllByText("BLUE").length).toBeGreaterThan(0);
    expect(screen.getByText("5 NFTs drawn")).toBeInTheDocument();
    expect(screen.getByText("VRF collection")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    expect(screen.queryByText("Blocks configured")).not.toBeInTheDocument();
    expect(screen.queryByText("Average price")).not.toBeInTheDocument();
    expect(screen.queryByText("Price spread")).not.toBeInTheDocument();
  });

  it("does not present missing chain data as zero", () => {
    renderPanel({
      blockEntries: makeBlocks(
        Object.fromEntries(BLOCK_NAMES.map((name) => [name, null])),
      ),
      stats: { totalMinted: null },
      mintedSupply: null,
      maxSupply: null,
      paused: null,
    });

    expect(screen.getByText("Waiting for Polygon data")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText("Reading the Polygon contract")).toBeInTheDocument();
  });
});
