import { AbstractProvider, FallbackProvider } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import { isExhaustedFallbackError } from "../src/shared/utils/rpcErrors.js";

const created = [];
afterEach(() => {
  created.forEach((provider) => provider.destroy());
  created.length = 0;
});

// Exercise the installed ethers implementation; no HTTP requests or transactions.
class Endpoint extends AbstractProvider {
  offline = true;
  probes = 0;
  constructor() {
    super(137, { cacheTimeout: -1 });
    created.push(this);
  }
  async _detectNetwork() {
    return (await import("ethers")).Network.from(137);
  }
  async _perform(request) {
    if (request.method === "getBlockNumber") {
      this.probes += 1;
      if (this.offline) throw new Error("Temporary bootstrap outage");
      return 100;
    }
    if (request.method === "getBalance") return 5n;
    throw new Error(`Unexpected read ${request.method}`);
  }
}
describe("ethers bootstrap exhaustion", () => {
  it("recovers after reconstructing a fallback that permanently excluded failed runners", async () => {
    const endpoints = [new Endpoint(), new Endpoint()];
    const make = () => {
      const provider = new FallbackProvider(endpoints, 137, {
        quorum: 1,
        cacheTimeout: -1,
      });
      created.push(provider);
      return provider;
    };
    const broken = make();
    const wallet = `0x${"1".repeat(40)}`;
    let original;
    try {
      await broken.getBalance(wallet);
    } catch (error) {
      original = error;
    }
    expect(isExhaustedFallbackError(original)).toBe(true);
    endpoints.forEach((endpoint) => {
      endpoint.offline = false;
    });
    await expect(broken.getBalance(wallet)).rejects.toThrow("no runners?!");
    expect(endpoints.map((endpoint) => endpoint.probes)).toEqual([1, 1]);
    await expect(make().getBalance(wallet)).resolves.toBe(5n);
    expect(endpoints.map((endpoint) => endpoint.probes)).toEqual([2, 2]);
  });
});
