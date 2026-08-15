import { describe, expect, it } from "vitest";

import {
  isDistributorSnapshot,
  unwrapDistributorSnapshot,
} from "../src/shared/services/tokenomics/distributor.snapshot.js";

const UNIT = 10n ** 18n;

function createSnapshotResult() {
  const snapshot = [
    "0x1000000000000000000000000000000000000001",
    "0x1000000000000000000000000000000000000002",
    "0x1000000000000000000000000000000000000003",
    "0x1000000000000000000000000000000000000004",
    "0x1000000000000000000000000000000000000005",
    5n * UNIT,
    25n * UNIT,
  ];
  snapshot.collectionRewards = snapshot[0];
  snapshot.reserve = snapshot[1];
  snapshot.buybackAgent = snapshot[2];
  snapshot.treasury = snapshot[3];
  snapshot.communityCenter = snapshot[4];
  snapshot.totalPending = snapshot[5];
  snapshot.totalReceived = snapshot[6];
  return snapshot;
}

describe("distributor snapshot helpers", () => {
  it("recognizes ethers-style result tuples as a full snapshot", () => {
    expect(isDistributorSnapshot(createSnapshotResult())).toBe(true);
  });

  it("does not unwrap a direct snapshot tuple to its first address", () => {
    const snapshot = createSnapshotResult();
    expect(unwrapDistributorSnapshot(snapshot)).toBe(snapshot);
  });

  it("unwraps wrapped reader responses through the s property", () => {
    const snapshot = createSnapshotResult();
    expect(unwrapDistributorSnapshot({ s: snapshot })).toBe(snapshot);
  });
});
