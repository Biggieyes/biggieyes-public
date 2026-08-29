import { describe, expect, it } from "vitest";

import { hasCommunityAssignment } from "../src/hooks/useCommunityCenterUserSnapshot.js";

describe("Community Center assignment summary", () => {
  it("counts only events with a wallet allocation", () => {
    expect(
      hasCommunityAssignment({
        walletStatus: { amount: 0n, claimed: false, exists: true },
      }),
    ).toBe(false);
    expect(
      hasCommunityAssignment({
        walletStatus: { amount: 1n, claimed: false, exists: true },
      }),
    ).toBe(true);
    expect(hasCommunityAssignment({ walletStatus: null })).toBe(false);
  });
});
