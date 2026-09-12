import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ipfs, {
  GWS,
  addIpfsGateway,
  fetchWithTimeout,
  getIpfsGatewayCandidates,
  httpFromIpfs,
  readJsonFromURI,
  resolveImageUrl,
} from "../src/shared/services/ipfs.js";
import { IPFS_GATEWAYS } from "../src/shared/utils/ipfs.js";
import { clearCache } from "../src/shared/utils/fetchCache.js";

const originalGateways = [...GWS];
const gateways = ["https://first.example", "https://second.example"];
const path = "QmCaseSensitive/Chapter/Biggi_1_ORANGE_PUBLIC.json";
const uri = `ipfs://${path}`;
const metadata = {
  name: "Original NFT",
  image: "ipfs://QmImageCase/Biggi_1_ORANGE_O.png",
  attributes: [
    { trait_type: "Block", value: "ORANGE" },
    { trait_type: "Background", value: "BLACK" },
    { trait_type: "Ticket Price", value: "1" },
  ],
};

function response(
  data = metadata,
  status = 200,
  contentType = "application/json",
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    body: { cancel: vi.fn(async () => {}) },
    json: vi.fn(async () => data),
  };
}

beforeEach(() => clearCache("ipfs:"));
afterEach(() => {
  GWS.splice(0, GWS.length, ...originalGateways);
  clearCache("ipfs:");
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("IPFS gateway candidates", () => {
  it("deduplicates original URLs without lowercasing CID or filename", () => {
    const original = `https://first.example/ipfs/${path}`;
    expect(
      getIpfsGatewayCandidates(original, [...gateways, gateways[0]]),
    ).toEqual([original, `https://second.example/ipfs/${path}`]);
  });

  it.each(["ipns://", "/ipns/", "ipns/"])(
    "preserves the IPNS namespace for %s",
    (prefix) => {
      expect(
        getIpfsGatewayCandidates(`${prefix}project.example/Art.png`, gateways),
      ).toEqual([
        "https://first.example/ipns/project.example/Art.png",
        "https://second.example/ipns/project.example/Art.png",
      ]);
    },
  );

  it("supports uppercase URI schemes and slash-prefixed IPFS resources", () => {
    expect(getIpfsGatewayCandidates(`IPFS://${path}`, gateways)).toEqual(
      getIpfsGatewayCandidates(`/ipfs/${path}`, gateways),
    );
    expect(httpFromIpfs(`IPFS://${path}`)).toContain(`/ipfs/${path}`);
  });

  it("rejects unsafe builders and continues after a throwing builder", async () => {
    const fetchImpl = vi.fn(async () => response());
    const unsafe = [
      () => {
        throw new Error("broken builder");
      },
      () => "javascript:alert(1)",
      () => "https://127.0.0.1/ipfs/private",
      "https://user:password@gateway.example",
      gateways[1],
    ];
    expect(
      await readJsonFromURI(uri, { gateways: unsafe, fetchImpl, cache: false }),
    ).toEqual(metadata);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `https://second.example/ipfs/${path}`,
    );
    expect(
      getIpfsGatewayCandidates("https://127.0.0.1/ipfs/private", gateways),
    ).toEqual([]);
  });

  it("keeps added gateways visible through default and legacy exports", () => {
    addIpfsGateway((p) => `https://builder.example/ipfs/${p}`);
    addIpfsGateway("https://custom.example");
    expect(ipfs.GWS).toBe(GWS);
    expect(IPFS_GATEWAYS).toBe(GWS);
    expect(IPFS_GATEWAYS[0](path)).toBe(`https://custom.example/ipfs/${path}`);
    expect(getIpfsGatewayCandidates(uri)).toContain(
      `https://builder.example/ipfs/${path}`,
    );
    addIpfsGateway("https://127.0.0.1");
    expect(httpFromIpfs(uri)).toBe(`https://custom.example/ipfs/${path}`);
  });

  it("does not include retired Cloudflare hostnames in defaults", () => {
    expect(
      getIpfsGatewayCandidates(uri).some((url) =>
        /cloudflare-ipfs\.com|cf-ipfs\.com/.test(url),
      ),
    ).toBe(false);
  });

  it("respects Pinata-only mode and an explicit custom primary", async () => {
    vi.stubEnv("VITE_IPFS_PINATA_ONLY", "1");
    vi.stubEnv("VITE_PINATA_GATEWAY_URL", "https://project.mypinata.cloud");
    vi.stubEnv("VITE_IPFS_GATEWAY_URL", "https://custom.example");
    vi.resetModules();
    const isolated = await import("../src/shared/services/ipfs.js");
    expect(
      isolated
        .getIpfsGatewayCandidates(uri)
        .map((url) => new URL(url).hostname),
    ).toEqual([
      "custom.example",
      "project.mypinata.cloud",
      "gateway.pinata.cloud",
    ]);
    expect(isolated.httpFromIpfs(uri)).toBe(
      `https://custom.example/ipfs/${path}`,
    );
    vi.resetModules();
  });
});

describe("IPFS request reliability", () => {
  it.each([401, 402, 403, 404, 429, 503])(
    "falls back after HTTP %s without changing metadata",
    async (status) => {
      const rejected = response({}, status);
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(rejected)
        .mockResolvedValueOnce(response());
      const result = await readJsonFromURI(uri, {
        gateways,
        fetchImpl,
        cache: false,
      });
      expect(result).toEqual(metadata);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(rejected.body.cancel).toHaveBeenCalled();
      expect(
        fetchImpl.mock.calls.map(([url]) => new URL(url).pathname),
      ).toEqual([`/ipfs/${path}`, `/ipfs/${path}`]);
      expect(
        fetchImpl.mock.calls.every(([, options]) => !options.headers),
      ).toBe(true);
    },
  );

  it("does not retry a duplicate original gateway URL", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 429))
      .mockResolvedValueOnce(response());
    await readJsonFromURI(`https://first.example/ipfs/${path}`, {
      gateways: [...gateways, gateways[0]],
      fetchImpl,
      cache: false,
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `https://first.example/ipfs/${path}`,
      `https://second.example/ipfs/${path}`,
    ]);
  });

  it("falls back after HTML and invalid JSON responses", async () => {
    const invalid = response();
    invalid.json.mockRejectedValue(new SyntaxError("invalid JSON"));
    const html = response({}, 200, "Text/HTML; charset=utf-8");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(html)
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(response());
    expect(
      await readJsonFromURI(uri, {
        gateways: [...gateways, "https://third.example"],
        fetchImpl,
        cache: false,
      }),
    ).toEqual(metadata);
    expect(html.json).not.toHaveBeenCalled();
    expect(html.body.cancel).toHaveBeenCalled();
  });

  it("times out a stalled JSON body, aborts it, then uses the next gateway", async () => {
    vi.useFakeTimers();
    const stuck = response();
    stuck.json.mockImplementation(() => new Promise(() => {}));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(stuck)
      .mockResolvedValueOnce(response());
    const result = readJsonFromURI(uri, {
      gateways,
      fetchImpl,
      timeout: 50,
      totalTimeout: 100,
      cache: false,
    });
    await vi.advanceTimersByTimeAsync(51);
    expect(await result).toEqual(metadata);
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    expect(stuck.body.cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("limits the entire fallback chain, not just each individual attempt", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise(() => {}));
    const result = readJsonFromURI(uri, {
      gateways: [...gateways, "https://third.example"],
      fetchImpl,
      timeout: 80,
      totalTimeout: 100,
      cache: false,
    });
    await vi.advanceTimersByTimeAsync(101);
    expect(await result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      fetchImpl.mock.calls.every(([, options]) => options.signal.aborted),
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up a response that arrives after its timeout", async () => {
    vi.useFakeTimers();
    let finish;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const result = fetchWithTimeout(
      "https://gateway.example",
      20,
      fetchImpl,
    ).catch((e) => e.name);
    await vi.advanceTimersByTimeAsync(21);
    expect(await result).toBe("TimeoutError");
    const late = response();
    finish(late);
    await Promise.resolve();
    expect(late.body.cancel).toHaveBeenCalled();
  });

  it("deduplicates concurrent reads and caches success but not failed metadata", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValue(response());
    const options = { gateways: [gateways[0]], fetchImpl };
    expect(await readJsonFromURI(uri, options)).toBeNull();
    const first = readJsonFromURI(uri, options);
    const second = readJsonFromURI(uri, options);
    expect(await first).toEqual(metadata);
    expect(await second).toEqual(metadata);
    expect(await readJsonFromURI(uri, options)).toEqual(metadata);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps the header-only fetchWithTimeout API compatible", async () => {
    const expected = response();
    expect(
      await fetchWithTimeout(
        "https://gateway.example",
        100,
        async () => expected,
      ),
    ).toBe(expected);
  });

  it("uses a bounded default for malformed timeout options", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise(() => {}));
    const result = readJsonFromURI(uri, {
      gateways: [
        ...gateways,
        "https://third.example",
        "https://fourth.example",
      ],
      fetchImpl,
      timeout: NaN,
      totalTimeout: Infinity,
      cache: false,
    });
    await vi.advanceTimersByTimeAsync(20001);
    expect(await result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("IPFS images", () => {
  it("rejects JSON error pages as images and cancels probe downloads", async () => {
    const json = response({ error: "not found" });
    const image = response(null, 200, "image/png");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json)
      .mockResolvedValueOnce(image);
    expect(
      await resolveImageUrl(metadata.image, uri, {
        gateways,
        fetchImpl,
        cache: false,
      }),
    ).toBe("https://second.example/ipfs/QmImageCase/Biggi_1_ORANGE_O.png");
    expect(json.body.cancel).toHaveBeenCalled();
    expect(image.body.cancel).toHaveBeenCalled();
  });

  it("retains an img fallback when browser fetch is blocked by CORS", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(
      await resolveImageUrl(metadata.image, uri, {
        gateways,
        fetchImpl,
        cache: false,
      }),
    ).toBe("https://first.example/ipfs/QmImageCase/Biggi_1_ORANGE_O.png");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("resolves relative image paths correctly and tries equivalent gateways", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValue(response(null, 200, "image/png"));
    const result = await resolveImageUrl(
      "../images/Art.PNG",
      "https://first.example/ipfs/QmCase/meta/1.json",
      {
        gateways,
        fetchImpl,
        cache: false,
      },
    );
    expect(result).toBe("https://second.example/ipfs/QmCase/images/Art.PNG");
  });

  it("does not probe ordinary HTTPS or local application images", async () => {
    const fetchImpl = vi.fn();
    expect(
      await resolveImageUrl("https://media.example/Art.png", "", {
        fetchImpl,
        cache: false,
      }),
    ).toBe("https://media.example/Art.png");
    expect(
      await resolveImageUrl("/images/Biggi.png", "", {
        fetchImpl,
        cache: false,
      }),
    ).toBe("/images/Biggi.png");
    expect(
      await resolveImageUrl("//unsafe.example/a.png", uri, {
        fetchImpl,
        cache: false,
      }),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
