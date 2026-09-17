import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LoadingOverlay from "../src/components/LoadingOverlay.jsx";
import LiveStatsPanel from "../src/components/layout/LiveStatsPanel.jsx";

const fixture = vi.hoisted(() => ({ stats: vi.fn() }));
vi.mock("../src/components/LiveStats", () => ({
  default: (props) => {
    fixture.stats(props);
    return <div data-testid="stats">Stats</div>;
  },
}));
afterEach(() => {
  cleanup();
  fixture.stats.mockClear();
});

it("prioritizes the narrow-screen background without preloading desktop logos there", () => {
  const html = fs.readFileSync("app/index.html", "utf8");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const background = doc.querySelector(
    'link[rel="preload"][href="/images/panels/ecosystem.optimized.jpg"]'
  );
  expect(background.getAttribute("media")).toBe("(max-width: 900px)");
  expect(background.getAttribute("fetchpriority")).toBe("high");
  for (const name of ["main-logo1", "main-logo2"]) {
    const logo = doc.querySelector(
      `link[rel="preload"][href="/images/${name}.optimized.lossless.webp"]`
    );
    expect(logo.getAttribute("media")).toBe("(min-width: 901px)");
  }
});

it("preserves lazy stats rendering and its inputs", async () => {
  const fetchChainNowTs = vi.fn();
  const items = [{ tokenId: "1001" }];
  render(
    <LiveStatsPanel
      lastMinted={{
        image: "/nft.png",
        tokenId: "1001",
        blockName: "ORANGE",
        backgroundName: "BLUE",
        contractAddress: "collection",
        chapterId: 2,
        finalPrice: 105,
      }}
      walletAddress="account"
      myNFTs={items}
      ticketPrice={500}
      rewardPool={7}
      fetchChainNowTs={fetchChainNowTs}
      isMobile
    />
  );
  expect(await screen.findByTestId("stats")).toBeInTheDocument();
  expect(fixture.stats).toHaveBeenLastCalledWith(
    expect.objectContaining({
      walletAddress: "account",
      lastImage: "/nft.png",
      lastNftId: "1001",
      lastBlockName: "ORANGE",
      lastBackgroundName: "BLUE",
      lastContractAddress: "collection",
      lastChapterId: 2,
      lastFinalPrice: 105,
      items,
      ticketPrice: 500,
      rewardPool: 7,
      weekSeconds: 604800,
      fetchChainNowTs,
      compact: true,
    })
  );
  expect(document.getElementById("live-stats")).toHaveStyle({
    paddingTop: "8px",
  });
});

it.each([
  [34.9, "34%"],
  [140, "100%"],
  [-2, "0%"],
  [NaN, "0%"],
])(
  "keeps the displayed progress and CSS width consistent for %s",
  (percent, expected) => {
    render(<LoadingOverlay percent={percent} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(document.querySelector(".progress-bar")).toHaveStyle({
      width: expected,
    });
  }
);

it("updates progress through React and releases the loading lock on close", () => {
  const view = render(<LoadingOverlay percent={4} />);
  expect(document.body).toHaveClass("loading-locked");
  view.rerender(<LoadingOverlay percent={67.4} />);
  expect(document.querySelector(".progress-bar")).toHaveStyle({ width: "67%" });
  view.rerender(<LoadingOverlay open={false} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body).not.toHaveClass("loading-locked");
});

it("retains optional Escape handling and removes its listener on unmount", () => {
  const onClose = vi.fn();
  const view = render(<LoadingOverlay onClose={onClose} />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  view.unmount();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});
