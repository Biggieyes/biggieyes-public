// @vitest-environment node
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));

function runCheck(overrides = {}) {
  // Never inherit developer RPC credentials or issue requests to public RPCs.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(VITE_|RPC_|NODE_OPTIONS$)/i.test(key),
    ),
  );
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["scripts/check-rpc-health.mjs"],
      {
        cwd: root,
        env: { ...env, VITE_ALLOW_PUBLIC_RPCS: "0", ...overrides },
        timeout: 10000,
        windowsHide: true,
      },
      (error, stdout, stderr) =>
        resolve({ code: error ? error.code : 0, output: stdout + stderr }),
    );
  });
}

async function withRpcServer(test) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url.includes("failed")) {
      res.writeHead(403);
      res.end("private-provider-key");
      return;
    }
    const block = req.url.includes("stale") ? "0x100" : "0x1000";
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: payload.id,
        result: payload.method === "eth_chainId" ? "0x89" : block,
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await test(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("RPC Health CLI configuration and exit status", () => {
  it("fails clearly without any primary endpoints", async () => {
    expect(await runCheck()).toEqual({
      code: 1,
      output: "No primary RPC URLs configured.\n",
    });
  });

  it.each([
    ["RPC_EXPECTED_CHAIN_ID", "undefined"],
    ["RPC_EXPECTED_CHAIN_ID", "0"],
    ["RPC_EXPECTED_CHAIN_ID", " "],
    ["RPC_EXPECTED_CHAIN_ID", "80002"],
    ["VITE_CHAIN_ID", "1"],
    ["RPC_HEALTH_MIN_HEALTHY", "0.5"],
    ["RPC_HEALTH_MIN_HEALTHY", "0"],
    ["VITE_RPC_MAX_STALE_BLOCKS", "Infinity"],
    ["VITE_RPC_MAX_STALE_BLOCKS", "-1"],
    ["VITE_RPC_HEALTH_TIMEOUT_MS", "NaN"],
    ["RPC_HEALTH_STRICT", "false"],
    ["RPC_HEALTH_INCLUDE_ARCHIVE", "undefined"],
  ])("rejects malformed %s before attempting any RPCs", async (key, value) => {
    const result = await runCheck({ [key]: value });
    expect(result.code).toBe(1);
    expect(result.output).toContain(`Invalid RPC health configuration: ${key}`);
    expect(result.output).not.toContain("Summary:");
  });

  it("rejects a conflicting legacy chain setting even with expected chain 137", async () => {
    const result = await runCheck({
      RPC_EXPECTED_CHAIN_ID: "137",
      VITE_CHAIN_ID: "80002",
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain(
      "VITE_CHAIN_ID must be Polygon mainnet (137)",
    );
  });

  it("does not log malformed configuration values", async () => {
    const result = await runCheck({
      RPC_EXPECTED_CHAIN_ID: "https://rpc.invalid/private-secret",
    });
    expect(result.code).toBe(1);
    expect(result.output).not.toContain("private-secret");
    expect(result.output).not.toContain("rpc.invalid");
  });

  it("allows empty optional settings, verifies mainnet and hides URL paths", async () => {
    await withRpcServer(async (base) => {
      const result = await runCheck({
        VITE_JSON_RPC_URL: `${base}/private-key?apiKey=secret`,
        RPC_HEALTH_MIN_HEALTHY: "1",
        RPC_EXPECTED_CHAIN_ID: "",
        VITE_CHAIN_ID: "",
        RPC_HEALTH_STRICT: "",
        VITE_RPC_MAX_STALE_BLOCKS: "0",
      });
      expect(result.code).toBe(0);
      expect(result.output).toContain("chain=137");
      expect(result.output).toContain("independentHosts=1, required=1");
      expect(result.output).not.toMatch(/private-key|apiKey|secret/);
    });
  });

  it("does not count multiple keys on one host as independent endpoints", async () => {
    await withRpcServer(async (base) => {
      const result = await runCheck({
        VITE_JSON_RPC_URL: `${base}/first`,
        VITE_ADDITIONAL_RPC_URLS: `${base}/second`,
      });
      expect(result.code).toBe(1);
      expect(result.output).toContain(
        "primary=2/2 fresh, independentHosts=1, required=2",
      );
    });
  });

  it("accepts two fresh primary hostnames with the default minimum", async () => {
    await withRpcServer(async (base) => {
      const result = await runCheck({
        VITE_JSON_RPC_URL: `${base}/first`,
        VITE_ADDITIONAL_RPC_URLS: `${base.replace("127.0.0.1", "localhost")}/second`,
      });
      expect(result.code).toBe(0);
      expect(result.output).toContain(
        "primary=2/2 fresh, independentHosts=2, required=2",
      );
    });
  });

  it("does not count archive-only endpoints towards the primary minimum", async () => {
    await withRpcServer(async (base) => {
      const result = await runCheck({
        VITE_JSON_RPC_URL: `${base}/failed`,
        VITE_ARCHIVE_RPC_URL: `${base}/archive`,
        RPC_HEALTH_MIN_HEALTHY: "1",
      });
      expect(result.code).toBe(1);
      expect(result.output).toContain("primary=0/1 fresh");
      expect(result.output).toContain("ARCHIVE");
      expect(result.output).not.toContain("private-provider-key");
    });
  });

  it("fails when the only primary is stale relative to another healthy endpoint", async () => {
    await withRpcServer(async (base) => {
      const result = await runCheck({
        VITE_JSON_RPC_URL: `${base}/stale`,
        VITE_ARCHIVE_RPC_URL: `${base}/archive`,
        RPC_HEALTH_MIN_HEALTHY: "1",
      });
      expect(result.code).toBe(1);
      expect(result.output).toContain("STALE");
      expect(result.output).toContain("primary=0/1 fresh");
    });
  });

  it("tolerates a failed endpoint only when strict mode is disabled", async () => {
    await withRpcServer(async (base) => {
      const env = {
        VITE_JSON_RPC_URL: `${base}/healthy`,
        VITE_ADDITIONAL_RPC_URLS: `${base}/failed`,
        RPC_HEALTH_MIN_HEALTHY: "1",
      };
      expect((await runCheck(env)).code).toBe(0);
      expect((await runCheck({ ...env, RPC_HEALTH_STRICT: "1" })).code).toBe(1);
    });
  });

  it("skips optional archive probes when disabled", async () => {
    await withRpcServer(async (base) => {
      const result = await runCheck({
        VITE_JSON_RPC_URL: `${base}/healthy`,
        VITE_ARCHIVE_RPC_URL: `${base}/failed`,
        RPC_HEALTH_MIN_HEALTHY: "1",
        RPC_HEALTH_STRICT: "1",
        RPC_HEALTH_INCLUDE_ARCHIVE: "0",
      });
      expect(result.code).toBe(0);
      expect(result.output).not.toContain("ARCHIVE");
    });
  });
});
