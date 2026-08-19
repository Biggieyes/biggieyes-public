import { readFileSync } from "node:fs";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExpansionPanel from "../src/features/tokenomics/expansion/ExpansionPanel.jsx";
import PublicExpansionPanel from "../public-repo/src/features/tokenomics/expansion/ExpansionPanel.jsx";

describe("ExpansionPanel CORE consistency", () => {
  it("shows the four deployed future chapter pairs without the legacy final stage", () => {
    const { container } = render(<ExpansionPanel compact />);
    const content = container.textContent;

    expect(
      screen.getByRole("heading", {
        name: "Deployed VRF + Public chapter pairs",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Pair 0[1-4]$/)).toHaveLength(4);
    expect(content).toContain("Universe");
    expect(content).toContain("Mutant");
    expect(content).toContain("Apocalipse");
    expect(content).toContain("Super Hero");
    expect(content).toContain("550 NFTs");
    expect(content).toContain("50 / chapter");
    expect(content).not.toContain("MULTIVERSE");
    expect(content).not.toContain("1100");
    expect(content).not.toContain("final collection");
  });

  it("keeps the application and public frontend panels identical", () => {
    expect(typeof PublicExpansionPanel).toBe("function");

    const rootPanel = readFileSync(
      "src/features/tokenomics/expansion/ExpansionPanel.jsx",
      "utf8",
    );
    const publicPanel = readFileSync(
      "public-repo/src/features/tokenomics/expansion/ExpansionPanel.jsx",
      "utf8",
    );

    expect(publicPanel).toBe(rootPanel);

    const rootConstants = readFileSync(
      "src/features/rewards/COLLECTION/CollectionBlocksGrid.constants.js",
      "utf8",
    );
    const publicConstants = readFileSync(
      "public-repo/src/features/rewards/COLLECTION/CollectionBlocksGrid.constants.js",
      "utf8",
    );

    expect(publicConstants).toBe(rootConstants);
  });
});
