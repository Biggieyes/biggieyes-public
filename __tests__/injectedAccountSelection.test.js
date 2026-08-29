import { describe, expect, it, vi } from "vitest";

import { requestInjectedAccounts } from "../src/shared/utils/injectedProviders.js";

const CURRENT_ACCOUNT = "0x1234567890123456789012345678901234567890";

describe("injected account selection", () => {
  it("requests account permission before reading the selected account", async () => {
    const request = vi.fn(async ({ method }) => {
      if (method === "wallet_requestPermissions") return [];
      if (method === "eth_requestAccounts") return [CURRENT_ACCOUNT];
      return null;
    });

    await expect(
      requestInjectedAccounts({ request }, { forceSelection: true }),
    ).resolves.toEqual([CURRENT_ACCOUNT]);

    expect(request.mock.calls.map(([payload]) => payload.method)).toEqual([
      "wallet_requestPermissions",
      "eth_requestAccounts",
    ]);
    expect(request.mock.calls[0][0].params).toEqual([{ eth_accounts: {} }]);
  });

  it("falls back when the wallet does not support permission requests", async () => {
    const request = vi.fn(async ({ method }) => {
      if (method === "wallet_requestPermissions") {
        const error = new Error("Unsupported method");
        error.code = 4200;
        throw error;
      }
      return [CURRENT_ACCOUNT];
    });

    await expect(
      requestInjectedAccounts({ request }, { forceSelection: true }),
    ).resolves.toEqual([CURRENT_ACCOUNT]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not hide a rejected account selection", async () => {
    const rejection = new Error("User rejected the request");
    rejection.code = 4001;
    const request = vi.fn().mockRejectedValue(rejection);

    await expect(
      requestInjectedAccounts({ request }, { forceSelection: true }),
    ).rejects.toBe(rejection);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
