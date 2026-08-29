import { describe, expect, it, vi } from "vitest";

import { queryLogsBatched } from "../src/shared/utils/shared.js";

describe("RPC log failover", () => {
  it("moves an eth_getLogs scan to the next backend after a transient failure", async () => {
    const first = {
      getLogs: vi.fn(async () => {
        const error = new Error("service unavailable");
        error.code = "SERVER_ERROR";
        error.status = 503;
        throw error;
      }),
    };
    const second = {
      getLogs: vi.fn(async () => []),
    };
    const fallback = {
      getNetwork: vi.fn(async () => ({ chainId: 137n })),
      providerConfigs: [{ provider: first }, { provider: second }],
    };
    const contract = {
      runner: fallback,
      target: "0x0000000000000000000000000000000000000001",
    };

    await expect(
      queryLogsBatched(contract, {}, 100, 100, 1, {
        disableLookbackClamp: true,
        preferArchive: false,
      }),
    ).resolves.toEqual([]);

    expect(first.getLogs).toHaveBeenCalledTimes(1);
    expect(second.getLogs).toHaveBeenCalledTimes(1);
  });
});
