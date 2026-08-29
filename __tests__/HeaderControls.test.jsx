import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HeaderControls from "../src/components/layout/HeaderControls.jsx";

vi.mock("../src/shared/components/header/TopBar.jsx", () => ({
  __esModule: true,
  default: () => <div data-testid="topbar" />,
}));

describe("HeaderControls", () => {
  const baseProps = {
    connectMetaMask: vi.fn(),
    connectWalletConnect: vi.fn(),
    mintTicket: vi.fn(),
    redeemTicket: vi.fn(),
    claimREWARDS: vi.fn(),
    icons: [],
    setOpenNavIdx: vi.fn(),
    isRedeeming: false,
    VRFPending: false,
    actionPerforming: false,
    actionStatusLabel: "",
    actionError: "",
  };

  it("shows both connect buttons when no verified wallet address is present", () => {
    render(
      <HeaderControls
        {...baseProps}
        walletAddress=""
        isMobile={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: /connect metamask/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect walletconnect/i }),
    ).toBeInTheDocument();
  });

  it("shows a single connected wallet button after a verified wallet is present", () => {
    render(
      <HeaderControls
        {...baseProps}
        walletAddress="0x1234567890123456789012345678901234567890"
        isMobile={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /change connected metamask account/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect walletconnect/i }),
    ).not.toBeInTheDocument();
  });
});
