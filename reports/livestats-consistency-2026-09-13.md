# LiveStats consistency follow-up - 2026-09-13

Continuation of the [gallery/navigation fixes](gallery-navigation-2026-09-12.md)
and the [JS/React/blockchain audit](javascript-react-blockchain-audit-2026-09-11.md).
Starting commit: `a092e48`. The existing uncommitted gallery, routing, smoke-test
and report changes were preserved. This follow-up modifies only the active root
LiveStats component, its image-identity helper, regression tests and this report.

No deployment, Git commit/push, dependency changes, environment changes, contract
transactions, approvals, ABI/address changes or NFT metadata edits were performed.
The six summary frames, button order, CSS, price-growth percentages, mint/redeem,
VRF and claim transaction paths remain unchanged.

## Confirmed findings

All findings below are P2 with high confidence, reproduced in component tests
using controlled read-only RPC responses, not mainnet transactions. Line numbers
refer to the locally repaired `src/components/LiveStats.jsx`.

### LS01: Metadata image lookup never started

- Location: lines 750-819, metadata image effect; `liveStatsImageState.js`.
- The effect validated the composite `contract:tokenId` cache key as a decimal
  token ID. Consequently it returned before calling `tokenURI` for every NFT.
- Impact: missing direct images could not be recovered from their metadata.
- Fix: pass the numeric token ID to `tokenURI`, retain the composite identity for
  local state/cache, and disregard responses after cleanup or an asset change.
  Resolved image state is identity-scoped even during the first new-asset render.
- Behavior change: previously unreachable read fallback now works. No mutation of
  tokenURI, metadata, image filenames or on-chain state; exact image URL preserved.
- Tests: numeric argument, direct-image fast path, rejected RPC, contract change
  with equal IDs, late URI/image resolution, unmount and StrictMode cleanup.

### LS02: Image fallback and retry selected the previous URL

- Location: lines 842-951 and 3349-3430, image selection/effects/handlers.
- Direct-image ownership stored a bare token ID while selection compared a
  composite identity. Updating the fallback/retry URL could therefore have no
  visible effect. Once corrected, a failed cached candidate could cause cycling.
- Fix: use the same identity throughout; scope the image element and retry timer
  to the asset; track failed candidates; retain the existing two timed retries.
  Persist images only after a successful image load, not before trying them.
  Preserve case-sensitive path comparisons instead of lowercasing entire URLs.
- Behavior change: fallback advances and terminates; old asset events/cache cannot
  supply another asset's preview. Storage schema and existing candidate paths are
  preserved. No new requests to alternative NFT assets were introduced.
- Tests: fallback traversal, bounded timed retries, timer cancellation on contract
  change, case-only path change and distinct image nodes for equal token IDs/URLs.

### LS03: Previous NFT prices remained visible during a new read

- Location: lines 1095-1101 and 1181-1410, last-mint snapshot/effect.
- A new valid token/contract did not clear or scope the previous price snapshot.
  Also, the effect used `maxSupply` to select a mint-data index without tracking it.
- Impact: old prices could appear alongside a new NFT until its read completed.
- Fix: expose a snapshot only when its contract/token identity and capacity match
  the current input; include capacity in effect dependencies. Existing late-result
  cancellation is retained; cancelled failures do not rotate the active RPC.
- Behavior change: stale prices are excluded immediately. Existing current-block
  and base-price fallback calculations are unchanged; no pricing rule changes.
- Tests: new-contract pending read, out-of-order mint-price replies and changed
  collection capacity. Both normal complete-data rendering and fallback remain.

### LS04: Missing decimals/balances produced invented market data

- Location: lines 181-187, 2107-2120, 2148-2227, 2244-2267.
- `Number(null)` accepted missing decimals as zero; DEX metadata used 18 after
  failed reads and replaced a legitimate zero with 18. Failed locked-balance reads
  became `0n`, inflating circulating supply and derived market cap.
- Fix: validate non-null integer decimals; do not derive supply/DEX price when
  required decimals are unavailable. Preserve zero decimals and zero balances.
  Missing any required locked balance leaves circulating supply unknown.
- Behavior change: financial presentation uses `-` for incomplete results rather
  than a fabricated number. No balance, supply, reserve or liquidity changes.
- Tests: rejected decimals for base/quote token, partial balance failure, genuine
  zero decimals/balances and unchanged calculations with complete responses.

### LS05: Quote-currency labels were inconsistent

- Location: DEX quote normalization and summary market-cap rendering, line 3741.
- The summary always labeled market cap POL even when price was in another quote
  currency. WETH was also incorrectly normalized to native POL.
