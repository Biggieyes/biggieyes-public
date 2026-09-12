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
      buildModeratorReferralLink("https://biggieyes.com/app", 4, "promo2026"),
    ).toBe("https://biggieyes.com/app?ref=slot4%3Apromo2026");
  });

  it("supports slot zero and preserves special characters in referral codes", () => {
    const code = "launch+2026 & friends/#";
    expect(buildModeratorReferralValue(0, code)).toBe(`slot0:${code}`);
    const link = buildModeratorReferralLink(
      "https://biggieyes.com/app/",
      0,
      code,
    );
    expect(extractReferralParam(link)).toBe(`slot0:${code}`);
    expect(new URL(link).pathname).toBe("/app/");
  });

  it("replaces stale referral params including the hash route", () => {
    const link = buildModeratorReferralLink(
      "https://biggieyes.com/app/?ref=old&chapter=1#/home?panel=user&ref=stale",
      0,
      "new",
    );
    expect(extractReferralParam(link)).toBe("slot0:new");
    expect(new URL(link).searchParams.get("chapter")).toBe("1");
    expect(new URL(link).hash).toBe("#/home?panel=user");
    expect(
      extractReferralParam(
        buildModeratorReferralLink(
          "https://biggieyes.com/app/#ref=stale",
          0,
          "new",
        ),
      ),
    ).toBe("slot0:new");
  });

  it("rejects invalid slots and non-web referral URLs", () => {
    for (const slot of [null, undefined, "", -1, 10, 1.5, "abc"]) {
      expect(buildModeratorReferralValue(slot, "code")).toBe("");
    }
    expect(buildModeratorReferralLink("javascript:alert(1)", 0, "code")).toBe(
      "",
    );
    expect(buildModeratorReferralLink("not-a-url", 0, "code")).toBe("");
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

    expect(extractMintedTicketIdFromReceipt(receipt, null, 2, buyer)).toBe(
      601n,
    );
    expect(
      extractMintedTicketIdFromReceipt(receipt, null, 3, buyer),
    ).toBeNull();
  });
});
