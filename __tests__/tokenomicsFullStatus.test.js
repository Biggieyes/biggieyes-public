import { describe, expect, it } from "vitest";

import { normalizeTokenomicsFullStatus } from "../src/shared/utils/tokenomicsFullStatus";

const addr = (suffix) => `0x${String(suffix).padStart(40, "0")}`;

describe("normalizeTokenomicsFullStatus", () => {
  it("normalizes the current reader shape", () => {
    const normalized = normalizeTokenomicsFullStatus([
      {
        token: addr(1),
        weth: addr(2),
        router: addr(3),
        pair: addr(4),
        reserveNative: 11n,
        reserveBiggi: 12n,
        lpTotalSupply: 13n,
        biggiPerNative: 14n,
        nativePerBiggi: 15n,
      },
      {
        distributor: addr(5),
        totalReceived: 21n,
        pendingBuyback: 22n,
        collectionRewards: addr(6),
        reserve: addr(7),
        buybackAgent: addr(8),
        treasury: addr(9),
        communityCenter: addr(10),
      },
      {
        buybackAgent: addr(11),
        nativeBalance: 31n,
        biggiBalance: 32n,
        totalNativeReceived: 33n,
        totalNativeSpent: 34n,
        totalBiggiAcquired: 35n,
        autoBuybackEnabled: true,
        paused: false,
        lastBuybackAt: 36n,
        router: addr(12),
        wrappedNative: addr(13),
        treasury: addr(14),
      },
      {
        reserve: addr(15),
        polBalance: 41n,
        waitingBiggi: 42n,
        dexRefillBiggi: 43n,
        liquidityManager: addr(16),
        keeper: addr(17),
        liquidityVault: addr(18),
        pairWhitelisted: true,
        lpBalanceInVault: 44n,
      },
      {
        dripDistributor: addr(19),
        availableTokens: 51n,
        totalReceived: 52n,
        totalClaimed: 53n,
        totalNotified: 54n,
        tokensPerMint: 55n,
        dripLM: addr(20),
        dripReserve: addr(21),
        dripModeratorCenter: addr(22),
        reserveShareBps: 560,
        moderatorShareBps: 440,
        sellPct: 12,
        slippageBps: 250n,
        txDeadlineSec: 900n,
        dripRouter: addr(23),
        dripBuyback: addr(24),
      },
      {
        tokenRewards: addr(25),
        rewardsCap: 61n,
        rewardsMinted: 62n,
        balance: 63n,
        unitReward: 64n,
        blockWeights: [1, 2, 3],
        token: addr(26),
      },
    ]);

    expect(normalized.core.reserveNative).toBe(11n);
    expect(normalized.dist.pendingBUYBACK).toBe(22n);
    expect(normalized.buy.autoBUYBACKEnabled).toBe(true);
    expect(normalized.res.maticBalance).toBe(41n);
    expect(normalized.drip.DRIPLM).toBe(addr(20));
    expect(normalized.drip.reserveShareBps).toBe(560);
    expect(normalized.tr.REWARDSCap).toBe(61n);
  });

  it("normalizes the legacy reader shape", () => {
    const normalized = normalizeTokenomicsFullStatus([
      [
        addr(1),
        addr(2),
        addr(3),
        addr(4),
        addr(5),
        addr(6),
        11n,
        12n,
        13n,
        14n,
        15n,
      ],
      [
        addr(7),
        21n,
        22n,
        addr(8),
        addr(9),
        addr(10),
        addr(11),
        addr(12),
      ],
      [
        addr(13),
        31n,
        32n,
        33n,
        34n,
        35n,
        true,
        false,
        36n,
        addr(14),
        addr(15),
        addr(16),
      ],
      [
        addr(17),
        41n,
        42n,
        43n,
        addr(18),
        true,
        44n,
        addr(19),
        addr(20),
      ],
      [
        addr(21),
        51n,
        52n,
        53n,
        54n,
        55n,
        addr(22),
      ],
      [
        addr(23),
        61n,
        62n,
        63n,
        64n,
        [1, 2, 3],
        addr(24),
      ],
    ]);

    expect(normalized.core.token0).toBe(addr(5));
    expect(normalized.core.token1).toBe(addr(6));
    expect(normalized.dist.COLLECTIONREWARDS).toBe(addr(8));
    expect(normalized.buy.lastBUYBACKAt).toBe(36n);
    expect(normalized.res.liquidityManager).toBe(addr(19));
    expect(normalized.drip.totalTopUp).toBe(51n);
    expect(normalized.drip.availableTokens).toBe(54n);
    expect(normalized.tr.tokenREWARDS).toBe(addr(23));
  });
});
