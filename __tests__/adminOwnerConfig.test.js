import { describe, expect, it } from "vitest";

import { resolveConfiguredAdminOwner } from "../functions/lib/adminOwner.js";

const OWNER = "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2";
const OTHER = "0x8fa5C9545B2eEF1ca3c6533951C286e05928f27B";

describe("server admin owner configuration", () => {
  it("accepts one canonical owner across chat and community", () => {
    expect(
      resolveConfiguredAdminOwner({
        chatOwnerAddress: OWNER,
        communityOwnerAddress: OWNER.toLowerCase(),
      }),
    ).toBe(OWNER.toLowerCase());
  });

  it("fails closed when server admin owners diverge", () => {
    expect(() =>
      resolveConfiguredAdminOwner({
        chatOwnerAddress: OWNER,
        communityOwnerAddress: OTHER,
      }),
    ).toThrow("do not match");
  });

  it("rejects malformed configured owner values", () => {
    expect(() =>
      resolveConfiguredAdminOwner({ chatOwnerAddress: "not-an-address" }),
    ).toThrow("valid EVM address");
  });
});
