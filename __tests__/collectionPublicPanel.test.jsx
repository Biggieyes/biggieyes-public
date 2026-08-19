import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Collection2Panel from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.Collection2Panel.jsx";

describe("public collection panel", () => {
  it("shows fixed NFT metadata and the exact paired VRF block price", () => {
    const blocks = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: `BLOCK ${index + 1}`,
      currentPrice: (index + 1) * 100,
      minted: 0,
      hasData: true,
    }));

    const { container } = render(
      <Collection2Panel
        renderBlockCardsGrid={() => null}
        blockEntries={blocks}
        desiredTokenId="44"
        selectedEntry={blocks[2]}
        selectedNftInfo={{
          configured: true,
          minted: false,
          background: 1,
          blockIdx: 3,
          mainId: "44",
        }}
        selectedNftLoading={false}
        selectedNftError={null}
        COLLECTIONTotals={{
          paused: false,
          chapterActive: true,
          metadataFullyConfigured: true,
          publicUnlocked: true,
          metadataConfiguredCount: 100,
          biggiMinted: 0,
          maxSupply: 100,
        }}
        onTokenIdChange={vi.fn()}
      />,
    );

    expect(screen.getByText("BLOCK 3")).toBeTruthy();
    expect(container.textContent).toContain(
      "Public NFTs do not use background variants",
    );
    expect(container.textContent).not.toContain("BackgroundBLACK");
    expect(screen.getByText(/300[.,]00 POL/)).toBeTruthy();
    expect(screen.getAllByText("Available")).toHaveLength(2);
    expect(container.textContent).not.toContain("Background bonus");
    expect(container.textContent).not.toContain("+10%");
  });
});
