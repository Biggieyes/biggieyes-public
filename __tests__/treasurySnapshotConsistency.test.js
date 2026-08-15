import { describe, expect, it } from "vitest";

import { mapBUYBACKSnapshotToUI } from "../src/shared/services/tokenomics/buybackTreasury.mappers.js";
import { normalizeReserveTreasurySnapshot } from "../src/shared/services/tokenomics/buybackTreasury.reader.js";

const ONE = 10n ** 18n;

describe("Treasury reader snapshot consistency", () => {
  it("maps ReserveTreasuryReader.treasurySnapshot tuple in Solidity order", () => {
    const snapshot = [
      1n * ONE, // treasuryPol
      2n * ONE, // treasuryBiggi
      3n * ONE, // totalBiggiFromBuyback
      4n * ONE, // totalBiggiFromEcosystem
      5n * ONE, // totalPolFromDistributor
    ];

    expect(normalizeReserveTreasurySnapshot(snapshot)).toEqual({
      treasuryPol: 1n * ONE,
      treasuryBiggi: 2n * ONE,
      totalBiggiFromBuyback: 3n * ONE,
      totalBiggiFromEcosystem: 4n * ONE,
      totalPolFromDistributor: 5n * ONE,
    });
  });

  it("exposes distributor POL and ecosystem BIGGI totals to the UI separately", () => {
    const ui = mapBUYBACKSnapshotToUI({
      BUYBACK: {},
      treasury: {
        totalMaticReceivedFromDistributor: 5n * ONE,
        totalBiggiReceivedFromEcosystem: 4n * ONE,
      },
    });

    expect(ui.treasury.totalMaticFromDistributorNumeric).toBe(5);
    expect(ui.treasury.totalBiggiFromEcosystemNumeric).toBe(4);
  });
});
