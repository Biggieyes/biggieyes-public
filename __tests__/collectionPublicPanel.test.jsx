import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Collection2Panel from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.Collection2Panel.jsx";

const makeBlocks = () =>
  Array.from({ length: 10 }, (_, index) => ({
    id: `block-${index + 1}`,
    name: `BLOCK ${index + 1}`,
    folder: "ORANGE",
    currentPrice: (index + 1) * 100,
    minted: index,
    hasData: true,
  }));

const readyTotals = {
  paused: false,
  chapterActive: true,
  metadataFullyConfigured: true,
  rewardMatrixConsistent: true,
  publicUnlocked: true,
  metadataConfiguredCount: 100,
  biggiMinted: 0,
  maxSupply: 100,
};

const readyArtwork = {
  imageUrl: "https://example.com/Biggi_44_BLUE_PUBLIC.png",
  name: "BiggiEyesPublic #44",
  finalized: true,
  valid: true,
  loading: false,
  error: "",
};

describe("public collection panel", () => {
  const renderReady = (overrides = {}) =>
    render(
      <Collection2Panel
        blockEntries={makeBlocks()}
        desiredTokenId="44"
        selectedBlock={5}
        selectedNftInfo={{
          configured: true,
          minted: false,
          background: 1,
          blockIdx: 5,
          mainId: "44",
        }}
        selectedArtwork={readyArtwork}
        COLLECTIONTotals={readyTotals}
        onTokenIdChange={vi.fn()}
        onBlockSelect={vi.fn()}
        onMint={vi.fn()}
        walletAccount="0x1234567890123456789012345678901234567890"
        walletChainId={137}
        mintState={{ status: "idle", message: "", txHash: "" }}
        {...overrides}
      />,
    );

  it("disables mint if the live price is unavailable", () => {
    const blocks = makeBlocks();
    blocks[4].currentPrice = null;
    renderReady({ blockEntries: blocks });
    expect(
      screen.getByRole("button", { name: "Price unavailable" }).disabled,
    ).toBe(true);
  });

  it("keeps the selection fixed while a transaction is pending", () => {
    const onTokenIdChange = vi.fn();
    const onBlockSelect = vi.fn();
    renderReady({
      onTokenIdChange,
      onBlockSelect,
      mintState: { status: "pending", index: 44 },
    });
    fireEvent.click(screen.getByRole("button", { name: "#47" }));
    fireEvent.click(screen.getByRole("button", { name: /BLOCK 8/ }));
    expect(onTokenIdChange).not.toHaveBeenCalled();
    expect(onBlockSelect).not.toHaveBeenCalled();
  });

  it("lets a user check a submitted transaction even after the contract pauses", () => {
    const onMint = vi.fn();
    renderReady({
      onMint,
      COLLECTIONTotals: { ...readyTotals, paused: true },
      mintState: {
        status: "unconfirmed",
        index: 44,
        txHash: `0x${"a".repeat(64)}`,
        message: "Confirmation unavailable",
      },
    });
    const button = screen.getByRole("button", {
      name: "Check transaction status",
    });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onMint).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "View transaction" }).href,
    ).toContain("polygonscan.com/tx/");
  });

  it("shows the exact 10 x 10 selection and paired Originals price", () => {
    const onTokenIdChange = vi.fn();
    const onBlockSelect = vi.fn();
    const onMint = vi.fn();
    const blocks = makeBlocks();

    const { container } = render(
      <Collection2Panel
        blockEntries={blocks}
        desiredTokenId="44"
        selectedBlock={5}
        selectedNftInfo={{
          configured: true,
          minted: false,
          background: 1,
          blockIdx: 5,
          mainId: "44",
        }}
        selectedNftLoading={false}
        selectedNftError={null}
        selectedArtwork={readyArtwork}
        COLLECTIONTotals={readyTotals}
        onTokenIdChange={onTokenIdChange}
        onBlockSelect={onBlockSelect}
        onMint={onMint}
        walletAccount="0x1234567890123456789012345678901234567890"
        walletChainId={137}
        mintState={{ status: "idle", message: "", txHash: "" }}
      />,
    );

    expect(screen.getAllByText("BLOCK 5").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("100 fixed NFTs");
    expect(container.textContent).toContain("10 NFTs per block");
    expect(container.textContent).toContain("No background choice");
    expect(container.textContent).toContain(
      "There are no selectable background variants",
    );
    expect(screen.getAllByText(/500[.,]00 POL/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "#41" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "#50" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "#40" })).toBeNull();
    expect(container.textContent).not.toContain("Background bonus");
    expect(container.textContent).not.toContain("+10%");

    fireEvent.click(screen.getByRole("button", { name: "#47" }));
    expect(onTokenIdChange).toHaveBeenCalledWith("47");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Mint NFT #44 for 500[.,]00 POL/,
      }),
    );
    expect(onMint).toHaveBeenCalledWith(44);
  });

  it("selects the first NFT when a different block is chosen", () => {
    const onBlockSelect = vi.fn();

    render(
      <Collection2Panel
        blockEntries={makeBlocks()}
        desiredTokenId="1"
        selectedBlock={1}
        selectedNftInfo={{
          configured: true,
          minted: false,
          background: 1,
          blockIdx: 1,
          mainId: "1",
        }}
        selectedNftLoading={false}
        selectedNftError={null}
        selectedArtwork={{ ...readyArtwork, name: "BiggiEyesPublic #1" }}
        COLLECTIONTotals={readyTotals}
        onTokenIdChange={vi.fn()}
        onBlockSelect={onBlockSelect}
        onMint={vi.fn()}
        walletAccount=""
        walletChainId={137}
        mintState={{ status: "idle", message: "", txHash: "" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /BLOCK 8/ }));
    expect(onBlockSelect).toHaveBeenCalledWith(8);
  });

  it("keeps mint disabled while the deployed contract is paused", () => {
    render(
      <Collection2Panel
        blockEntries={makeBlocks()}
        desiredTokenId="1"
        selectedBlock={1}
        selectedNftInfo={{
          configured: true,
          minted: false,
          background: 1,
          blockIdx: 1,
          mainId: "1",
        }}
        selectedNftLoading={false}
        selectedNftError={null}
        selectedArtwork={{ ...readyArtwork, name: "BiggiEyesPublic #1" }}
        COLLECTIONTotals={{ ...readyTotals, paused: true }}
        onTokenIdChange={vi.fn()}
        onBlockSelect={vi.fn()}
        onMint={vi.fn()}
        walletAccount="0x1234567890123456789012345678901234567890"
        walletChainId={137}
        mintState={{ status: "idle", message: "", txHash: "" }}
      />,
    );

    const button = screen.getByRole("button", { name: "Mint paused" });
    expect(button.disabled).toBe(true);
    expect(screen.getAllByText("Mint paused").length).toBeGreaterThan(0);
  });

  it("blocks minting while Public metadata still uses prereveal artwork", () => {
    render(
      <Collection2Panel
        blockEntries={makeBlocks()}
        desiredTokenId="1"
        selectedBlock={1}
        selectedNftInfo={{
          configured: true,
          minted: false,
          background: 1,
          blockIdx: 1,
          mainId: "1",
        }}
        selectedNftLoading={false}
        selectedNftError={null}
        selectedArtwork={{
          ...readyArtwork,
          name: "BiggiEyesPublic #1",
          finalized: false,
        }}
        COLLECTIONTotals={readyTotals}
        onTokenIdChange={vi.fn()}
        onBlockSelect={vi.fn()}
        onMint={vi.fn()}
        walletAccount="0x1234567890123456789012345678901234567890"
        walletChainId={137}
        mintState={{ status: "idle", message: "", txHash: "" }}
      />,
    );

    const button = screen.getByRole("button", { name: "Artwork pending" });
    expect(button.disabled).toBe(true);
    expect(screen.getAllByText("Prereveal placeholder").length).toBeGreaterThan(
      0,
    );
  });
});
