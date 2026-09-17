import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Gallery from "../src/components/Gallery.jsx";
import NftCard from "../src/components/NftCard.jsx";
import { addNftToMetaMask } from "../src/lib/addNftToMetaMask";

vi.mock("../src/providers/ContractsContext.js", () => ({
  useOptionalContracts: () => null,
}));
vi.mock("../src/lib/addNftToMetaMask", () => ({ addNftToMetaMask: vi.fn() }));
const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MAIN = "0x1111111111111111111111111111111111111111";
const TICKETS = "0x2222222222222222222222222222222222222222";
const meta = (name) => ({
  name,
  image: "/images/Biggi.png",
  attributes: [
    { trait_type: "Chapter", value: "1" },
    { trait_type: "Eye Color", value: "Orange" },
  ],
});
beforeEach(() => {
  vi.mocked(addNftToMetaMask).mockReset().mockResolvedValue(true);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NFT import in gallery previews", () => {
  it("renders import for both NFTs and tickets with their own contracts and owner", async () => {
    const { container } = render(
      <Gallery
        address={OWNER}
        useProvidedOnly
        items={[
          {
            tokenId: "1001",
            contractAddress: MAIN,
            isTicket: false,
            chapterId: 1,
            meta: meta("My NFT"),
          },
          {
            tokenId: "3",
            contractAddress: TICKETS,
            isTicket: true,
            chapterId: 1,
            meta: meta("My ticket"),
          },
        ]}
      />,
    );
    const buttons = await screen.findAllByRole("button", {
      name: "Import",
      exact: true,
    });
    expect(buttons).toHaveLength(2);
    for (const [title, address, tokenId] of [
      ["My NFT", MAIN, "1001"],
      ["My ticket", TICKETS, "3"],
    ]) {
      const card = screen
        .getByRole("heading", { name: title })
        .closest(".nft-card");
      fireEvent.click(
        within(card).getByRole("button", { name: "Import", exact: true }),
      );
      await within(card).findByRole("button", { name: "Re-import" });
      expect(addNftToMetaMask).toHaveBeenLastCalledWith(
        expect.objectContaining({
          contractAddress: address,
          tokenId,
          expectedAccount: OWNER,
          chainId: "0x89",
        }),
      );
    }
    expect(
      container.querySelector(".nft-card__figure .import-button"),
    ).toBeNull();
  });

  it("keeps pending VRF placeholders non-importable", () => {
    render(
      <NftCard
        nft={{
          tokenId: "4",
          contractAddress: MAIN,
          isTicket: true,
          isPending: true,
          meta: meta("Pending"),
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Import", exact: true }),
    ).not.toBeInTheDocument();
  });

  it("uses a provided collection address and id instead of the fallback collection", async () => {
    render(
      <NftCard
        fallbackContractAddress={MAIN}
        ownerAddress={OWNER}
        nft={{
          id: "3",
          collectionAddress: TICKETS,
          isTicket: true,
          meta: meta("Alias ticket"),
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Import", exact: true }),
    );
    await screen.findByRole("button", { name: "Re-import" });
    expect(addNftToMetaMask).toHaveBeenCalledWith(
      expect.objectContaining({ contractAddress: TICKETS, tokenId: "3" }),
    );
  });
});
