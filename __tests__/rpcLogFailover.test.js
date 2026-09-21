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

  it("moves a rejected log range to the next configured backend", async () => {
    const first = {
      getLogs: vi.fn(async () => {
        const error = new Error(
          "ranges over 10000 blocks are not supported on free plan",
        );
        error.code = 35;
        throw error;
      }),
    };
    const expected = [{ blockNumber: 120 }];
    const second = {
      getLogs: vi.fn(async () => expected),
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
      queryLogsBatched(contract, {}, 100, 200, 101, {
        disableLookbackClamp: true,
        preferArchive: false,
      }),
    ).resolves.toEqual(expected);

    expect(first.getLogs).toHaveBeenCalledTimes(1);
    expect(second.getLogs).toHaveBeenCalledTimes(1);
  });
});
