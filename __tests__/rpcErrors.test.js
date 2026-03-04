import { describe, expect, it } from "vitest";
import { isRateLimitedRpcError } from "../src/shared/utils/rpcErrors";

describe("isRateLimitedRpcError", () => {
  it("detects -32005 rate limit errors", () => {
    expect(
      isRateLimitedRpcError({
        code: -32005,
        message: "Request is being rate limited.",
      }),
    ).toBe(true);
  });

  it("detects -32603 with rate limited message", () => {
    expect(
      isRateLimitedRpcError({
        code: -32603,
        message: "Request is being rate limited.",
      }),
    ).toBe(true);
  });

  it("detects http 429 inside nested payloads", () => {
    expect(
      isRateLimitedRpcError({
        code: "UNKNOWN_ERROR",
        info: {
          error: {
            code: -32005,
            data: { httpStatus: 429 },
          },
        },
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(
      isRateLimitedRpcError({
        code: -32603,
        message: "execution reverted: NotOwner",
      }),
    ).toBe(false);
  });
});

