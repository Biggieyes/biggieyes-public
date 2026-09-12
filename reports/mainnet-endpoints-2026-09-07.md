# Polygon Mainnet Endpoint Audit

Checked 2026-09-07, approximately 17:57-18:03 UTC (19:57-20:03 Prague).
Production: https://biggieyes.com/app/.
Published Netlify deploy: `6a9cdc0186e46cf31ec0eb11`, state `ready`, title
`Public collection mint flow 59e0392`; app entry `app-drHJdNk1.js`.

## Result

No active Polygon RPC outage was observed. Four application RPC endpoints
returned chain ID 137 and fresh blocks; native browser requests passed CORS.
There are remaining historical-data and IPFS fallback configuration gaps.
This was a read-only, single-location spot check, not an uptime guarantee.

## Findings

1. **Missing archive RPC (medium).** Netlify production has neither
   `VITE_ARCHIVE_RPC_URL` nor `VITE_ARCHIVE_RPC_URLS`. The DRIP panel emitted
   `DRIP event totals require VITE_ARCHIVE_RPC_URL; using cached values and live balances.`
   Full historical event totals cannot be backfilled through this reader until
   a suitable endpoint is configured. Current balance reads still work.
   Source: `src/shared/services/tokenomics/drip.reader.js:192`.
2. **Unhealthy secondary IPFS gateways (medium).** Only the two Pinata gateways
   returned the tested Public metadata successfully. The other seven candidates
   returned errors or timed out (table below). If Pinata becomes unavailable,
   the tested fallback set cannot reliably recover that metadata. Confirm an
   independent working gateway and remove obsolete entries before relying on
   this fallback list. Source: `src/shared/services/ipfs.js:180`.
3. **Landing RPC list differs from the app (low).** The live homepage embeds
   `[polygon.drpc.org, polygon-bor-rpc.publicnode.com, polygon.drpc.org]`.
   This is two distinct endpoints, not three. Both distinct endpoints work,
   but the duplicate offers no additional redundancy. Source: `index.html:2722`.
4. **Operator backend scripts use one configured RPC (low).** Hardhat Polygon
   configuration uses `POLYGON_RPC_URL` (currently dRPC) without the application's
   automatic provider fallback. It is healthy now; an outage could interrupt
   those operator scripts. This is separate from Netlify serving the app.
   Source: `biggi-project/bekend/hardhat.biggi-master.cjs:40`.

## RPC Checks

| Endpoint (credentials omitted) | Chain | Latest block age at probe | Result |
| --- | --- | --- | --- |
| `polygon.drpc.org` | 137 | 3 seconds | HTTP 200, CORS allowed |
| `polygon.publicnode.com` | 137 | 4 seconds | HTTP 200, CORS allowed |
| `1rpc.io/matic` | 137 | 7 seconds | HTTP 200, CORS allowed |
| `polygon-mainnet.infura.io` | 137 | 3 seconds | HTTP 200, CORS allowed |
| `polygon-bor-rpc.publicnode.com` (homepage fallback) | 137 | Not measured | Chain and block reads HTTP 200 |

Application read and wallet RPC lists both contain the first four endpoints.
Fallback is enabled, stall timeout is 1200 ms, and stale stored RPC preference
is ignored. No configured Amoy/Mumbai endpoint was found in these active lists.
The endpoint-related compiled environment properties recovered from loaded
scripts did not conflict with corresponding current Netlify environment keys.
This comparison is limited to recovered properties, not every build variable.

## Browser And API Checks

- Opened all six main panels plus Public Collection, DRIP, Reserve/LM, Token/DEX
  and History: 11 views in total, no uncaught page errors.
- Normal panel walkthrough: 303 JSON-RPC calls in 131 HTTP requests, all HTTP 200,
  no RPC HTTP 429. Two calls reverted with `INSUFFICIENT_LIQUIDITY`; see below.
- Simulated dRPC HTTP 503 only inside a separate Playwright browser context.
  The application continued through PublicNode; live ticket price was 500 POL.
  No live provider or production configuration was disabled.
- Homepage: live ticket price 500 POL, sale count 0/500, BIGGI price correctly
  showed `No DEX liquidity`. DNS resolved and HTTPS requests returned HTTP 200.
- `/api/chat-bootstrap`: HTTP 200, `ok=true`; `/api/communityVoting`: HTTP 200,
  `ok=true`, one poll. Frontend and backend production Supabase URLs agree.
- Read-only GET probes to write-only message, upload and admin-voting routes
  returned expected HTTP 405 with the production CORS origin, not service failures.
- RPC regression tests: five files, 18 tests passed.

## IPFS Checks

Tested one existing Public metadata file, `Biggi_1_ORANGE_PUBLIC.json`, under
CID `bafybeihn4yqga5yuslc2577qsvoajt2fwdpcsr6oj7fdurivwnlrsi7qzy`.
These results concern this object and this audit location/time, not all IPFS content.

| Gateway | Result |
| --- | --- |
| `biggieyes.mypinata.cloud` | HTTP 200, valid NFT metadata, 680 ms |
| `gateway.pinata.cloud` | HTTP 200, valid NFT metadata, 5251 ms |
| `ipfs.io` | HTTP 429 |
| `cloudflare-ipfs.com` | DNS `ENOTFOUND` |
| `dweb.link` | HTTP 429 |
| `nftstorage.link` | Redirect to `ipfs.io`, HTTP 429 |
| `cf-ipfs.com` | DNS `ENOTFOUND` |
| `ipfs.filebase.io` | Timed out after 7 seconds |
| `gateway.lighthouse.storage` | HTTP 402 |

## Non-RPC State And Limits

The DEX quote reverts are not endpoint failures. A direct `getReserves()` read
on pair `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` returned reserves `0 / 0`.
Mint/claim/automation readiness is not established by successful RPC reads.

No wallet was connected and no transaction, vote, message, upload, contract
change, environment update or deployment was performed. Wallet-specific reads,
signed writes, authenticated uploads, relayer sessions and sustained high load
were not tested. Existing source/artwork changes were left untouched.

Local raw evidence (ignored by git): `tmp-mainnet-endpoint-audit.json`,
`tmp-mainnet-runtime-audit.json`, `tmp-mainnet-ipfs-audit.json`, and
`tmp-mainnet-landing-audit.json`. RPC credentials and service secrets are omitted.
