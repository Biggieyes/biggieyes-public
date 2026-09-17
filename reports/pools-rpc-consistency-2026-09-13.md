# LiveStats pools and RPC recovery - 2026-09-13

Follow-up to the [User Panel verification](user-panel-consistency-2026-09-13.md),
which observed `refreshPools: no runners?!` in a production-bundle smoke test.
Starting commit: `a092e48`; all existing uncommitted changes are preserved.
This repair is local only. No deployment, commit, push, environment, dependency,
ABI, address, Solidity, NFT metadata or transaction changes were made.

## Findings and repairs

All confirmed findings below are P2, high confidence. Locations refer to the
repaired working tree. They affect reads and presentation, not financial rules.

### PL01: Exhausted fallback bootstrap could leave pools loading indefinitely

- Locations: `src/components/LiveStats.jsx:1114`, `:1795`;
  `src/shared/utils/rpcErrors.js:48`.
- Installed ethers 6.17.0 retains `_lastFatalError` after an endpoint fails its
  initial block-number read (`provider-fallback.js:40`). Such runners are skipped
  at line 338, initial sync is cached, and no remaining runners throws at line 486.
  The same instance can remain unusable even after its endpoints recover.
- The old pool error branch left either null/loading or an older snapshot; it
  did not offer a dedicated pool read refresh. Failed individual reads could
  also be converted into zero, obscuring the provider failure.
- Fix: narrowly recognize this bootstrap error, clear the existing read-provider
  cache, and show an explicit error. Do not attribute bootstrap exhaustion to a
  particular endpoint's rate limit. The next explicit refresh creates/obtains a
  provider through the existing mainnet factory. No write or automatic retry is
  introduced. Existing read-failure rotation remains throttled.
- A single block-number bootstrap barrier precedes pool fan-out so one exhausted
  provider does not immediately start all pool reads.
- Verification: `__tests__/rpcBootstrapRecovery.test.js` uses the installed real
  ethers implementation with offline in-memory endpoints: the original instance
  still fails after endpoints recover; a reconstructed fallback succeeds.
  Component tests cover error state, no downstream reads and manual recovery.
- Boundary: this confirms a library failure mechanism, not the original outage's
  underlying cause (HTTP 429, authentication, provider billing or network loss).
  Other provider caches elsewhere in the project are not redesigned by this fix.

### PL02: Partial results were shown as zero, wrong units or missing rows

- Locations: `LiveStats.jsx:1795`, `:3218`, `:3236`, `:3250`.
- Failed native/token/LP reads previously fell through to zeros; token rows with
  missing balances disappeared. Missing decimals could become 0 through Number
  conversion or fall back to assumed units. Different address sources could be
  used for native and BIGGI balances for the same pool name.
- Fix: preserve nulls, validate decimals (including valid zero), retain failed
  rows, and distinguish loading, partial, error and ready. Missing units/amounts
  render unknown. Confirmed zero still renders zero. Native, BIGGI and LP reads
  now share the destinations resolved from the existing distributor snapshot.
- Data flow: reuse `fetchDistributorSnapshot({provider})`; do not invent another
  distributor reader. If the reader falls back to configured addresses, those
  remain configuration fallbacks, not proof of successful on-chain verification.
- Verification: partial balances, null snapshot/unknown allocations, confirmed
  zero, missing/zero decimals, retained rows and changed distributor destinations
  are covered by `__tests__/liveStatsPools.test.jsx`.
- No allocation percentages, accounting formula, claim eligibility, token supply,
  approvals or funds routing are modified. This is a display/read-flow change.

### PL03: Closed, reopened or stalled requests could publish late data

- Locations: `LiveStats.jsx:1003`, `:1795`, `:2773`.
- Fix: request-generation ownership, invalidation on close/unmount, and checks
  between read phases and before publishing. A 20-second UI deadline ends the
  loading state and re-enables explicit refresh. A previous request cannot clear
  a newer request's timer or overwrite its result.
- Verification: close during bootstrap, close/reopen during snapshot, unmount,
  StrictMode refresh, timeout and late completion are covered by component tests.
- Boundary: this does not abort ethers requests already in flight. The existing
  distributor helper may finish its internal fallback calls after the UI timeout.
  Later LiveStats phases and result publication are suppressed for stale requests.

### PL04: Pool refresh made unused duplicate contract reads

- Location: `LiveStats.jsx:1795`.
- Removed duplicate direct destination getters and unused distributor balance,
  totalReceived and per-collection received reads/state. Consumers were checked
  before removal; the modal does not render those removed properties.
