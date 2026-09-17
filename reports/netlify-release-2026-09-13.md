# Netlify production release - 2026-09-13

## Published artifact

- Production: https://biggieyes.com
- Application: https://biggieyes.com/app/
- Site: `biggieyescom` (`dac321e9-74ae-4e07-b765-33be002cc7e8`).
- Published deploy: `6aa628737b7306f1bd2ec815`; Netlify API state `ready`.
- Deploy URL: https://6aa628737b7306f1bd2ec815--biggieyescom.netlify.app
- Application entry: `/assets/app-CUXM3VIX.js`.
- Built: `2026-09-13T04:34:39.835Z`; deployed: `2026-09-13T04:37:32.701Z`.
- Public HTTP verification: `2026-09-13T04:37:50.787Z`, followed by browser checks.
- Previous published deploy: `6aa5c3cf88403e854297caee`.
- Artifact SHA-256: `55f126b51363df36c5ec775062a7d8054cf66aa65f5906d3270db0348497ca3e`.

Built from the existing dirty working tree above
`a092e489e8dffd573fe656da007153a1d0524210`, including untracked source files.
The commit ID alone does not reproduce the artifact. Existing changes were
preserved; no Git commit, push or destructive cleanup was performed.

## Scope and safeguards

This release publishes the accumulated Gallery, NFT card, User Panel, LiveStats,
RPC recovery and React module-boundary fixes. See
[React boundary verification](refresh-boundaries-2026-09-13.md),
[lint cleanup](lint-cleanup-2026-09-13.md),
[Gallery navigation](gallery-navigation-2026-09-12.md),
[NFT cards](nft-card-consistency-2026-09-13.md),
[User Panel](user-panel-consistency-2026-09-13.md),
[LiveStats](livestats-consistency-2026-09-13.md) and
[pools/RPC](pools-rpc-consistency-2026-09-13.md).

The release helper verified the exact site ID, name and custom domain against
Netlify. Twenty production client variables were loaded into process memory;
local-only Vite values were excluded. Production environment and artifact
fingerprints were rechecked before upload, along with the previous deployment
ID, to avoid overwriting an intervening deployment. Server credential values
and private RPC paths were not printed or included in this report.

Root `dist` and `functions` were deployed through Netlify CLI with explicit
site selection, `--prod --no-build --skip-functions-cache`. This was not a
deployment of the `public-repo` mirror. No source behavior, Netlify environment
variables, dependencies, ABIs, contract addresses, NFT metadata, permissions
or on-chain state were changed by this deployment step.

## Checks repeated for this release

| Check / command | Status | Result |
| --- | --- | --- |
| Release helper `build`, production-configured `scripts/check-rpc-health.mjs` | PASS | Four independent endpoints returned chain 137, block 93712674; all fresh, minimum two required. |
| Release helper `build`, Vite build and `scripts/generate-security-headers.mjs` | PASS | New production-configured artifact and CSP generated. |
| Built-output credential scan | PASS | No environment files or known server credential values found in checked output. Not a complete secret audit. |
| `npm run security:secrets` | PASS | No credential-like values found in tracked or pending files. |
| ESLint API, `fix: false`, `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])` | PASS | 490 files, 0 errors, 0 warnings; no rules changed. |
| Release helper `smoke` running `scripts/smoke-runtime.mjs` | PASS | Production build: Gallery controls/hash navigation, LiveStats pools, Rewards claim preview, User Panel without a connected wallet, desktop and mobile. Pool status ready; no console errors reported. |
| Release helper `deploy` | PASS | Published validated assets and server functions; deployment ID above. |
| Release helper `verify` | PASS | Expected published deployment is ready; public application serves the expected entry. `/`, `/app/`, `/api/chat-bootstrap`, `/api/communityVoting` returned 200. CSP, HSTS and nosniff present on `/app/`. |
| Public Playwright smoke | PASS | Existing `runSmoke` invoked in memory against `https://biggieyes.com`, without altering the script. Desktop 1440x900 and mobile 390x844; same panel flows passed, pool reads ready, checked mobile layout did not overflow. No page or console errors reported. |
| Public API JSON checks | PASS | Chat bootstrap and community voting returned JSON with expected top-level keys, no declared error, not an HTML fallback. |
| Public pool screenshot | PASS | `tmp-netlify-20260913-pools.png` inspected; modal content and controls visible. |
| `git diff --check` | PASS | No whitespace errors; existing LiveStats CRLF normalization notice only. |

## Prior verification and limits

The immediately preceding repair pass recorded 94 Vitest files / 591 passing
tests, passing typecheck, and controlled User Panel / NFT card browser fixtures
at 1440, 768, 390 and 320px. Those tests were not rerun in this deployment step;
their commands, outcomes and limits are in the linked React boundary report.

No wallet signatures or real funded mint, redeem, approve or claim transactions
were performed. The checks do not prove uninterrupted RPC availability,
economic activation readiness, runtime performance gains or formal smart
contract security. The existing local preview was left running; temporary
verification browsers and preview servers were closed.

For rollback, republish `6aa5c3cf88403e854297caee` in the same Netlify site.
This restores that deployment's web assets and functions, not external data,
credentials or on-chain state. No rollback was performed.
