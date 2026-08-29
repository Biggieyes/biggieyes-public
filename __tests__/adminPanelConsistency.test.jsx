import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/abi/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, BiggiCommunityCenter: [] };
});

vi.mock("@/components/AdminDashboard", () => ({
  default: () => <div>Moderator dashboard mock</div>,
}));

vi.mock("@/shared/services/communityVotingApi.js", () => ({
  fetchCommunityPolls: vi.fn(async () => ({ polls: [] })),
  submitCommunityPollAdminAction: vi.fn(),
}));

vi.mock("../src/services/chatClient.js", () => ({
  supabase: null,
  supabaseReady: false,
}));

import AdminPanel from "../src/components/admin/AdminPanel.jsx";

const OWNER = "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2";

const data = {
  owner: OWNER,
  chainId: 137,
  networkLabel: "Polygon (137)",
  contractAddress: "0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4",
  publicContractAddress: "0xe56cC0657A89daf10994204eD745985a61b0E36F",
  totalSupply: 0,
  maxSupply: 550,
  ticketPrice: 500,
  ticketHub: {
    address: "0x7b7e561173f498C8274b821090Da64E8ee653f6A",
    paused: true,
    activeChapterId: null,
    activeChapterCount: 0,
    saleMinted: 0,
    saleCap: 500,
    marketingMinted: 50,
    marketingCap: 50,
  },
  chapters: [
    {
      chapterId: 1,
      displayName: "Original",
      main: "0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4",
      main2: "0xe56cC0657A89daf10994204eD745985a61b0E36F",
      active: false,
    },
  ],
  dex: {},
  VRF: {},
  frontend: { wallet: OWNER },
};

describe("AdminPanel mainnet consistency", () => {
  it("shows the TicketHub and chapter registry in the Core snapshot", () => {
    render(<AdminPanel open data={data} actions={{}} onClose={vi.fn()} />);

    expect(screen.getByText("Active VRF collection")).toBeInTheDocument();
    expect(screen.getByText("TicketHub paused")).toBeInTheDocument();
    expect(screen.getByText("Chapter registry")).toBeInTheDocument();
    expect(screen.getByText("1. Original")).toBeInTheDocument();
  });

  it("keeps owner ops, voting, and events together in Community", async () => {
    render(<AdminPanel open data={data} actions={{}} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Community" }));

    expect(
      screen.getByRole("heading", { name: "Community Center Owner Ops" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Community Voting" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Community Center Events" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Liquidity Controls" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "POLICY Controls" }),
    ).not.toBeInTheDocument();
  });
});
