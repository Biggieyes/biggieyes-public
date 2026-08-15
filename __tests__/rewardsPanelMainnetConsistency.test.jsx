import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import REWARDSBlockSummary from "../src/features/rewards/REWARDSBlockSummary.jsx";
import COLLECTIONREWARDSSection from "../src/features/rewards/Rewards/CollectionRewards/COLLECTIONREWARDSSection.jsx";
import {
  formatNativeDisplay,
  isRealAddress,
  ZERO_ADDRESS,
} from "../src/features/tokenomics/utils/amountFormatting.js";
import { ADDR } from "../src/shared/utils/addresses.js";

describe("rewards panel mainnet consistency", () => {
  it("formats collection native rewards as POL without scientific notation", () => {
    const { container } = render(
      <COLLECTIONREWARDSSection
        stats={{
          blockReward: "1000000000000000000",
          orangeReward: "2500000000000000000",
          rainbowReward: "9.469902220214855e+29 POL",
          distributor: ADDR.DISTRIBUTOR,
          main: ADDR.MAIN,
          owner: ADDR.DEV_WALLET,
        }}
        formatNativeAmount={(value, digits) =>
          formatNativeDisplay(value, digits)
        }
        formatAddress={(addr) => (isRealAddress(addr) ? "live" : "--")}
        rewardPool="92339.3422"
        collectionBalance={0}
      />,
    );

    expect(container.textContent).toContain("1 POL");
    expect(container.textContent).toContain("2.5 POL");
    expect(container.textContent).toContain("92,339.34 POL");
    expect(container.textContent).not.toMatch(/e\+29/i);
    expect(container.textContent).not.toMatch(/POL POL/);
    expect(isRealAddress(ZERO_ADDRESS)).toBe(false);
  });

  it("shows weekly block summary in formatted BIGGI units", () => {
    const { container } = render(
      <REWARDSBlockSummary
        items={[{ blockName: "Block 1" }]}
        blockNames={["Block 1"]}
      />,
    );

    expect(screen.getByText("WEEKLY BIGGI")).toBeTruthy();
    expect(container.textContent).toContain("1 BIGGI");
    expect(container.textContent).not.toMatch(/e\+/i);
  });
});
