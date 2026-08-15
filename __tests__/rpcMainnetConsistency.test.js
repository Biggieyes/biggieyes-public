import { describe, expect, it } from "vitest";

import {
  ACTIVE_CHAIN,
  getRpcUrls,
  getWalletRpcUrls,
} from "../src/shared/utils/rpcConfig.js";

function hostOf(url) {
  return new URL(url).hostname.toLowerCase();
}

describe("Polygon mainnet RPC configuration", () => {
  it("targets Polygon mainnet and exposes usable filtered RPC URLs", () => {
    expect(ACTIVE_CHAIN.chainId).toBe(137);
    expect(ACTIVE_CHAIN.hex).toBe("0x89");
    expect(ACTIVE_CHAIN.currency?.symbol).toBe("POL");
    expect(ACTIVE_CHAIN.explorer).toContain("polygonscan.com");

    const urls = getRpcUrls();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => /^https?:\/\//i.test(url))).toBe(true);
    expect(urls.map(hostOf)).not.toContain("polygon-rpc.com");
  });

  it("uses the same filtered endpoints for wallet chain registration", () => {
    const urls = getWalletRpcUrls({ preferPublicFirst: true });

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => /^https?:\/\//i.test(url))).toBe(true);
    expect(urls.map(hostOf)).not.toContain("polygon-rpc.com");
  });
});
