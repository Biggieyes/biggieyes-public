import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/hooks/useVRF", () => ({
  useVRF: () => ({
    refreshVRFPanel: vi.fn(async () => null),
  }),
}));

import VRFPanel from "../src/features/vrf/VRFPanel.jsx";
import { ADDR } from "../src/shared/utils/addresses.js";

const panelData = {
  chainId: 137,
  userAddress: ADDR.DEV_WALLET,
  subscription: {
    id: ADDR.VRF_SUB_ID,
    expectedId: ADDR.VRF_SUB_ID,
    matches: true,
  },
  params: {
    collection: ADDR.COLLECTION_VRF,
    ticketHub: ADDR.TICKET_HUB,
    vrfRouter: ADDR.VRF_ROUTER,
    coordinator: ADDR.VRF_COORDINATOR,
    coordinatorLive: ADDR.VRF_COORDINATOR,
    expectedCoordinator: ADDR.VRF_COORDINATOR,
    coordinatorMatches: true,
    keyHash: ADDR.VRF_KEY_HASH,
    keyHashLive: ADDR.VRF_KEY_HASH,
    expectedKeyHash: ADDR.VRF_KEY_HASH,
    keyHashMatches: true,
    confirmations: 3,
    numWords: 1,
    callbackGasLimit: 300000,
    retryPendingSupported: false,
  },
  last: {
    requestId: "123456789",
    status: "fulfilled",
    requestedAt: "6/21/2026, 10:00:00 AM",
    txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    blockNumber: 88274808,
    randomWords: ["42"],
  },
  history: [
    {
      time: "6/21/2026, 10:00:00 AM",
      requestId: "123456789",
      status: "fulfilled",
      confirmations: 3,
      words: 1,
      tx: "0x1111111111111111111111111111111111111111111111111111111111111111",
      blockNumber: 88274808,
      randomWords: ["42"],
    },
  ],
};

describe("VRF panel mainnet consistency", () => {
  it("renders Polygon mainnet wiring without stale testnet or legacy VRF labels", () => {
    const { container } = render(
      <VRFPanel
        data={panelData}
        walletAddress={ADDR.DEV_WALLET}
        onRefresh={vi.fn(async () => panelData)}
        onRequestRandomness={vi.fn()}
      />,
    );

    expect(container.textContent).toContain("Polygon mainnet (137)");
    expect(container.textContent).not.toMatch(
      /BiggiEyesMain|\bCRE\b|Amoy|Mumbai|testnet|80002|sepolia/i,
    );

    fireEvent.click(screen.getByRole("tab", { name: /VRF Health/i }));

    expect(screen.getByText("Mainnet Wiring")).toBeTruthy();
    expect(screen.getByText("Collection VRF")).toBeTruthy();
    expect(screen.getByText("TicketHub")).toBeTruthy();
    expect(screen.getByText("VRF Router")).toBeTruthy();
    expect(screen.getAllByText("OK").length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).not.toMatch(
      /BiggiEyesMain|\bCRE\b|Amoy|Mumbai|testnet|80002|sepolia/i,
    );
  });
});
