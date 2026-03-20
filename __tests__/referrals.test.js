import { describe, expect, it } from "vitest";
import {
  buildModeratorReferralLink,
  extractReferralParam,
} from "../src/shared/utils/referrals.js";

describe("referral helpers", () => {
  it("extracts ref from normal search params", () => {
    expect(
      extractReferralParam("https://biggieyes.com/app?ref=slot3:promo2026"),
    ).toBe("slot3:promo2026");
  });

  it("extracts ref from hash query params", () => {
    expect(
      extractReferralParam(
        "https://biggieyes.com/app#/home?panel=user&ref=slot5:launch",
      ),
    ).toBe("slot5:launch");
  });

  it("builds moderator links in the current supported format", () => {
    expect(
      buildModeratorReferralLink(
        "https://biggieyes.com/app",
        4,
        "promo2026",
      ),
    ).toBe("https://biggieyes.com/app?ref=slot4:promo2026");
  });
});
