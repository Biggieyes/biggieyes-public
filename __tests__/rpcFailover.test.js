import { FallbackProvider } from "ethers";
import { afterEach, describe, expect, it } from "vitest";

import {
  createFallbackProvider,
  resetSharedFallbackProvider as resetProviderCache,
} from "../src/web3/rpcProviders.js";
import {
  getProvider,
  resetSharedFallbackProvider,
} from "../src/web3/provider.js";

afterEach(() => {
  resetSharedFallbackProvider();
  resetProviderCache();
});

describe("Polygon RPC failover", () => {
  it("enables sequential ethers fallback by default", () => {
    const provider = createFallbackProvider([
      "https://rpc-a.example",
      "https://rpc-b.example",
      "https://rpc-c.example",
    ]);

    expect(provider).toBeInstanceOf(FallbackProvider);
    expect(provider.providerConfigs).toHaveLength(3);
    expect(provider.providerConfigs.map((entry) => entry.priority)).toEqual([
      1, 2, 3,
    ]);
    expect(
      provider.providerConfigs.every((entry) => entry.stallTimeout >= 250),
    ).toBe(true);

    provider.destroy();
  });

  it("clears both provider cache layers during RPC rotation", () => {
    const first = getProvider({ forceRefresh: true });

    resetSharedFallbackProvider();
    const second = getProvider();

    expect(second).not.toBe(first);
  });
});
