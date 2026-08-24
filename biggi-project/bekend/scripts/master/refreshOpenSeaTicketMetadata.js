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
  const url = `${OPEN_SEA_API_BASE}/chain/polygon/contract/${contract}/nfts/${tokenId}/refresh`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "*/*",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok || response.status === 409) return response.status;
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after") || 2);
      await sleep(Math.max(1, retryAfter) * 1_000);
      continue;
    }
    const detail = await response.text();
    throw new Error(`token ${tokenId}: OpenSea HTTP ${response.status}: ${detail}`);
  }
  throw new Error(`token ${tokenId}: OpenSea refresh retry limit reached`);
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
  const delayMs = Number(process.env.OPENSEA_REFRESH_DELAY_MS || 12_500);
  if (!Number.isFinite(delayMs) || delayMs < 500) {
    throw new Error("OPENSEA_REFRESH_DELAY_MS must be at least 500");
  }
  let queued = 0;
  const failures = [];
  for (const tokenId of tokenIds) {
    try {
      await queueRefresh(apiKey, manifest.ticketHub, tokenId);
      queued += 1;
    } catch (error) {
      failures.push(error.message || String(error));
    }
    await sleep(delayMs);
    if (queued > 0 && queued % 25 === 0) console.log(`Queued ${queued}/${tokenIds.length}`);
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
