import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContractsTable from "../src/features/info/trust/components/ContractsTable.jsx";
import { CORE_CHAPTERS } from "../src/shared/utils/addresses.js";

describe("CORE contracts table", () => {
  it("shows every deployed chapter pair with its Polygon explorer target", () => {
    render(<ContractsTable />);

    for (const chapter of CORE_CHAPTERS) {
      for (const [kind, address] of [
        ["VRF", chapter.main],
        ["Public", chapter.main2],
      ]) {
        const name = `Chapter ${chapter.chapterId} ${chapter.displayName} ${kind}`;
        expect(screen.getByText(name)).toBeTruthy();
        expect(
          screen.getByRole("link", { name: `Open ${name} on explorer` }),
        ).toHaveAttribute("href", `https://polygonscan.com/address/${address}`);
      }
    }
  });
});
