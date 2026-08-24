const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

const OPEN_SEA_API_BASE = "https://api.opensea.io/api/v2";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queueRefresh(apiKey, contract, tokenId) {
  const url = `${OPEN_SEA_API_BASE}/chain/polygon/contract/${contract}/nfts/${tokenId}/refresh?ignoreCachedItemUrls=true`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "*/*",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const numberHeader = (name) => {
      const value = response.headers.get(name);
      return value === null || value === "" ? null : Number(value);
    };
    const rateLimit = {
      limit: numberHeader("x-ratelimit-limit"),
      remaining: numberHeader("x-ratelimit-remaining"),
      reset: numberHeader("x-ratelimit-reset"),
      retryAfter: numberHeader("retry-after"),
    };
    if (response.ok || response.status === 409) {
      return { status: response.status, rateLimit };
    }
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after") || 2);
      await sleep(Math.max(1, retryAfter) * 1_000);
      continue;
    }
    const detail = await response.text();
    const error = new Error(
      `token ${tokenId}: OpenSea HTTP ${response.status}: ${detail}`,
    );
    error.status = response.status;
    throw error;
  }
  throw new Error(`token ${tokenId}: OpenSea refresh retry limit reached`);
}

function nextRequestDelay(rateLimit, fallbackMs) {
  const now = Date.now();
  const resetMs = rateLimit?.reset == null ? null : rateLimit.reset * 1000;
  const remaining = rateLimit?.remaining;
  if (Number.isFinite(resetMs) && resetMs > now && Number.isFinite(remaining)) {
    const untilReset = resetMs - now;
    if (remaining <= 0) return Math.max(500, untilReset + 250);
    return Math.max(500, Math.ceil(untilReset / (remaining + 1)) + 100);
  }
  return fallbackMs;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const manifestPath = path.resolve(
    __dirname,
    process.env.TICKET_METADATA_MANIFEST || "../../../../metadata/tickets/polygon-ticket-traits-v2.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const tokenIds = manifest.chapters.flatMap((chapter) =>
    Array.from({ length: 50 }, (_, offset) => chapter.firstTicketId + offset),
  );
  console.log(`TicketHub: ${manifest.ticketHub}`);
  console.log(`OpenSea refresh targets: ${tokenIds.length}`);
  console.log(`Ranges: ${manifest.chapters.map((chapter) => `${chapter.firstTicketId}-${chapter.firstTicketId + 49}`).join(", ")}`);
  if (!execute) {
    console.log("Dry run complete. Add OPENSEA_API_KEY and --execute to queue refreshes.");
    return;
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error("OPENSEA_API_KEY is missing");
  const fallbackDelayMs = Number(
    process.env.OPENSEA_REFRESH_DELAY_MS || 12_500,
  );
  if (!Number.isFinite(fallbackDelayMs) || fallbackDelayMs < 500) {
    throw new Error("OPENSEA_REFRESH_DELAY_MS must be at least 500");
  }
  let queued = 0;
  let delayMs = fallbackDelayMs;
  let rateLimitLogged = false;
  const failures = [];
  for (const tokenId of tokenIds) {
    try {
      const result = await queueRefresh(apiKey, manifest.ticketHub, tokenId);
      queued += 1;
      delayMs = nextRequestDelay(result.rateLimit, fallbackDelayMs);
      if (
        !rateLimitLogged &&
        result.rateLimit?.limit != null &&
        Number.isFinite(result.rateLimit.limit)
      ) {
        console.log(
          `OpenSea write limit: ${result.rateLimit.limit}; adaptive pacing enabled`,
        );
        rateLimitLogged = true;
      }
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) throw error;
      failures.push(error.message || String(error));
    }
    await sleep(delayMs);
    if (queued > 0 && queued % 10 === 0) {
      console.log(`Queued ${queued}/${tokenIds.length}`);
    }
  }
  console.log(`OpenSea refresh queued: ${queued}/${tokenIds.length}`);
  if (failures.length) {
    failures.slice(0, 10).forEach((failure) => console.error(failure));
    throw new Error(`OpenSea refresh failed for ${failures.length} token(s)`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
