import { describe, expect, it, vi } from "vitest";
import {
  sendWriteOnce,
  waitForWriteReceipt,
} from "../src/shared/utils/writeRetry";

describe("sendWriteOnce", () => {
  it.each([
    { code: -32005, message: "429 after accepted submission" },
    { code: "TIMEOUT", message: "Response lost" },
    { code: 4001, message: "Rejected" },
    { code: "CALL_EXCEPTION", message: "execution reverted" },
  ])(
    "never repeats a failed or ambiguous submission ($code)",
    async (error) => {
      const send = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ hash: "new" });
      await expect(sendWriteOnce(send)).rejects.toBe(error);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it("returns the original transaction without submitting another", async () => {
    const tx = { hash: "original", wait: vi.fn() };
    const send = vi.fn().mockResolvedValue(tx);
    expect(await sendWriteOnce(send)).toBe(tx);
    expect(send).toHaveBeenCalledTimes(1);
    expect(tx.wait).not.toHaveBeenCalled();
  });
});

describe("confirmed write receipts", () => {
  it("waits for the receipt rather than treating a hash as success", async () => {
    const receipt = { status: 1, hash: "confirmed" };
    const tx = { hash: "pending", wait: vi.fn().mockResolvedValue(receipt) };
    expect(await waitForWriteReceipt(tx)).toBe(receipt);
    expect(tx.wait).toHaveBeenCalledOnce();
  });
  it("accepts a successful gas repricing but not cancellation or replacement", async () => {
    const receipt = { status: 1, hash: "repriced" };
    const error = {
      code: "TRANSACTION_REPLACED",
      reason: "repriced",
      cancelled: false,
      receipt,
    };
    const tx = { wait: vi.fn().mockRejectedValue(error) };
    expect(await waitForWriteReceipt(tx)).toBe(receipt);
    error.cancelled = true;
    await expect(waitForWriteReceipt(tx)).rejects.toBe(error);
    error.cancelled = false;
    error.reason = "replaced";
    await expect(waitForWriteReceipt(tx)).rejects.toBe(error);
  });
  it.each([null, { status: 0 }])(
    "rejects a missing or reverted receipt",
    async (receipt) => {
      await expect(
        waitForWriteReceipt({ wait: async () => receipt }),
      ).rejects.toThrow("not confirmed");
    },
  );
});
