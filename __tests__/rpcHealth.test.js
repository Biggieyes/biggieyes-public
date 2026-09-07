// @vitest-environment node
import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { checkRpcHealth } from "../src/shared/utils/rpcConfig.js";

async function withRpcServer(handler, test) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    requests.push({ method: req.method, payload });
    handler(payload, res);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await test(
      `http://127.0.0.1:${server.address().port}/private-key`,
      requests,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function rpcReply(payload, res, chainId = "0x89", block = "0x12345") {
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: payload.id,
      result: payload.method === "eth_chainId" ? chainId : block,
    }),
  );
}

describe("read-only Polygon RPC health probe", () => {
  it("respects disabled public fallback for both reads and wallet registration", async () => {
    vi.resetModules();
    for (const key of [
      "VITE_JSON_RPC_URL",
      "VITE_POLYGON_RPC_URL",
      "VITE_RPC_URL_POLYGON",
      "VITE_RPC_URL_ACTIVE_CHAIN",
      "VITE_MAINNET_RPC_URL",
      "VITE_MOD_CHAIN_RPC",
      "VITE_ADDITIONAL_RPC_URLS",
      "VITE_INFURA_PROJECT_ID",
    ])
      vi.stubEnv(key, "");
    vi.stubEnv("VITE_ALLOW_PUBLIC_RPCS", "0");
    vi.stubEnv("VITE_WALLET_PUBLIC_RPC_FALLBACK", "0");
    try {
      const { getRpcUrls, getWalletRpcUrls } =
        await import("../src/shared/utils/rpcConfig.js");
      expect(getRpcUrls()).toEqual([]);
      expect(getWalletRpcUrls()).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("sends JSON-RPC POSTs and checks chain ID and block height", async () => {
    await withRpcServer(rpcReply, async (url, requests) => {
      await expect(checkRpcHealth(url)).resolves.toMatchObject({
        ok: true,
        chainId: 137,
        blockNumber: 74565,
      });
      expect(requests.every(({ method }) => method === "POST")).toBe(true);
      expect(requests.every(({ payload }) => !Array.isArray(payload))).toBe(
        true,
      );
      expect(requests.map(({ payload }) => payload.method)).toEqual(
        expect.arrayContaining(["eth_chainId", "eth_blockNumber"]),
      );
    });
  });

  it.each(["0x1", "0x13882"])(
    "rejects the wrong network %s",
    async (chainId) => {
      await withRpcServer(
        (payload, res) => rpcReply(payload, res, chainId),
        async (url) => {
          await expect(checkRpcHealth(url)).resolves.toMatchObject({
            ok: false,
            error: expect.stringContaining("chainId mismatch"),
          });
        },
      );
    },
  );

  it.each([NaN, Infinity, 0, -1, 137.5, "undefined", "137", 1, 80002])(
    "rejects invalid expected chain ID %s before a network request",
    async (expectedChainId) => {
      await expect(
        checkRpcHealth("https://rpc.invalid", { expectedChainId }),
      ).resolves.toEqual({
        ok: false,
        error: "expectedChainId must be Polygon mainnet (137)",
      });
    },
  );

  it.each([
    undefined,
    "",
    "undefined",
    "https://",
    "wss://rpc.invalid",
    "https://rpc.invalid/key with space",
  ])("rejects an invalid HTTP(S) URL without echoing it", async (url) => {
    await expect(checkRpcHealth(url)).resolves.toEqual({
      ok: false,
      error: "Invalid HTTP(S) RPC URL",
    });
  });

  it.each([401, 402, 403, 429])(
    "reports HTTP %s without response-body or key leaks",
    async (status) => {
      await withRpcServer(
        (_payload, res) => {
          res.writeHead(status, { "content-type": "text/plain" });
          res.end("private-key and provider-secret in response body");
        },
        async (url, requests) => {
          await expect(checkRpcHealth(url)).resolves.toEqual({
            ok: false,
            error: `HTTP ${status}`,
          });
          expect(requests).toHaveLength(1);
        },
      );
    },
  );

  it("reports JSON-RPC rate limiting without the provider message", async () => {
    await withRpcServer(
      (payload, res) => {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: payload.id,
            error: { code: -32005, message: "Quota exceeded for private-key" },
          }),
        );
      },
      async (url) => {
        await expect(checkRpcHealth(url)).resolves.toEqual({
          ok: false,
          error: "JSON-RPC error -32005",
        });
      },
    );
  });

  it("fails on a stalled endpoint within the configured timeout", async () => {
    await withRpcServer(
      () => {},
      async (url) => {
        const result = await checkRpcHealth(url, { timeoutMs: 100 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/TIMEOUT|timed out/);
        expect(result.error).not.toContain("private-key");
      },
    );
  });

  it("does not treat a zero block height as healthy", async () => {
    await withRpcServer(
      (payload, res) => rpcReply(payload, res, "0x89", "0x0"),
      async (url) => {
        await expect(checkRpcHealth(url)).resolves.toEqual({
          ok: false,
          error: "blockNumber unavailable",
        });
      },
    );
  });

  it.each(["undefined", "null", "  ", "key with space", "key?query=1"])(
    "does not construct an Infura endpoint from placeholder or malformed identifiers",
    async (value) => {
      vi.resetModules();
      vi.stubEnv("VITE_INFURA_PROJECT_ID", value);
      try {
        const { getRpcUrls } = await import("../src/shared/utils/rpcConfig.js");
        expect(
          getRpcUrls().some((url) =>
            new URL(url).hostname.endsWith(".infura.io"),
          ),
        ).toBe(false);
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }
    },
  );
});
