import * as React from "react";
import { render, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import BackgroundsWidget from "../src/components/BackgroundsWidget";
import BlocksWidget from "../src/components/BlocksWidget";
import { DEFAULT_BLOCKS } from "../src/shared/blocks";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
  });
});

describe("Live Stats block and background tables", () => {
  it("renders verified block supplies and current Polygon prices", () => {
    const { container } = render(
      <BlocksWidget
        blockNames={DEFAULT_BLOCKS}
        blockMintCounts={Array(10).fill(0)}
        blockPrices={[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]}
      />,
    );
    const rows = within(container.querySelector(".bw-head tbody")).getAllByRole(
      "row",
    );
    const orange = within(rows[0]).getAllByRole("cell");
    const rainbow = within(rows[9]).getAllByRole("cell");

    expect(orange[1]).toHaveTextContent("0");
    expect(orange[3]).toHaveTextContent("100");
    expect(orange[4]).toHaveTextContent("100,00 POL");
    expect(orange[5]).toHaveTextContent("100,00 POL");
    expect(rainbow[3]).toHaveTextContent("10");
    expect(rainbow[5]).toHaveTextContent("1 000,00 POL");
  });

  it("renders the deployed background bonus and growth matrix", () => {
    const { container } = render(
      <BackgroundsWidget
        blockNames={DEFAULT_BLOCKS}
        backgroundMintCounts={Array(10).fill(0)}
        blockPrices={[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]}
      />,
    );
    const rows = within(
      container.querySelector(".bgw-head tbody"),
    ).getAllByRole("row");
    const orange = within(rows[0]).getAllByRole("cell");
    const rainbow = within(rows[9]).getAllByRole("cell");

    expect(orange[3]).toHaveTextContent("5%");
    expect(orange[4]).toHaveTextContent("5%");
    expect(orange[5]).toHaveTextContent("100");
    expect(orange[6]).toHaveTextContent("0,00 POL");
    expect(rainbow[3]).toHaveTextContent("50%");
    expect(rainbow[4]).toHaveTextContent("10%");
    expect(rainbow[5]).toHaveTextContent("10");
  });

  it("does not invent a live price when RPC data is missing", () => {
    const { container } = render(
      <BlocksWidget
        blockNames={DEFAULT_BLOCKS}
        blockMintCounts={Array(10).fill(0)}
        blockPrices={[]}
      />,
    );
    const firstRow = within(
      container.querySelector(".bw-head tbody"),
    ).getAllByRole("row")[0];
    const cells = within(firstRow).getAllByRole("cell");

    expect(cells[4]).toHaveTextContent("100,00 POL");
    expect(cells[5]).toHaveTextContent("--");
  });
});