- This removes up to 17 direct read invocations in the configured ten-collection path
  and adds one bootstrap read. It is not a claim of 17 fewer HTTP requests: the
  existing snapshot helper, batching, fallback and provider synchronization also
  perform reads. No latency or percentage speed-up is claimed.
- Verification: existing snapshot use, five native pools and all displayed
  balances are asserted. No replacement polling loop or dependency was added.

## Presentation

The six LiveStats widget frames and menu-button arrangement are unchanged.
The Tokenomics dialog gains one fixed-size refresh icon beside its existing X
and a small live status line. Existing colors and layout remain. Browser checks
exercise the real panel/CSS with controlled read responses and block external
requests. Desktop/mobile error, partial and recovery screenshots are local
ignored artifacts named `tmp-pools-*.png`.

## Verification

| Check | Result | Command/evidence |
| --- | --- | --- |
| Full Vitest suite | PASS | `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=tmp-pools-final-tests.json`: 88 files, 548 passed, 0 failed/skipped; 148.48 seconds. |
| Focused regressions after final icon fix | PASS | `node node_modules/vitest/vitest.mjs run __tests__/liveStatsPools.test.jsx __tests__/rpcErrors.test.js __tests__/rpcBootstrapRecovery.test.js __tests__/liveStatsReadFailures.test.jsx --maxWorkers=2 --reporter=dot`: 4 files, 34 passed, 14.66 seconds. The new pool test file contains 14 cases. |
| ESLint without fixes | PASS with existing warnings | `ESLint({fix:false}).lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`: 481 files, 0 errors, 115 warnings, same warning count as the preceding repair step. |
| Typecheck | PASS | `npm run typecheck`; existing TS/TSX coverage only (`checkJs:false`), not a type-safety guarantee for JSX. |
| Final production build | PASS | `npm run build`: 4380 modules, 54.22 seconds, 9 inline-script CSP hashes. Local app entry `/assets/app-BMqMpDe6.js`, LiveStats chunk `LiveStats-D8j7anQ9.js`. |
| Browser fixture with global styles | PASS | `node scripts/smoke-pools.mjs`: widths 1440/768/390/320, failure/partial/success, explicit refresh, close, no modal/button overflow or overlap/page errors. External requests blocked. Refresh icon 16x16 and button 32x32 asserted. |
| Final built-app smoke | PASS | `node scripts/smoke-runtime.mjs`, output URL paths redacted: Gallery, LiveStats, Rewards and disconnected User Panel passed; mobile shell/layout passed. Pool reads reached `ready`. No console errors were reported. Refresh icon dimensions passed and `tmp-runtime-pools.png` was visually inspected. |
| Existing local preview | PASS | Read-only HTTP check returned 200 with `/assets/app-BMqMpDe6.js` at `http://127.0.0.1:5181/app/`. |
| Smoke script syntax | PASS | `node --check scripts/smoke-pools.mjs`; `node --check scripts/smoke-runtime.mjs`. |
| Secret scan | PASS | `npm run security:secrets`; tracked/pending file scan, no secret values printed. This is not a complete audit of provider credentials or every bundled string. |
| Whitespace | PASS | `git diff --check`; only the existing LiveStats CRLF normalization notice. |
| Wallet/mainnet transaction | SKIPPED | No signing, approve, mint, redeem, claim, buyback, drip or liquidity transaction performed. |
| Deployment/commit/push | SKIPPED | Local only. |

The first browser fixture omitted global App/index CSS. Production-bundle visual
inspection caught the resulting blind spot: global button padding squeezed the
new refresh SVG to 0x0. The button now explicitly sets zero padding, the fixture
imports both global stylesheets, and both smoke scripts assert icon dimensions.
This was repaired before completion. The existing global styles were not changed.

The full-suite result above precedes only that two-property icon sizing fix;
the focused 34-test run and four-width browser fixture passed again afterwards.
The final build and built-app smoke also passed after that fix. Real read success
in this run does not prove continuous availability or eliminate provider limits.
All temporary fixture/smoke processes were closed. The existing local preview
process (PID 22512) remains running; no public deployment was changed.

## Remaining scope

- This is not a formal smart-contract audit or a guarantee that public/private
  RPC services are continuously available. No provider billing or secrets were
  changed, and no wallet signing/mainnet write was performed.
- Token overview and price reads remain separate from pool refresh. The partial
  pool status is not a health assessment of every field in the Tokenomics panel.
- Next bounded work: distributor helper timeout/error propagation, wallet
  activity/referral lifecycle, then measured rewards polling and duplicate RPC
  load. Broader financial-flow changes require explicit review, not a refactor.
