import { describe, expect, it } from "vitest";
import {
  buildModeratorReferralLink,
  buildModeratorReferralValue,
  extractMintedTicketIdFromReceipt,
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
    expect(buildModeratorReferralValue(4, "promo2026")).toBe("slot4:promo2026");
    expect(
      buildModeratorReferralLink(
        "https://biggieyes.com/app",
        4,
        "promo2026",
      ),
    ).toBe("https://biggieyes.com/app?ref=slot4:promo2026");
  });

  it("extracts the paid ticket id from the matching chapter mint event", () => {
    const buyer = "0x1111111111111111111111111111111111111111";
    const receipt = {
      logs: [
        {
          fragment: { name: "ChapterMintRequested" },
          args: { chapterId: 2n, user: buyer, ticketId: 601n },
        },
      ],
    };

    expect(
      extractMintedTicketIdFromReceipt(receipt, null, 2, buyer),
    ).toBe(601n);
    expect(
      extractMintedTicketIdFromReceipt(receipt, null, 3, buyer),
    ).toBeNull();
  });
});
