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
const minHealthyRaw = Number(env("RPC_HEALTH_MIN_HEALTHY"));
const minHealthy =
  Number.isFinite(minHealthyRaw) && minHealthyRaw > 0
    ? Math.trunc(minHealthyRaw)
    : 2;
const expectedChainIdRaw = env("RPC_EXPECTED_CHAIN_ID") || env("VITE_CHAIN_ID");
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

const primaryUrls = uniq(getRpcUrls());
const archiveUrls = includeArchive ? uniq(getArchiveRpcUrls()) : [];
const urls = uniq([...primaryUrls, ...archiveUrls]);

if (!primaryUrls.length) {
  console.error("No primary RPC URLs configured.");
  process.exit(1);
}

const endpointHost = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "invalid-rpc-url";
  }
};

const endpointLabel = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "<invalid-rpc-url>";
  }
};

const redactError = (value) =>
  String(value || "unknown error").replace(
    /https?:\/\/[^\s)'"\]]+/gi,
    "<rpc-url-redacted>",
  );

const results = await Promise.all(
  urls.map(async (url) => ({
    url,
    roles: [
      ...(primaryUrls.includes(url) ? ["read"] : []),
      ...(archiveUrls.includes(url) ? ["archive"] : []),
    ],
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
    const role = r.roles.join("+").toUpperCase().padEnd(12);
    const label = endpointLabel(r.url);
    if (r.ok) {
      const staleLabel = stale.includes(r) ? " | STALE" : "";
      return `OK   ${role} ${label} | chain=${r.chainId} | block=${r.blockNumber} | ${r.latencyMs}ms${staleLabel}`;
    }
    return `FAIL ${role} ${label} | ${redactError(r.error)}`;
  });

console.log(lines.join("\n"));
const freshPrimary = results.filter(
  (result) =>
    result.ok && primaryUrls.includes(result.url) && !stale.includes(result),
);
const freshPrimaryHosts = new Set(
  freshPrimary.map((result) => endpointHost(result.url)),
);
console.log(
  `Summary: primary=${freshPrimary.length}/${primaryUrls.length} fresh, independentHosts=${freshPrimaryHosts.size}, required=${minHealthy}, allHealthy=${ok.length}/${results.length}, maxBlock=${maxBlock}, stale>${maxStaleBlocks}=${stale.length}`,
);

if (freshPrimaryHosts.size < minHealthy) {
  process.exit(1);
}

if (strict && (results.length !== ok.length || stale.length)) {
  process.exit(1);
}