- Fix: retain the quote token's symbol; only native wrapped-POL/MATIC aliases map
  to POL. Use the same quote symbol for summary and modal market cap.
- Behavior change: label correction only; no DEX/pair/router configuration changes.
- Tests: USDC price/cap agreement and WETH remaining WETH.

### LS06: Weekly preview confused reward weights with token amounts

- Location: reward metadata application and `unitsToTokenAmountStr`, line 3217.
- With missing or zero `unitReward`, the display substituted raw weight units and
  labeled them BIGGI. Missing weights could also silently use display defaults.
- Fix: display `-- BIGGI` unless contract weights, unit reward and reward decimals
  are available. Keep reward decimals with their own metadata; preserve a genuine
  zero unit reward and the existing complete-data amount calculation.
- Behavior change: more accurate reward preview only. No claim eligibility,
  distribution formula, budget threshold, contract permission or payment change.
- Tests: missing unit/weights/decimals, zero reward and a complete-data control.

## Additional maintenance

Stable frozen empty-array fallbacks reuse existing memoized computations instead
of invalidating them on unrelated renders. Persisted last-image initialization is
lazy instead of reading localStorage on every render. These are code-path
improvements, not a measured browser speedup. No new cache layer or dependency.

## Verification

- FAIL (expected): pre-fix asset regressions: 10 failures / 2 passes; pre-fix read/amount
  regressions after correcting the test's portal lookup: 9 failures / 1 pass.
  These intentional red runs established reproducible problems, not release gates.
- PASS: targeted final run: 6 test files, 45 tests, 24.33 s.
  `node node_modules/vitest/vitest.mjs run __tests__/liveStatsReadFailures.test.jsx __tests__/liveStatsAssetLifecycle.test.jsx __tests__/liveStatsImageState.test.js __tests__/liveStatsSummary.test.jsx __tests__/liveStatsTables.test.jsx __tests__/nftCardGatewayFallback.test.jsx --maxWorkers=1`
- PASS: `npm run typecheck`. Existing TS/TSX scope only, not whole-JS type safety.
- PASS with warnings: ESLint API with `{fix: false}` and
  `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`: 481 files, 0 errors, 117 warnings
  (127 before this follow-up). No rules disabled. Remaining warnings require
  individual triage; a warning is not automatically a functional defect.
- PASS: `node node_modules/vitest/vitest.mjs run --maxWorkers=1`: 83 files,
  464 tests, 211.43 s. The previously interrupted full-run start was not counted;
  this is the complete rerun with exit code 0.
- PASS: `npm run build`: 4380 modules, 42.57 s, 9 inline-script CSP hashes.
  Local app entry: `/assets/app-BKEoPOVt.js`.
- PASS: `node scripts/smoke-runtime.mjs` through a buffered, URL-redacting output
  wrapper: desktop/mobile gallery controls, direct gallery fragment, invalid
  fragment handling, LiveStats tokenomics modal and rewards claim-status view.
  No wallet signing was attempted. The temporary preview/browser were closed.
- PASS: additional read-only Playwright inspection of the built app served by
  the already running `http://127.0.0.1:5181/app/` preview. Viewports 1440x900,
  768x1024 and 390x844 each showed six frames, unchanged button order, no page
  errors and document scrollWidth equal to viewport width. The loaded entry was
  compared with the newly built HTML to exclude accidentally inspecting old JS.
  Screenshots were visually reviewed: `tmp-livestats-20260913-1440.png`,
  `tmp-livestats-20260913-768.png`, `tmp-livestats-20260913-390.png`.
  These captures cover the disconnected/loading view, not wallet-signed E2E.
- PASS: `git diff --check`; existing CRLF normalization notice only.
- PASS: `npm run security:secrets`: no credential-like values in tracked or
  pending files. Secret values and private RPC URLs were not printed.
- SKIPPED: contract/backend suites and mainnet write testing; those files and
  transaction paths were not changed in this follow-up.

Final state: changes remain uncommitted and local; no Netlify release was made.
Only the pre-existing preview process (PID 22512, port 5181) remains running.
All verification processes and temporary browser instances finished.

## Remaining scope

This is not a completed project-wide or formal smart-contract security audit.
The NFT card's broader metadata/wallet lifecycle remains a next task; its existing
gateway regression tests passed without modifying that component. Further
LiveStats review should cover oracle-versus-DEX price arbitration/freshness,
pool-modal partial failures, countdown lifecycle and per-asset weekly eligibility.
The existing estimated last-price fallback is retained, not redefined as a
historically verified mint price. No live RPC availability guarantee or
performance percentage is claimed.
