import { describe, expect, it } from "vitest";

import { isExhaustedFallbackError, isRateLimitedRpcError } from "../src/shared/utils/rpcErrors.js";

describe("RPC error classification", () => {
  it("recognizes exhausted ethers bootstrap without calling it a rate limit", () => {
    const error = new Error("no runners?!");
    expect(isExhaustedFallbackError(error)).toBe(true);
    expect(isExhaustedFallbackError({info:{error}})).toBe(true);
    expect(isRateLimitedRpcError(error)).toBe(false);
  });

  it("does not treat wallet rejection or a contract revert as provider exhaustion", () => {
    expect(isExhaustedFallbackError({code:"ACTION_REJECTED", message:"no runners?!"})).toBe(false);
    expect(isExhaustedFallbackError({code:"CALL_EXCEPTION", message:"no runners?!"})).toBe(false);
    const cyclic = {}; cyclic.cause = cyclic;
    expect(isExhaustedFallbackError(cyclic)).toBe(false);
  });
  it("detects direct -32005 rate limit errors", () => {
    expect(
      isRateLimitedRpcError({
        code: -32005,
        message: "Request is being rate limited.",
      }),
    ).toBe(true);
  });

  it("detects rate-limit messages with generic provider codes", () => {
    expect(
      isRateLimitedRpcError({
        code: -32603,
        message: "Request is being rate limited.",
      }),
    ).toBe(true);
  });

  it("detects HTTP 429 inside nested provider payloads", () => {
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

  it("detects Infura rate limits nested in a malformed mixed batch", () => {
    const error = {
      code: "BAD_DATA",
      message: "missing response for request",
      value: [
        { id: 18, jsonrpc: "2.0", result: "0x01" },
        {
          code: -32005,
          data: { see: "https://infura.io/dashboard" },
          message: "Too Many Requests",
        },
      ],
    };

    expect(isRateLimitedRpcError(error)).toBe(true);
  });

  it("does not classify ordinary contract reverts as rate limits", () => {
    expect(
      isRateLimitedRpcError({
        code: "CALL_EXCEPTION",
        shortMessage: "execution reverted",
      }),
    ).toBe(false);
  });
});
