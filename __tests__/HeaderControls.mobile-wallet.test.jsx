import * as React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/shared/components/header/TopBar.jsx", () => ({
  default: () => <div data-testid="topbar" />,
}));

import HeaderControls from "../src/components/layout/HeaderControls.jsx";

describe("HeaderControls mobile wallet row", () => {
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
    isMobile: true,
  };

  it("shows both wallet buttons on mobile when disconnected", () => {
    render(<HeaderControls {...baseProps} walletAddress="" />);

    expect(
      screen.getByRole("button", { name: "Connect MetaMask" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect WalletConnect" }),
    ).toBeInTheDocument();
  });

  it("hides the mobile wallet row after a wallet address is present", () => {
    render(
      <HeaderControls
        {...baseProps}
        walletAddress="0x1234567890123456789012345678901234567890"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Connect MetaMask" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect WalletConnect" }),
    ).not.toBeInTheDocument();
  });
});
