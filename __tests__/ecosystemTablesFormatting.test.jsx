import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DistributorTokenTab from "../src/features/tokenomics/tabs/DistributorTokenTab.jsx";
import { ADDR } from "../src/shared/utils/addresses.js";
import {
  formatNativeDisplay,
  formatTokenDisplay,
  isRealAddress,
  ZERO_ADDRESS,
} from "../src/features/tokenomics/utils/amountFormatting.js";

describe("ecosystem table formatting", () => {
  it("rejects scientific notation and mismatched units in amount displays", () => {
    expect(formatNativeDisplay("9.469902220214855e+29 POL")).toBe("--");
    expect(formatTokenDisplay("9.469902220214855e+29 POL")).toBe("--");
    expect(formatTokenDisplay("92339.3422")).toBe("92,339.3422 BIGGI");
    expect(isRealAddress(ZERO_ADDRESS)).toBe(false);
  });

  it("does not render bad POL fallback values or zero-address mismatches in distributor tables", () => {
    const { container } = render(
      <DistributorTokenTab
        distributorData={{
          address: ADDR.DISTRIBUTOR,
          reserve: ADDR.RESERVE,
          BUYBACKAgent: ADDR.BUYBACK_AGENT,
          treasury: ADDR.TREASURY,
          COLLECTIONREWARDS: ADDR.COLLECTION_REWARDS,
          COMMUNITYCENTER: ADDR.COMMUNITY_CENTER,
          DRIPDistributor: ADDR.DRIP_DISTRIBUTOR,
          readerAddress: ADDR.MCD_READER_V2,
          snapshotSource: "MCD Reader V2",
          totalReceived: "9.469902220214855e+29 POL",
          totalPending: "7.408956577545551e+29 POL",
          pendingReserve: "9.469902220214855e+29 POL",
          pendingBUYBACK: "7.408956577545551e+29 POL",
          pendingTreasury: "0",
          pendingCOLLECTIONREWARDS: "92339.3422",
          pendingCOMMUNITYCENTER: "0",
          communityPoolBalance: "0",
        }}
        tokenSnapshot={{ token: { symbol: "BIGGI", reserveAddress: ADDR.RESERVE } }}
        tokenTotalSupply="1000000"
        readerStatus={{
          distributor: ZERO_ADDRESS,
          reserve: ZERO_ADDRESS,
          BUYBACKAgent: ZERO_ADDRESS,
          treasury: ZERO_ADDRESS,
          COLLECTIONREWARDS: ZERO_ADDRESS,
          COMMUNITYCENTER: ZERO_ADDRESS,
        }}
      />,
    );

    expect(container.textContent).not.toMatch(/e\+29/i);
    expect(container.textContent).not.toMatch(/Mismatch/i);
    expect(container.textContent).toMatch(/92,339\.34 POL/);
  });
});
