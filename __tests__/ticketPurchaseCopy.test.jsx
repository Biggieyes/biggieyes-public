import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SiteFooter from "../src/components/layout/SiteFooter.jsx";
import ProjectInfoModal from "../src/ACTIONBUTTONS/INFO/ProjectInfoModal.jsx";
import { MODAL_TEXTS } from "../src/shared/texts.js";
import { TICKET_PURCHASE_COPY } from "../src/shared/ticketPurchaseCopy.js";

vi.mock("../src/features/info/trust/TrustPanel.jsx", () => ({
  default: () => null,
}));

afterEach(() => vi.restoreAllMocks());

describe("Ticket purchase guidance", () => {
  it("explains acquisition, prelaunch trading and the per-chapter limit in footer FAQ", () => {
    render(<SiteFooter />);
    const entries = [
      ["How does minting work?", TICKET_PURCHASE_COPY.howItWorks],
      [
        "Can I buy a ticket before its chapter opens?",
        TICKET_PURCHASE_COPY.presale,
      ],
      [
        "Does the 10-ticket limit apply on OpenSea?",
        TICKET_PURCHASE_COPY.walletLimit,
      ],
    ];
    for (const [question, answer] of entries) {
      const button = screen.getByRole("button", { name: question });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText(answer)).toBeVisible();
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("uses identical purchase guidance in the Info panel", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    render(<ProjectInfoModal open asPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /FAQ/ }));
    for (const answer of Object.values(TICKET_PURCHASE_COPY)) {
      expect(screen.getByText(answer).closest("details")).not.toBeNull();
    }
  });

  it("removes contradictory presale and wallet-limit claims from modal copy", () => {
    expect(MODAL_TEXTS.info).not.toMatch(/no presale|no bots/i);
    expect(MODAL_TEXTS.chance).not.toContain(
      "Each wallet can hold up to 10 tickets",
    );
    expect(MODAL_TEXTS.chance).toContain(TICKET_PURCHASE_COPY.presale);
    expect(MODAL_TEXTS.chance).toContain(TICKET_PURCHASE_COPY.walletLimit);
    expect(MODAL_TEXTS.chance).toContain("which is not their resale price");
  });
});
