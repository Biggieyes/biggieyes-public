import * as React from "react";
import { render, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import LiveStats from "../src/components/LiveStats.jsx";
import { DEFAULT_BLOCKS } from "../src/shared/blocks";

vi.mock("@/shared/utils/contract", () => ({
  ADDR: {},
  getROProvider: () => null,
  getReaderRO: () => null,
  getReadOnlyMain: () => null,
  getReadOnlyChapterMain: () => null,
  getReadOnlyChapterMain2: () => null,
  getTokenREWARDSRO: () => null,
  getDistributorRO: () => null,
  getReadOnlyLiquidityContract: () => null,
  getTokenRO: () => null,
  getPairRO: () => null,
  getInjectedProvider: () => null,
  resetROProvider: vi.fn(),
}));

vi.mock("../src/hooks/useWeeklyCountdown", () => ({
  default: () => ({ displayed: null, syncWeeklyInfo: vi.fn() }),
}));

const props = {
  biggiMinted: 12,
  maxSupply: 550,
  ticketMinted: 50,
  maxTickets: 550,
  ticketPrice: 500,
  blockNames: DEFAULT_BLOCKS,
  blockMintCounts: Array(10).fill(0),
  backgroundMintCounts: Array(10).fill(0),
  blockPrices: [],
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

describe("LiveStats six-frame summary", () => {
  it("preserves six frames and the original top and bottom button order", () => {
    const { container } = render(<LiveStats {...props} />);
    expect(container.querySelectorAll(".ls-summary-card")).toHaveLength(6);
    expect(container.querySelectorAll(".ls-summary-column")).toHaveLength(3);
    for (const column of container.querySelectorAll(".ls-summary-column")) {
      expect(column.querySelectorAll(".ls-summary-card")).toHaveLength(2);
    }
    const labels = (selector) =>
      within(container.querySelector(selector)).getAllByRole("button")
        .map((button) => button.textContent.trim());
    expect(labels(".live-stats-buttons-row")).toEqual([
      "BLOCKS", "BACKGROUNDS", "COLLECTION STATS",
    ]);
    expect(labels(".ls-summary-actions")).toEqual([
      "BIGGI WEEKLY", "TOKENOMICS", "LIVE CHAT",
    ]);
  });

  it("keeps the existing supply and price values and labels the ticket price in POL", () => {
    const { container } = render(<LiveStats {...props} />);
    const supply = container.querySelector(".ls-summary-card--supply");
    expect(within(supply).getByText("500")).toBeInTheDocument();
    expect(within(supply).getByText("12")).toBeInTheDocument();
    expect(within(supply).getAllByText("/ 550")).toHaveLength(2);
    const ticket = container.querySelector(".ls-summary-card--ticket");
    expect(within(ticket).getByText("500.000")).toBeInTheDocument();
    expect(within(ticket).getByText("POL")).toBeInTheDocument();
  });

  it("retains trait names and adds decorative swatches without changing the NFT image", () => {
    const { container } = render(
      <LiveStats {...props}
        lastNftId="42"
        lastImage="/images/blocks/RAINBOW/Biggi_42_RAINBOW_O.png"
        lastBlockName="RAINBOW"
        lastBackgroundName="ORANGE"
      />,
    );
    const nft = container.querySelector(".ls-summary-card--nft");
    expect(within(nft).getByText("#42")).toBeInTheDocument();
    expect(within(nft).getByText("RAINBOW")).toBeInTheDocument();
    expect(within(nft).getByText("ORANGE")).toBeInTheDocument();
    const swatches = nft.querySelectorAll(".ls-summary-swatch");
    expect(swatches).toHaveLength(2);
    for (const swatch of swatches) expect(swatch).toHaveAttribute("aria-hidden", "true");
    expect(within(container).getByRole("img", { name: "Last Minted NFT" }))
      .toHaveAttribute("src", "/images/blocks/RAINBOW/Biggi_42_RAINBOW_O.png");
  });

  it("does not invent a trait swatch or token price for missing data", () => {
    const { container } = render(<LiveStats {...props} />);
    expect(container.querySelectorAll(".ls-summary-swatch")).toHaveLength(0);
    const market = container.querySelector(".ls-summary-card--market");
    expect(within(market).getAllByText("-")).toHaveLength(2);
  });
});
