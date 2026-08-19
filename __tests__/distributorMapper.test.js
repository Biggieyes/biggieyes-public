import { describe, expect, it } from "vitest";

import { mapDistributorSnapshotToUI } from "../src/shared/services/tokenomics/distributor.mappers";

const UNIT = 10n ** 18n;

describe("mapDistributorSnapshotToUI", () => {
  it("keeps pending community and community pool balance separate", () => {
    const mapped = mapDistributorSnapshotToUI({
      totalReceived: 25n * UNIT,
      totalPending: 5n * UNIT,
      pendingCOMMUNITYCENTER: 3n * UNIT,
      communityPoolBalance: 7n * UNIT,
    });

    expect(mapped.pendingCOMMUNITYCENTERNumeric).toBe(3);
    expect(mapped.pendingCommunity).toBe(mapped.pendingCOMMUNITYCENTER);
    expect(mapped.communityPoolBalanceNumeric).toBe(7);
    expect(mapped.communityPoolBalance).not.toBe(mapped.pendingCOMMUNITYCENTER);
  });

  it("falls back to placeholders for malformed amount strings", () => {
    const mapped = mapDistributorSnapshotToUI({
      totalReceived: "E",
      totalPending: "error",
    });

    expect(mapped.totalReceived).toBe("--");
    expect(mapped.totalReceivedNumeric).toBeNull();
    expect(mapped.totalPending).toBe("--");
    expect(mapped.totalPendingNumeric).toBeNull();
  });
});
