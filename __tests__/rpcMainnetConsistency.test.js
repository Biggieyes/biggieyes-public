import { describe, expect, it, vi } from "vitest";

import {
  ACTIVE_CHAIN,
  getRpcBatchMaxCount,
  getRpcUrls,
  getWalletRpcUrls,
  isKnownPolygonTestnetRpcUrl,
} from "../src/shared/utils/rpcConfig.js";
import { CHAINS, getChainInfo } from "../src/config/chains.js";
import {
  getAddresses,
  resolveChainKey,
} from "../src/config/addresses/index.js";
import { getContractMeta } from "../src/config/contracts/index.js";
import {
  ADDR,
  CORE_CHAPTERS,
  getCoreChapter,
  getLiquidityAddresses,
  getTokenDexAddresses,
} from "../src/shared/utils/addresses.js";
import {
  ensurePolygon,
  getReadOnlyContract,
} from "../src/shared/utils/contract.js";

function hostOf(url) {
  return new URL(url).hostname.toLowerCase();
}

describe("Polygon mainnet RPC configuration", () => {
  it("keeps JSON-RPC batches within provider-safe limits", () => {
    expect(
      getRpcBatchMaxCount("https://polygon-mainnet.infura.io/v3/example"),
    ).toBe(1);
    expect(getRpcBatchMaxCount("https://polygon.drpc.org")).toBe(3);
    expect(getRpcBatchMaxCount("https://polygon.publicnode.com")).toBe(5);
    expect(getRpcBatchMaxCount("https://rpc.example")).toBe(5);
  });

  it("targets Polygon mainnet and exposes usable filtered RPC URLs", () => {
    expect(ACTIVE_CHAIN.chainId).toBe(137);
    expect(ACTIVE_CHAIN.hex).toBe("0x89");
    expect(ACTIVE_CHAIN.currency?.symbol).toBe("POL");
    expect(ACTIVE_CHAIN.explorer).toContain("polygonscan.com");

    const urls = getRpcUrls();
    expect(urls.length).toBeGreaterThanOrEqual(3);
    expect(urls.every((url) => /^https?:\/\//i.test(url))).toBe(true);
    expect(urls.map(hostOf)).not.toContain("polygon-rpc.com");
    expect(new Set(urls.map(hostOf)).size).toBeGreaterThanOrEqual(3);
    expect(urls.map(hostOf)).toEqual(
      expect.arrayContaining([
        "polygon.drpc.org",
        "polygon.publicnode.com",
        "1rpc.io",
      ]),
    );
    expect(urls.every((url) => !isKnownPolygonTestnetRpcUrl(url))).toBe(true);
  });

  it("uses the same filtered endpoints for wallet chain registration", () => {
    const urls = getWalletRpcUrls({ preferPublicFirst: true });

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => /^https?:\/\//i.test(url))).toBe(true);
    expect(urls.map(hostOf)).not.toContain("polygon-rpc.com");
    expect(urls.every((url) => !isKnownPolygonTestnetRpcUrl(url))).toBe(true);
    expect(
      isKnownPolygonTestnetRpcUrl(
        "https://polygon-amoy.g.alchemy.com/v2/example",
      ),
    ).toBe(true);
    expect(
      isKnownPolygonTestnetRpcUrl("https://rpc-amoy.polygon.technology"),
    ).toBe(true);
    expect(isKnownPolygonTestnetRpcUrl("https://polygon.drpc.org")).toBe(
      false,
    );
  });

  it("does not request network registration when MetaMask is already on Polygon", async () => {
    const provider = {
      request: vi.fn(async ({ method }) => {
        if (method === "eth_chainId") return "0x89";
        throw new Error(`Unexpected wallet method: ${method}`);
      }),
    };

    await expect(ensurePolygon(provider)).resolves.toBe(true);
    expect(provider.request).toHaveBeenCalledTimes(1);
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_chainId" });
  });

  it("switches to an existing Polygon network without adding it again", async () => {
    const provider = {
      request: vi.fn(async ({ method }) => {
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_switchEthereumChain") return null;
        throw new Error(`Unexpected wallet method: ${method}`);
      }),
    };

    await expect(ensurePolygon(provider)).resolves.toBe(true);
    expect(provider.request).toHaveBeenCalledTimes(2);
    expect(provider.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "wallet_addEthereumChain" }),
    );
  });

  it("rejects unsupported networks instead of falling back to Polygon addresses", () => {
    expect(Object.keys(CHAINS)).toEqual(["137"]);
    expect(getChainInfo(137)?.name).toBe("Polygon mainnet");
    expect(getChainInfo(31337)).toBeNull();
    expect(resolveChainKey(137)).toBe("mainnet");
    expect(resolveChainKey("polygon")).toBe("mainnet");
    expect(resolveChainKey(31337)).toBeNull();
    expect(getAddresses(31337)).toBeNull();
    expect(getLiquidityAddresses(31337)).toBeNull();
    expect(getTokenDexAddresses(80002)).toBeNull();
  });

  it("exposes all five deployed CORE chapter pairs and current ticket caps", () => {
    expect(ADDR.SALE_CAP).toBe(500);
    expect(ADDR.MARKETING_CAP).toBe(50);
    expect(ADDR.CHAPTER_COUNT).toBe(5);
    expect(CORE_CHAPTERS).toHaveLength(5);
    expect(getCoreChapter(5)).toMatchObject({
      seriesName: "BIGGI Super Hero",
      main: "0xCA09F0b1f06AD3aA2302ED40Cb12013B84b52B38",
      main2: "0x99f049279BC545469F989d8f06CD915ef4B6f1d4",
      active: false,
    });
    expect(getCoreChapter(6)).toBeNull();
    expect(getContractMeta(137, "CHAPTER_3_MAIN")).toMatchObject({
      address: "0x72e6DE66f340E0243DAF45917E7Ce8057Faeedc2",
      abiName: "BiggiMain",
    });
    expect(() => getContractMeta(80002, "MAIN")).toThrow(
      /supports Polygon mainnet \(137\) only/,
    );
  });

  it("resolves normalized contract kinds to their real mainnet targets", () => {
    const targets = {
      VRF: ADDR.VRF_ROUTER,
      BUYBACK: ADDR.BUYBACK_AGENT,
      POLICY: ADDR.POLICY,
      DRIPdistributor: ADDR.DRIP_DISTRIBUTOR,
      DRIPlm: ADDR.DRIP_LM,
      tokenREWARDS: ADDR.TOKEN_REWARDS,
      COLLECTIONREWARDS: ADDR.COLLECTION_REWARDS,
      nftREWARDS: ADDR.NFT_REWARDS,
      TICKET_HUB: ADDR.TICKET_HUB,
    };

    for (const [kind, expected] of Object.entries(targets)) {
      expect(String(getReadOnlyContract(kind).target).toLowerCase()).toBe(
        expected.toLowerCase(),
      );
    }
  });
});
