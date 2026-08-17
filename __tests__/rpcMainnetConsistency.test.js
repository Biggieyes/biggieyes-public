import { describe, expect, it } from "vitest";

import {
  ACTIVE_CHAIN,
  getRpcUrls,
  getWalletRpcUrls,
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
import { getReadOnlyContract } from "../src/shared/utils/contract.js";

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
      main2: "0xcA168A6e391a54de4F664397eE17328280305A75",
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
