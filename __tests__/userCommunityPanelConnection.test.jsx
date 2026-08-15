import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import USERPANEL from "../src/features/user/USERPANEL.jsx";
import { ADDR } from "../src/shared/utils/addresses.js";

const mocks = vi.hoisted(() => {
  const balanceProvider = {
    getBalance: vi.fn(async () => 2_000_000_000_000_000_000n),
  };
  return {
    web3: {
      account: "0x8fa5C9545B2eEF1ca3c6533951C286e05928f27B",
      chainId: 137,
      connectMetaMask: vi.fn(),
      isConnecting: false,
      provider: balanceProvider,
    },
    contracts: {
      _effectiveROProvider: () => balanceProvider,
      mainRead: () => ({
        balanceOf: vi.fn(async () => 3n),
      }),
      tokenRead: () => ({
        balanceOf: vi.fn(async () => 123_450_000_000_000_000_000n),
        decimals: vi.fn(async () => 18),
      }),
      readerRead: () => ({
        findTicket: vi.fn(async () => [1n]),
      }),
    },
    communityRefresh: vi.fn(),
  };
});

vi.mock("@/providers/Web3Provider", () => ({
  useWeb3: () => mocks.web3,
}));

vi.mock("@/providers/ContractsProvider", () => ({
  useContracts: () => mocks.contracts,
}));

vi.mock("@/hooks/useCommunityCenterUserSnapshot.js", () => ({
  __esModule: true,
  default: () => ({
    snapshot: {
      address: ADDR.COMMUNITY_CENTER,
      configured: true,
      paused: false,
      poolBalance: 9_000_000_000_000_000_000n,
      totalLocked: 4_000_000_000_000_000_000n,
      eventsCount: 4,
      assignedEvents: 2,
      claimableEvents: 1,
      assignedAmount: 3_000_000_000_000_000_000n,
      claimableAmount: 1_250_000_000_000_000_000n,
      livePolls: 2,
    },
    loading: false,
    error: null,
    refresh: mocks.communityRefresh,
  }),
}));

describe("User Panel community connection", () => {
  it("renders Community Center mainnet user data and keeps token claims in BIGGI", async () => {
    const { container } = render(
      <USERPANEL
        claimable="5"
        ticketPrice="1"
        rewardPool="10"
        mintVolumeMatic="25"
        minted={10}
        maxSupply={100}
        ticketsLeft={90}
      />,
    );

    expect(screen.getAllByText("Community Center").length).toBeGreaterThan(0);
    expect(screen.getByText("Claimable POL")).toBeInTheDocument();
    expect(container.textContent).toContain("1.25 POL");
    expect(container.textContent).toContain("5 BIGGI");
    expect(container.textContent).not.toContain("Claimable5 POL");
    expect(container.textContent).not.toMatch(/e\+/i);

    await waitFor(() => {
      expect(container.textContent).toContain("123.45 BIGGI");
      expect(container.textContent).toContain("2 POL");
    });
  });
});
