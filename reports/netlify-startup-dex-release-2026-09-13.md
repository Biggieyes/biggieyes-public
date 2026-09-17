# Netlify startup and DEX release - 2026-09-13

Published the [startup improvements](startup-performance-2026-09-13.md) and
[Token / DEX fixes](token-dex-console-2026-09-13.md) at the user's request.

## Published artifact

- Production: https://biggieyes.com/app/
- Netlify site: `biggieyescom`, `dac321e9-74ae-4e07-b765-33be002cc7e8`.
- Deployment: `6aa6c6706ef7b015a357096f`, confirmed published and `ready`.
- Deploy URL: https://6aa6c6706ef7b015a357096f--biggieyescom.netlify.app
- Previous deployment: `6aa628737b7306f1bd2ec815`.
- App entry: `/assets/app-CiN0SgLF.js`.
- Build: `2026-09-13T15:48:40.600Z`.
- Deployment: `2026-09-13T15:51:33.490Z`.
- HTTP/API verification: `2026-09-13T15:51:55.251Z`, followed by browser checks.
- Artifact SHA-256: `75c98cef387a7e04fdd95064285b87a98faf3b27dc6d08725b6d5668212ab020`.

The fresh build exactly matched the preceding tested artifact and production
client-configuration fingerprint. It includes existing uncommitted work above
`a092e489e8dffd573fe656da007153a1d0524210`; that commit alone does not reproduce
the artifact. No commit, push or cleanup was performed.

## Deployment safeguards

The reviewed release helper was invoked in memory for `build`, `smoke`, `deploy`
and `verify`, with a separate receipt `tmp-netlify-perf-dex-20260913.json` and
deployment message "Startup loading and DEX read consistency 2026-09-13".
Historical receipts were preserved. Site ID, project name and the exact domain
`biggieyes.com` were checked against the API before each stage.

Twenty production client variables were loaded into child-process memory;
local-only Vite values were excluded. Production environment/artifact hashes
and the previous published deployment were rechecked before upload. Server
credentials and private RPC paths were redacted from output.

Netlify CLI deployed root `dist` and `functions` using `--prod --no-build`, an
explicit site ID and `--skip-functions-cache`. This was not the `public-repo`
mirror. No Netlify environment, DNS, contract, ABI, address, NFT metadata,
permission, reward rule or on-chain state was changed by this release step.

## Checks

| Check | Status | Result |
| --- | --- | --- |
| Production-configured RPC health | PASS | Four independent endpoints, Polygon chain 137, fresh blocks 93739614-93739615, minimum two fresh hosts required. |
| Fresh Vite build and generated security headers | PASS | Entry above; artifact identical to the previously tested DEX build. |
| Built-output known-credential check | PASS | No checked server credential values or environment files found in output. |
| `npm run security:secrets` | PASS | Tracked/pending-file pattern scan passed. Not a complete credential audit. |
| `git diff --check` | PASS | Existing LiveStats CRLF normalization notice only. |
| Local `scripts/smoke-runtime.mjs` with production configuration | PASS | Gallery controls/hash links, LiveStats pools ready, Rewards preview, User Panel without a connected wallet, desktop/mobile layout. No reported console errors. |
| Netlify publication and public HTTP checks | PASS | Expected deployment published/ready; `/app/` serves expected entry; `/`, `/app/`, chat bootstrap and voting API return 200. CSP, HSTS and nosniff checked on `/app/`. |
| Public API JSON checks | PASS | Chat returns expected top-level `ok`, `rulesText`, `messages`; voting returns `ok`, `polls`; no declared API error or HTML fallback. User content not printed. |
| Public browser smoke | PASS | Existing `runSmoke` invoked in memory against `https://biggieyes.com`; same desktop/mobile flows passed, pools ready, no reported console errors. |
| Public Token / DEX read check | PASS | Mainnet data showed `No liquidity`. Observed for another 22 seconds after readiness: 0 `getAmountsOut` calls, 0 old TokenDex helper warnings, 0 uncaught page errors. |
| Public mobile startup | PASS | 390px viewport, all six LiveStats frames, no document overflow or page errors, no downloads of the two desktop logo assets. |
| Wallet signatures / on-chain writes | SKIPPED | Not part of deployment or verification. |
| Lint, typecheck and unit suite in this release step | SKIPPED | No source changes since the preceding verified build. That pass recorded 490 linted files with 0 errors/warnings, passing typecheck and 45 targeted tests; details in the linked DEX report. Full-suite limitations remain in the startup report. |

Public mobile and DEX screenshots were inspected. Temporary verification
browsers/servers finished; the existing local preview remains available.

This deployment does not establish that the user's MetaMask extension issue
is fixed, add an archive RPC endpoint, fund liquidity, prove continuous RPC
availability or constitute a formal smart-contract/security audit. No new
production performance timings are claimed.

For rollback, republish `6aa628737b7306f1bd2ec815` in the same Netlify project.
That restores the previous web assets/functions, not external data, environment
variables or blockchain state. No rollback was performed.
