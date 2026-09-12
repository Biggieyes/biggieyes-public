# Netlify production release - 2026-09-12

## Published artifact

- Production: https://biggieyes.com
- Application: https://biggieyes.com/app/
- Site: `biggieyescom` (`dac321e9-74ae-4e07-b765-33be002cc7e8`).
- Published deploy: `6aa5c3cf88403e854297caee`, verified API state `ready`.
- Deploy URL: https://6aa5c3cf88403e854297caee--biggieyescom.netlify.app
- Application entry: `/assets/app-Cvx5Pseh.js`.
- Built: `2026-09-12T21:15:52.532Z`; deployed: `2026-09-12T21:28:16.935Z`.
- Public HTTP verification: `2026-09-12T21:28:31.330Z`, followed by browser checks.
- Previous published deploy: `6aa0ca18a06d42d1aaafcda8`, retained for rollback.
- Artifact SHA-256: `1697c1eeabe3fd5939643542d65e2c0a473f5e07c7b5b132c41f185d6e180cea`.

The artifact was built from the existing working tree on top of
`b40a60e996ad30b48d2ea528a935513f9755a1d0`. As requested, publication preceded
the Git checkpoint. The commit adding this report records the accumulated
changes; after building, only the smoke-test selector and this report changed.
The artifact checksum covers sorted relative file paths and file contents.

## Included work and boundaries

- Audit fixes for wallet/network changes, transaction receipts, pending VRF
  recovery, stale reads, reward error states and shared polling. See the
  [audit](javascript-react-blockchain-audit-2026-09-11.md),
  [first repairs](audit-remediation-2026-09-11.md) and
  [wallet lifecycle regressions](wallet-lifecycle-2026-09-11.md).
- Previously prepared NFT Rewards V2 integration, canonical address/ABI
  references, version-aware backend tooling and moderator/admin interfaces.
- Existing LiveStats readability work, preserving six frames and button order;
  Collection structure corrections, public purchase copy and IPFS fallbacks.
- Related tests, documentation and metadata-generator work already present in
  the working tree. No deployed NFT metadata was rewritten or repinned here.

No smart contracts were deployed, no permissions were changed and no mainnet
transactions were sent during this release. The earlier V2 deployment records
remain historical records, not evidence of another deployment today. No Netlify
environment variables, dependencies or lockfile contents were changed in this
release step. Existing dependency changes are included in the Git checkpoint.

## Verification

Production client variables were fetched from Netlify into process memory;
local-only Vite settings were excluded. The 20 production client variables and
artifact were fingerprinted and checked again before upload. Secret values and
private RPC URL paths are not recorded. Runtime secrets stayed server-side.

| Check / command | Status | Result and scope |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1` | PASS | 78 files, 414 tests, 343.11 seconds. |
| Local backend Hardhat CLI `test --config hardhat.biggi-master.cjs --network hardhat --no-compile` | PASS | 121 tests; existing local artifacts, no fork or mainnet connection. `FORK_URL`, `FORK_BLOCK_NUMBER` and `CRE_AUTOMATION_REPORT_PATH` were cleared for this process. |
| `python -m unittest discover -s scripts/metadata -p test_biggi_metadata.py` | PASS | 17 tests, temporary fixture outputs only. |
| `npm run typecheck` | PASS | Limited to the repository's configured TypeScript surface, not all JavaScript. |
| ESLint API `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`, `fix: false` | PASS | 481 files; 0 errors, 137 existing warnings. |
| `node scripts/check-contracts.js` | PASS | Canonical/root/public-mirror address and CORE ABI checks; 170 addresses per frontend, five chapters. |
| `node scripts/check-abis.js` | PASS | Heuristic scan: 479 files, 61 ABI files, 848 functions; no missing methods reported. |
| `node scripts/check-rpc-health.mjs` with production configuration | PASS | Four independent configured endpoints returned chain ID 137 and fresh heads; minimum two required. |
| Vite production build followed by `node scripts/generate-security-headers.mjs` | PASS | Production-configured artifact and security headers generated locally. |
| `node scripts/check-secrets.mjs` and built-output credential scan | PASS | No credential-like source findings or known server secrets in the built output. |
| `node scripts/smoke-runtime.mjs` with production build | PASS | Gallery controls, LiveStats, Rewards claim preview; desktop 1440x900 and mobile 390x844. |
| Netlify CLI `deploy --prod --no-build`, explicit site/dist/functions | PASS | Published the validated artifact and server functions, not a local-default rebuild. |
| Netlify API and public HTTP verification | PASS | Correct published deploy and app entry; `/`, `/app/`, `/api/chat-bootstrap`, `/api/communityVoting` returned 200. CSP, HSTS and nosniff present. |
| Public Playwright checks at widths 390, 768 and 1440 | PASS | Six LiveStats frames and original button rows, live ticket price, gallery, no horizontal overflow or uncaught page errors. Desktop Rewards preview opened. |
| Browser-only dRPC outage simulation | PASS | One intercepted request returned 503; 1RPC returned a successful JSON-RPC result. Production configuration was not modified. |
| `git diff --check` | PASS | No whitespace errors; existing CRLF normalization notices only. |

## Intermediate failures and remaining work

- The first two-worker frontend run overlapped other checks and hit the
  15-second import/test timeout in `liveChatFunctions.test.js`: 413 passed,
  one timed out. The entire suite was rerun serially and passed. Tests and their
  timeout limits were not relaxed.
- The temporary credential scanner initially classified `CHAT_OWNER_ADDRESS`
  as a secret. It was corrected to select credential-bearing variable names,
  and the full production build/scan passed; the public address was not removed.
- The first local browser run passed desktop but found an ambiguous mobile
  `#gallery` selector. Both outer `DeferredSection` and inner `GallerySection`
  have that ID after mounting. The harness now explicitly scrolls the first,
  outer host before testing gallery content; the full smoke then passed.
  The duplicate application ID is still a follow-up: `MainLayout.jsx` passes
  `sectionId={undefined}`, which re-enables the `GallerySection.jsx` default.
  A future DOM fix should retain the outer `#gallery` anchor, suppress the inner
  ID and test lazy loading plus footer/hash navigation. No layout change was
  made as part of this release verification.
- Existing lint warnings remain. This is not a formal security audit, a
  performance benchmark, proof of economic activation readiness, or a real
  MetaMask mint/redeem/claim end-to-end test. No real wallet signatures were used.
- The public-repo mirror was not broadly resynchronized; only its existing
  targeted V2/configuration changes are included. Root is the deployed frontend.

## Repository checkpoint and rollback

The checkpoint includes reviewed accumulated changes, their regression tests
and release/audit reports. Environment files, credentials, local build outputs,
screenshots and temporary release helpers remain ignored, not committed.
No Git push or destructive repository cleanup was requested or performed.

For rollback, republish the previous ready deployment
`6aa0ca18a06d42d1aaafcda8` in the same Netlify site. This rolls back web assets
and functions only; it does not change on-chain state or external credentials.
