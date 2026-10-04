import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPanel mainnet consistency", () => {
  it("fails closed when the connected wallet is not the configured owner", () => {
    const onClose = vi.fn();
    render(
      <AdminPanel
        open
        data={{
          ...data,
          frontend: {
            wallet: "0x8fa5C9545B2eEF1ca3c6533951C286e05928f27B",
          },
        }}
        actions={{}}
        onClose={onClose}
      />,
    );

    expect(
      screen.queryByRole("dialog", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the TicketHub and chapter registry in the Core snapshot", () => {
    render(<AdminPanel open data={data} actions={{}} onClose={vi.fn()} />);

    expect(screen.getByText("Active VRF collection")).toBeInTheDocument();
    expect(screen.getByText("TicketHub paused")).toBeInTheDocument();
    expect(screen.getByText("Chapter registry")).toBeInTheDocument();
    expect(screen.getByText("1. Original")).toBeInTheDocument();
  });

  it("runs a manual read refresh exactly once", async () => {
    const refresh = vi.fn(async () => {});
    render(
      <AdminPanel
        open
        data={data}
        actions={{ refresh }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Reload on-chain snapshot"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
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

  it("loads admin chat through the server API without browser Supabase credentials", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        rulesText: "Use verified project links only.",
        messages: [
          {
            id: 7,
            author_address: OWNER,
            author_name: "BiggiEyes",
            content: "Official update",
            created_at: "2026-09-21T10:00:00.000Z",
            edited_at: null,
            deleted: false,
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPanel open data={data} actions={{}} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Live Chat" }));

    expect(
      await screen.findAllByText("Use verified project links only."),
    ).toHaveLength(2);
    expect(screen.getByText("Official update")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat-bootstrap",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });
});
