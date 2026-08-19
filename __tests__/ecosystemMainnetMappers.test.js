import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

import TokenDexTab from "../src/features/tokenomics/tabs/TokenDexTab.jsx";
import { mapBUYBACKSnapshotToUI } from "../src/shared/services/tokenomics/buybackTreasury.mappers.js";
import { mapDistributorSnapshotToUI } from "../src/shared/services/tokenomics/distributor.mappers.js";
import { mapDRIPSnapshotToUI } from "../src/shared/services/tokenomics/drip.mappers.js";
import { mapRawSnapshotToUI as mapLiquiditySnapshotToUI } from "../src/shared/services/tokenomics/liquidity.mappers.js";
import { mapRawSnapshotToUI as mapTokenDexSnapshotToUI } from "../src/shared/services/tokenomics/tokenDex.mappers.js";
import { fmtLp } from "../src/features/tokenomics/utils/format.js";

const ONE = 10n ** 18n;
const addr = (n) => `0x${String(n).padStart(40, "0")}`;
const noScience = (value) => expect(String(value)).not.toMatch(/e[+-]\d+/i);

describe("ecosystem mainnet mappers", () => {
  it("formats liquidity reserve, token and LP amounts with correct units", () => {
    const mapped = mapLiquiditySnapshotToUI({
      reserve: {
        address: addr(1),
        maticBalance: 1234567890123456789n,
        biggiBalance: 2500n * ONE,
        waitingBiggi: 3n * ONE,
        dexRefillBiggi: 4n * ONE,
        totalMaticReceived: 5n * ONE,
      },
      vault: {
        address: addr(2),
        totalLpLocked: ONE,
      },
      treasury: {
        nativeBalance: 2n * ONE,
        tokenBalance: 6n * ONE,
      },
      automation: {},
      keeperProxy: {},
    });

    expect(mapped.reserve.maticBalance).toBe("1.2345 POL");
    expect(mapped.reserve.biggiBalance).toBe("2,500 BIGGI");
    expect(mapped.vault.totalLpLocked).toBe("1 LP");
    expect(fmtLp(ONE)).toBe("1 LP");
    noScience(mapped.reserve.maticBalance);
    noScience(mapped.vault.totalLpLocked);
  });

  it("uses resolved token/native pair reserves instead of mirroring fallback reserves", () => {
    const token = addr(11);
    const weth = addr(12);
    const mapped = mapTokenDexSnapshotToUI({
      token: {
        address: token,
        decimals: 18,
        totalSupply: 1_000_000n * ONE,
        cap: 10_000_000n * ONE,
        remainingMintable: 9_000_000n * ONE,
        balances: {
          reserve: 1n * ONE,
          liquidityVault: 2n * ONE,
          treasury: 3n * ONE,
          DRIPDistributor: 4n * ONE,
          tokenREWARDS: 5n * ONE,
        },
      },
      dex: {
        weth,
        routerNativeOut: 10n ** 65n,
        pair: {
          token0: weth,
          token1: token,
          reserves: {
            native: 5n * ONE,
            token: 8_000n * ONE,
            reserve0: 999n * ONE,
            reserve1: 999n * ONE,
          },
          totalSupply: 7n * ONE,
        },
      },
    });

    expect(mapped.dex.pair.reserves.native).toBe("5 POL");
    expect(mapped.dex.pair.reserves.biggi).toBe("8,000 BIGGI");
    expect(mapped.dex.pair.totalSupply).toBe("7 LP");
    expect(mapped.dex.derived.liquidityDepth).toBe("5 POL");
    expect(mapped.dex.derived.priceImpact).toBe("> 1,000,000%");
    noScience(mapped.dex.pair.reserves.native);
    noScience(mapped.dex.pair.reserves.biggi);
    noScience(mapped.dex.derived.priceImpact);
  });

  it("renders Token / DEX price impact without exponent notation", () => {
    const { container } = render(
      React.createElement(TokenDexTab, {
        tokenDexSnapshot: {
          token: {
            address: addr(11),
            decimals: 18,
            totalSupply: 1_000_000n * ONE,
            cap: 10_000_000n * ONE,
            remainingMintable: 9_000_000n * ONE,
            balances: {
              reserve: ONE,
              liquidityVault: 2n * ONE,
              treasury: 3n * ONE,
              DRIPDistributor: 4n * ONE,
              tokenREWARDS: 5n * ONE,
            },
          },
          dex: {
            weth: addr(12),
            routerNativeOut: 10n ** 65n,
            pair: {
              address: addr(13),
              token0: addr(12),
              token1: addr(11),
              reserves: {
                native: 5n * ONE,
                token: 8_000n * ONE,
                reserve0: 5n * ONE,
                reserve1: 8_000n * ONE,
              },
              totalSupply: 7n * ONE,
            },
          },
        },
        dexHistory: {},
      }),
    );

    expect(container.textContent).toContain("> 1,000,000%");
    expect(container.textContent).not.toMatch(/\d+(?:\.\d+)?e[+-]\d+/i);
  });

  it("renders Token / DEX block weights as protocol blocks 1-10", () => {
    const { container } = render(
      React.createElement(TokenDexTab, {
        tokenDexSnapshot: {
          token: {
            address: addr(11),
            decimals: 18,
            totalSupply: 1_000_000n * ONE,
            cap: 10_000_000n * ONE,
            remainingMintable: 9_000_000n * ONE,
            balances: {
              reserve: ONE,
              liquidityVault: 2n * ONE,
              treasury: 3n * ONE,
              DRIPDistributor: 4n * ONE,
              tokenREWARDS: 5n * ONE,
            },
          },
          dex: {
            weth: addr(12),
            pair: {
              address: addr(13),
              token0: addr(12),
              token1: addr(11),
              reserves: {
                native: 5n * ONE,
                token: 8_000n * ONE,
              },
              totalSupply: 7n * ONE,
            },
          },
        },
        dexHistory: {},
        readerStatus: {
          tr: {
            blockWeights: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
          },
        },
      }),
    );

    expect(container.textContent).toContain("Block weights (1-10)");
    expect(container.textContent).toContain("Block 1: 10");
    expect(container.textContent).toContain("Block 10: 100");
    expect(container.textContent).not.toContain(
      "0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100",
    );
  });

  it("formats buyback, treasury, DRIP and distributor snapshots by branch unit", () => {
    const buyback = mapBUYBACKSnapshotToUI({
      BUYBACK: {
        address: addr(21),
        nativeBalance: ONE,
        biggiBalance: 2n * ONE,
        totalNativeSpent: 3n * ONE,
        totalNativeReceived: 4n * ONE,
        totalBiggiAcquired: 5n * ONE,
        tokenBalance: 6n * ONE,
        keeperThreshold: 7n * ONE,
      },
      treasury: {
        address: addr(22),
        biggiBalance: 8n * ONE,
        maticBalance: 9n * ONE,
        tokenBalance: 10n * ONE,
        totalBiggiReceived: 11n * ONE,
        totalMaticReceived: 12n * ONE,
        totalMaticReceivedFromDistributor: 13n * ONE,
      },
    });
    const drip = mapDRIPSnapshotToUI({
      distributor: {
        address: addr(31),
        cap: 100n * ONE,
        availableTokens: 50n * ONE,
        capRemaining: 25n * ONE,
        tokensPerMint: ONE,
        totalClaimed: 2n * ONE,
        totalNotified: 3n * ONE,
        totalTopUp: 4n * ONE,
        tokenBalance: 5n * ONE,
      },
      DRIPLM: {
        address: addr(32),
        nativeBalance: ONE,
        biggiBalance: 2n * ONE,
        totalNativeForwarded: 3n * ONE,
        totalSoldTokens: 4n * ONE,
      },
    });
    const distributor = mapDistributorSnapshotToUI({
      totalReceived: 9n * ONE,
      totalPending: 8n * ONE,
      pendingReserve: 7n * ONE,
      pendingBUYBACK: 6n * ONE,
      pendingTreasury: 5n * ONE,
      pendingCOLLECTIONREWARDS: 4n * ONE,
      pendingCOMMUNITYCENTER: 3n * ONE,
      communityPoolBalance: 2n * ONE,
    });

    expect(buyback.BUYBACK.nativeBalance).toBe("1 POL");
    expect(buyback.BUYBACK.biggiBalance).toBe("2 BIGGI");
    expect(buyback.treasury.maticBalance).toBe("9 POL");
    expect(drip.distributor.availableTokens).toBe("50 BIGGI");
    expect(drip.DRIPLM.nativeBalance).toBe("1 POL");
    expect(distributor.totalReceived).toBe("9 POL");
    expect(distributor.communityPoolBalance).toBe("2 POL");
    noScience(buyback.BUYBACK.nativeBalance);
    noScience(drip.distributor.availableTokens);
    noScience(distributor.totalReceived);
  });
});
