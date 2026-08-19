import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LineChart from "../src/shared/components/charts/LineChart.jsx";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LineChart", () => {
  it("handles empty and populated data without changing hook order", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { rerender } = render(<LineChart points={[]} />);

    expect(screen.getByText(/No liquidity history yet\./i)).toBeInTheDocument();

    expect(() =>
      rerender(<LineChart points={[{ value: 42, label: "Now" }]} />),
    ).not.toThrow();
    expect(screen.getByText(/Latest:/i)).toBeInTheDocument();

    expect(() => rerender(<LineChart points={[]} />)).not.toThrow();
    expect(screen.getByText(/No liquidity history yet\./i)).toBeInTheDocument();

    const errorOutput = consoleError.mock.calls.flat().join(" ");
    expect(errorOutput).not.toContain(
      "Rendered more hooks than during the previous render",
    );
    expect(errorOutput).not.toContain(
      "change in the order of Hooks called by LineChart",
    );
  });

  it("shows the observed range instead of the expanded plotting range", () => {
    render(<LineChart points={[{ value: 0, label: "Now" }]} />);

    expect(screen.getByText("Range: 0 - 0")).toBeInTheDocument();
    expect(screen.queryByText("Range: -1 - 1")).not.toBeInTheDocument();
  });
});
