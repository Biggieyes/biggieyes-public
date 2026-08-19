import { describe, expect, it } from "vitest";

import resolveBuybackSnapshot from "../src/features/tokenomics/utils/resolveBuybackSnapshot";

const UNIT = 10n ** 18n;

describe("resolveBuybackSnapshot", () => {
  it("fills treasury fields from fallback snapshots", () => {
    const resolved = resolveBuybackSnapshot(
      {
        ts: 1000,
        BUYBACK: {
          address: "0x1111111111111111111111111111111111111111",
        },
      },
      {
        flowSnapshot: {
          addresses: {
            treasury: "0x2222222222222222222222222222222222222222",
          },
          liveBalances: {
            native: { treasury: 8n * UNIT },
            token: { treasury: 0n },
          },
          tokenMeta: { decimals: 18 },
        },
        liquiditySnapshot: {
          treasury: {
            nativeBalance: 9n * UNIT,
            tokenBalance: 7n * UNIT,
          },
        },
        tokenDexSnapshot: {
          token: {
            decimals: 18,
            balances: {
              treasuryNumeric: 3,
            },
          },
        },
      },
    );

    expect(resolved.treasury.address).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(resolved.treasury.biggiBalanceNumeric).toBe(3);
    expect(resolved.treasury.biggiBalance).toBe("3");
    expect(resolved.treasury.maticBalanceNumeric).toBe(9);
    expect(resolved.treasury.maticBalance).toBe("9");
  });

  it("keeps explicit buyback treasury values when they are present", () => {
    const resolved = resolveBuybackSnapshot(
      {
        treasury: {
          address: "0x3333333333333333333333333333333333333333",
          shortAddress: "0x3333...3333",
          biggiBalance: "12.5",
          biggiBalanceNumeric: 12.5,
          maticBalance: "4.25",
          maticBalanceNumeric: 4.25,
          totalMaticReceived: "1.5",
        },
      },
      {
        flowSnapshot: {
          addresses: {
            treasury: "0x4444444444444444444444444444444444444444",
          },
        },
      },
    );

    expect(resolved.treasury.address).toBe(
      "0x3333333333333333333333333333333333333333",
    );
    expect(resolved.treasury.shortAddress).toBe("0x3333...3333");
    expect(resolved.treasury.biggiBalance).toBe("12.5");
    expect(resolved.treasury.maticBalance).toBe("4.25");
    expect(resolved.treasury.totalMaticReceived).toBe("1.5");
  });
});
