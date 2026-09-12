import * as React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import CollectionStructure from "../src/features/rewards/COLLECTION/CollectionStructure.jsx";
import { BASE_PRICES, DEFAULT_BLOCKS, MAX_SUPPLY_BY_BLOCK, ROWS_BY_BLOCK } from "../src/shared/blocks";
import { formatPrice } from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.utils";

const entries = DEFAULT_BLOCKS.map(name => ({
  name, basePrice: BASE_PRICES[name], currentPrice: BASE_PRICES[name], minted: 0,
}));
const rows = (tableName) => within(screen.getByRole("table", { name: tableName })).getAllByRole("row").slice(1);

beforeAll(() => vi.spyOn(window, "scrollTo").mockImplementation(() => {}));
afterAll(() => vi.restoreAllMocks());

describe("Collection structure mainnet rules", () => {
  it("renders the 550-NFT matrix and actual starting prices, not the retired PNG", () => {
    const { container } = render(<CollectionStructure blockEntries={entries} />);
    const blocks = rows("VRF blocks");
    expect(blocks).toHaveLength(10);
    DEFAULT_BLOCKS.forEach((name, index) => {
      const cells = within(blocks[index]).getAllByRole("cell");
      expect(cells[0].textContent).toBe(formatPrice(BASE_PRICES[name]));
      expect(cells[2]).toHaveTextContent(`0 / ${MAX_SUPPLY_BY_BLOCK[name]}`);
      expect(cells[3]).toHaveTextContent(`${index * 10 + 1}-${(index + 1) * 10}`);
      expect(cells[4]).toHaveTextContent(String(ROWS_BY_BLOCK[name]));
    });
    expect(screen.getByText("550 VRF NFTs / 100 Public NFTs")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("separates the bonus from same-color price growth for all ten backgrounds", () => {
    render(<CollectionStructure />);
    const backgrounds = rows("VRF background effects");
    const growth = [5, 2, 2, 3, 3, 4, 4, 5, 5, 10];
    DEFAULT_BLOCKS.forEach((name, index) => {
      expect(within(backgrounds[index]).getByRole("rowheader")).toHaveTextContent(name);
      const cells = within(backgrounds[index]).getAllByRole("cell");
      expect(cells[0]).toHaveTextContent(`+${(index + 1) * 5}%`);
      expect(cells[1]).toHaveTextContent(name);
      expect(cells[2]).toHaveTextContent(`+${growth[index]}%`);
    });
  });

  it("matches live rows by color and leaves unavailable values unknown", () => {
    render(<CollectionStructure blockEntries={[
      { name: "BLACK", basePrice: 200, currentPrice: 218.75, minted: 3 },
      { name: "ORANGE", basePrice: 100, currentPrice: null, minted: null },
    ]} />);
    const blocks = rows("VRF blocks");
    const orange = within(blocks[0]).getAllByRole("cell");
    const black = within(blocks[1]).getAllByRole("cell");
    expect(orange[1]).toHaveTextContent(/^--$/);
    expect(orange[2]).toHaveTextContent("-- / 100");
    expect(black[1]).toHaveTextContent(formatPrice(218.75));
    expect(black[2]).toHaveTextContent("3 / 90");
  });

  it("updates chapter identity and does not label future placeholders as live values", () => {
    const { rerender } = render(<CollectionStructure blockEntries={entries} />);
    rerender(<CollectionStructure blockEntries={entries} chapterId={2} chapterName="Universe" comingSoon />);
    expect(screen.getByRole("heading", { name: "Chapter 2: Universe" })).toBeInTheDocument();
    expect(within(rows("VRF blocks")[0]).getAllByRole("cell")[1]).toHaveTextContent(/^--$/);
  });

  it("explains the snapshot ordering, non-payment and Public rules", () => {
    render(<CollectionStructure />);
    fireEvent.click(screen.getByRole("button", { name: "Open collection structure information" }));
    expect(screen.getByText(/The background increase happens first/)).toBeInTheDocument();
    expect(screen.getByText(/Every completed VRF redeem/)).toBeInTheDocument();
    expect(screen.getByText(/Public mint does not trigger the VRF background price increase/)).toBeInTheDocument();
  });
});
