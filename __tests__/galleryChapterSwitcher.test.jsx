import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import Gallery from "../src/components/Gallery.jsx";
import { ADDR, CORE_CHAPTERS } from "../src/shared/utils/addresses.js";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
  });
});

const nft = (name, contractAddress, chapterId, collectionType) => ({
  tokenId: "11",
  contractAddress,
  chapterId,
  collectionType,
  image: `https://example.com/${name.toLowerCase().replaceAll(" ", "-")}.png`,
  meta: {
    name,
    attributes: [{ trait_type: "Block", value: "ORANGE" }],
  },
  isTicket: false,
});

describe("gallery chapter switcher", () => {
  it("marks the exact collection asset as the latest mint when token IDs collide", async () => {
    vi.useFakeTimers();
    const originals = CORE_CHAPTERS[0];
    const items = [
      nft("Originals VRF", originals.main, originals.chapterId, "vrf"),
      nft("Originals Public", originals.main2, originals.chapterId, "public"),
    ];

    try {
      render(
        <Gallery
          address="0x0000000000000000000000000000000000000001"
          items={items}
          topFirstId={`${originals.main2.toLowerCase()}:11`}
          useProvidedOnly
        />,
      );
      await act(async () => {});

      const marker = screen.getByText("Latest mint");
      const markedCard = marker.closest("article");
      expect(markedCard).toHaveTextContent("Originals Public");
      expect(markedCard).not.toHaveTextContent("Originals VRF");
      expect(screen.getAllByText("Latest mint")).toHaveLength(1);

      act(() => vi.advanceTimersByTime(70_001));
      expect(screen.getByText("Latest mint")).toBeInTheDocument();
      expect(markedCard).not.toHaveClass("nft-card--highlight");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows TicketHub, VRF, and Public assets together for the selected chapter", () => {
    const universe = CORE_CHAPTERS[1];
    const mutant = CORE_CHAPTERS[2];
    const items = [
      nft("Universe VRF", universe.main, universe.chapterId, "vrf"),
      nft("Universe Public", universe.main2, universe.chapterId, "public"),
      nft("Mutant VRF", mutant.main, mutant.chapterId, "vrf"),
      {
        tokenId: "1000000000000000000000000000201",
        contractAddress: ADDR.TICKET_HUB,
        chapterId: universe.chapterId,
        image: "https://example.com/universe-ticket.png",
        meta: {
          name: "Universe Ticket",
          attributes: [{ trait_type: "Chapter", value: 2 }],
        },
        isTicket: true,
      },
    ];

    render(
      <Gallery
        address="0x0000000000000000000000000000000000000001"
        items={items}
        useProvidedOnly
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /Universe, chapter 2, 3 assets/i,
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Universe VRF")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Universe, chapter 2, 3 assets/i,
      }),
    );

    expect(screen.getByText("Universe Ticket")).toBeTruthy();
    expect(screen.getByText("Universe VRF")).toBeTruthy();
    expect(screen.getByText("Universe Public")).toBeTruthy();
    expect(screen.queryByText("Mutant VRF")).toBeNull();
    expect(screen.getByText("VRF + Public / 2 total")).toBeTruthy();
  });
});
