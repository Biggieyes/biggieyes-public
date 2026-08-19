import { describe, expect, it } from "vitest";
import {
  getNextVrfPollDelayMs,
  shouldRunHeavyVrfRefresh,
  shouldRunWalletAssetRefresh,
} from "../src/shared/utils/vrfPolling";

describe("vrfPolling helpers", () => {
  it("skips heavy refresh while RPC backoff is active", () => {
    expect(shouldRunHeavyVrfRefresh(1, true)).toBe(false);
    expect(shouldRunHeavyVrfRefresh(8, true)).toBe(false);
  });

  it("runs heavy refresh conservatively when backoff is not active", () => {
    expect(shouldRunHeavyVrfRefresh(1, false)).toBe(true);
    expect(shouldRunHeavyVrfRefresh(2, false)).toBe(true);
    expect(shouldRunHeavyVrfRefresh(3, false)).toBe(false);
  });

  it("throttles wallet asset refresh cadence", () => {
    expect(shouldRunWalletAssetRefresh(6, false)).toBe(true);
    expect(shouldRunWalletAssetRefresh(5, false)).toBe(false);
    expect(shouldRunWalletAssetRefresh(6, true)).toBe(false);
  });

  it("computes conservative next delays and respects backoff floor", () => {
    expect(getNextVrfPollDelayMs(30_000, false)).toBe(6_000);
    expect(getNextVrfPollDelayMs(180_000, false)).toBe(10_000);
    expect(getNextVrfPollDelayMs(900_000, false)).toBe(18_000);
    expect(getNextVrfPollDelayMs(20_000, true)).toBe(12_000);
  });
});

