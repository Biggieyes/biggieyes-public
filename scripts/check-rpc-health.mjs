import {
  ACTIVE_CHAIN,
  checkRpcHealth,
  getArchiveRpcUrls,
  getRpcUrls,
} from "../src/shared/utils/rpcConfig.js";

const env = (key) => {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
};

const strict = env("RPC_HEALTH_STRICT") === "1";
const includeArchive = env("RPC_HEALTH_INCLUDE_ARCHIVE") !== "0";
const expectedChainIdRaw =
  env("RPC_EXPECTED_CHAIN_ID") || env("VITE_CHAIN_ID");
const expectedChainId =
  expectedChainIdRaw != null && expectedChainIdRaw !== ""
    ? Number(expectedChainIdRaw)
    : ACTIVE_CHAIN.chainId;
const maxStaleBlocks =
  Number(env("VITE_RPC_MAX_STALE_BLOCKS")) > 0
    ? Number(env("VITE_RPC_MAX_STALE_BLOCKS"))
    : 16;

const uniq = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const v = String(value || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const urls = uniq([
  ...getRpcUrls(),
  ...(includeArchive ? getArchiveRpcUrls() : []),
]);

if (!urls.length) {
  console.error("No RPC URLs configured.");
  process.exit(1);
}

const results = await Promise.all(
  urls.map(async (url) => ({
    url,
    ...(await checkRpcHealth(url, { expectedChainId })),
  })),
);

const ok = results.filter((r) => r.ok);
const maxBlock = ok.reduce((acc, cur) => {
  const n = Number(cur?.blockNumber ?? 0);
  return Number.isFinite(n) ? Math.max(acc, n) : acc;
}, 0);
const stale = ok.filter((r) => {
  const n = Number(r?.blockNumber ?? 0);
  return Number.isFinite(n) && maxBlock - n > maxStaleBlocks;
});

const lines = results
  .slice()
  .sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return Number(a.latencyMs || 99999) - Number(b.latencyMs || 99999);
  })
  .map((r) => {
    if (r.ok) {
      return `OK   ${r.url} | block=${r.blockNumber} | ${r.latencyMs}ms`;
    }
    return `FAIL ${r.url} | ${r.error}`;
  });

console.log(lines.join("\n"));
console.log(
  `Summary: ${ok.length}/${results.length} healthy, maxBlock=${maxBlock}, stale>${maxStaleBlocks}=${stale.length}`,
);

if (!ok.length) {
  process.exit(1);
}

if (strict && (results.length !== ok.length || stale.length)) {
  process.exit(1);
}
