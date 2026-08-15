import { describe, expect, it } from "vitest";

import {
  formatFlowNative,
  formatFlowToken,
} from "../src/features/tokenomics/tabs/FlowTab.jsx";

describe("FlowTab amount formatting", () => {
  it("keeps token and native units separated", () => {
    expect(formatFlowToken("9.469902220214855e+29 POL")).toBe("--");
    expect(formatFlowToken("92339.3422")).toBe("92,339.3422 BIGGI");
    expect(formatFlowNative("92339.3422")).toBe("92,339.3422 POL");
  });

  it("formats raw on-chain balances without scientific notation", () => {
    const rawBiggi = 946990222021485500000000000000000000000000000000n;
    const rawNative = 92339342200000000000000n;

    expect(formatFlowToken(rawBiggi)).toMatch(/BIGGI$/);
    expect(formatFlowToken(rawBiggi)).not.toMatch(/e\+/i);
    expect(formatFlowNative(rawNative)).toBe("92,339.3422 POL");
  });
});
