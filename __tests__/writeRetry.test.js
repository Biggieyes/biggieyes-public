import { describe, expect, it, vi } from "vitest";
import { runWriteWithRpcRetry } from "../src/shared/utils/writeRetry";

describe("runWriteWithRpcRetry", () => {
  it("retries once on rate limit and then succeeds", async () => {
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce({ code: -32005, message: "rate limited" })
      .mockResolvedValueOnce({ hash: "0xtx" });
    const onRateLimitRetry = vi.fn().mockResolvedValue(undefined);
    const waitFn = vi.fn().mockResolvedValue(undefined);

    const tx = await runWriteWithRpcRetry(sendFn, {
      maxRetries: 2,
      baseDelayMs: 100,
      delayStepMs: 50,
      isRateLimitError: (err) => Number(err?.code) === -32005,
      onRateLimitRetry,
      waitFn,
    });

    expect(tx).toEqual({ hash: "0xtx" });
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(onRateLimitRetry).toHaveBeenCalledTimes(1);
    expect(waitFn).toHaveBeenCalledTimes(1);
    expect(waitFn).toHaveBeenCalledWith(100);
  });

  it("throws immediately for non-rate-limit errors", async () => {
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("execution reverted"));
    const onRateLimitRetry = vi.fn().mockResolvedValue(undefined);
    const waitFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      runWriteWithRpcRetry(sendFn, {
        maxRetries: 2,
        isRateLimitError: () => false,
        onRateLimitRetry,
        waitFn,
      }),
    ).rejects.toThrow("execution reverted");

    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(onRateLimitRetry).not.toHaveBeenCalled();
    expect(waitFn).not.toHaveBeenCalled();
  });
});

