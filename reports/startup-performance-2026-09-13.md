# Startup performance - 2026-09-13

## Outcome and scope

Local startup improvements following the [published release](netlify-release-2026-09-13.md).
The existing dirty working tree was preserved. No deployment, commit, dependency
change, wallet signature or blockchain write was performed in this pass.

Kept changes:

- `app/index.html`: preload the existing mobile navigation background at widths
  up to 900px. Restrict the two existing desktop logo preloads to widths above
  900px. Rendered images, image files, CSS and layout are unchanged.
- `src/app/Bootstrap.jsx`: publish progress state only when its displayed integer
  value changes; publish messages only when they change. Keep startup timing,
  timeouts, cleanup and StrictMode behavior. The progress manager still runs.
- `src/components/LoadingOverlay.jsx`: remove the second, imperative write to
  progress-bar width; retain the existing React-controlled inline width.
- Add startup regression tests and `scripts/profile-startup.mjs` for repeatable,
  read-only browser profiling. The profiler uses existing Playwright and Vite.

The HTML preload allows earlier discovery of an existing critical asset; it does
not change the asset itself. See [Chrome's preload guidance](https://web.dev/articles/preload-critical-assets).
The narrow-screen media condition does not attempt to reproduce every existing
touch-device or landscape layout heuristic.

An experiment combining the nested lazy imports around LiveStats was measured
and discarded because desktop results were inconsistent. `LiveStatsPanel.jsx`
retains its original lazy loading and Suspense boundary. A reduction in JavaScript
request count from that experiment is NOT part of the final result.

No changes to contract addresses, ABIs, NFT metadata/images, prices, mint,
redeem, VRF, claims, permissions, RPC configuration, polling intervals or caches.
No financial or eligibility rule was changed. Existing unavailable balances and
prices remain unavailable instead of being replaced with fabricated values.

## Measurement

Command:

```sh
node scripts/profile-startup.mjs tmp-startup-final-paired.json 3 tmp-startup-reference
```

- Reference: startup assets from the published `biggieyes.com` deployment
  `6aa628737b7306f1bd2ec815`, entry `/assets/app-CUXM3VIX.js`.
- Current: production-configured local build, entry `/assets/app-Q_L8qiOd.js`.
- Both variants served through local Vite preview, alternating their order.
  The reference directory contains the startup resources needed for this
  comparison, not a complete offline copy of every application route.
- Three cold browser contexts per variant and viewport, 12 observations total.
- Chromium, no extensions or connected wallet, 4x CPU slowdown, 40ms latency,
  500,000 bytes/s download, 250,000 bytes/s upload, 15-second observation window.
- Normal in-page preload reuse was retained. Earlier exploratory runs that
  disabled cache caused duplicate downloads and are not used in this comparison.
- Actual read-only RPC requests were allowed. Their provider latency and shared
  machine load can vary. No test or build was run concurrently by this agent
  during the final paired measurements.

Medians of three runs, milliseconds unless otherwise indicated:

| Metric | Desktop before | Desktop after | Mobile before | Mobile after |
| --- | ---: | ---: | ---: | ---: |
| Last observed LCP | 7,168 | 6,036 | 6,624 | 4,896 |
| LiveStats shell mounted | 5,946 | 4,977 | 7,559 | 5,583 |
| Image encoded-body bytes | 1,319,836 | 1,319,836 | 1,586,946 | 1,335,600 |

Raw LCP observations:

- Desktop reference: 7,168 / 8,160 / 7,076ms.
- Desktop current: 6,036 / 5,884 / 8,416ms.
- Mobile reference: 9,248 / 5,744 / 6,624ms.
- Mobile current: 4,556 / 4,896 / 5,096ms.

The mobile image reduction was exactly **251,346 bytes** in every run, matching
the two desktop logos. The mobile background's median request start moved from
about 4,816ms to 140ms. Desktop image bytes were unchanged. Startup JavaScript
increased by 32 encoded-body bytes; this is not a bundle-size reduction.

All 12 measurements had zero uncaught page errors. These are small-sample lab
observations, not field Core Web Vitals or guaranteed loading times. One current
desktop run was slower than every reference run; do not infer a universal
desktop speed-up. Shell presence is not proof that all RPC data is ready.
The profiler's `blockingMs` is long-task excess above 50ms during its observation
window, not Lighthouse Total Blocking Time or INP.

## Build and verification

Build receipt: `tmp-startup-build.json`, built `2026-09-13T15:04:17.882Z`.
Artifact SHA-256: `1cc782196a8004ddbd0496f7ba1b2fa9de2d2ae00f18e93a0bf05e704f2b9c42`.
Base commit: `a092e489e8dffd573fe656da007153a1d0524210`, plus the existing
uncommitted work and this pass. The commit alone does not reproduce the build.

The previously reviewed release helper was invoked in memory with its stage
fixed to `build` or `smoke` and its receipt redirected to `tmp-startup-build.json`.
Only production client configuration was read from Netlify. No environment
variables or deployments were written. Private RPC paths and credentials were
not printed. The production client configuration fingerprint matched the
published reference.

| Check / command | Status | Result |
| --- | --- | --- |
| Production-configured release-helper build, Vite and `scripts/generate-security-headers.mjs` | PASS | Current artifact and security headers generated. |
| Production-configured `scripts/check-rpc-health.mjs` through build helper | PASS | Four endpoints returned Polygon chain 137 with fresh heads; at least two independent fresh endpoints required. This is a point-in-time check. |
| Built-output known-credential check | PASS | No checked server credential values or environment files in output. Not a complete secret audit. |
| ESLint API, `fix: false`, `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])` | PASS | 490 files, 0 errors, 0 warnings. Rules unchanged. |
| `npm run typecheck` | PASS | Existing TS/TSX scope; not full JSX type checking. |
| Focused Vitest, startup/Bootstrap/Gallery/LiveStats/preload lifecycle, `--maxWorkers=1 --reporter=dot` | PASS | 5 files, 33 tests. Final whole-suite result recorded below. |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=json --outputFile=tmp-startup-tests.json` | FAIL | 95 files, 599 passed, 1 failed, 0 skipped; about 597 seconds. One existing missing-credentials Live Chat test failed; details below. All startup regression tests passed. |
| `node node_modules/vitest/vitest.mjs run __tests__/liveChatFunctions.test.js __tests__/startupLoading.test.jsx __tests__/bootstrapLifecycle.test.jsx --maxWorkers=1 --reporter=verbose` | PASS | Final focused rerun: 3 files, 17 tests, 19.50 seconds, including the previously failed case and formatted startup tests. No test limits or assertions changed. |
| Release-helper `smoke`, `scripts/smoke-runtime.mjs` | PASS | Local production build: Gallery controls/hash navigation, LiveStats pools, Rewards preview and User Panel without a connected wallet; desktop/mobile. Pool reads ready, no reported console errors. |
| Playwright viewport and screenshot checks | PASS | 1440, 768, 390 and 320px; six LiveStats frames, no checked frame or document overflow, no page errors; visible top-bar/wallet images loaded. Desktop, tablet and mobile screenshots inspected. |
| `node --check scripts/profile-startup.mjs` | PASS | Syntax check after formatting. |
| `npm run security:secrets` | PASS | Pattern scan of tracked/pending files, no credential-like values found. |
| `git diff --check` | PASS | No whitespace errors; pre-existing LiveStats CRLF normalization notice only. |
| Deployment / commit / on-chain writes | SKIPPED | Not part of this optimization pass. |

New tests verify preload media conditions, unchanged lazy LiveStats inputs,
progress clamping, lock/listener cleanup, and absence of a second React commit
for an unchanged displayed progress value. Existing Bootstrap tests retain
StrictMode, timeout and unmount coverage. The initial progress test detected a
redundant commit when only rounding the state value; the explicit publication
guard fixed it. No assertion or timeout was relaxed to hide that issue.

An unchanged Gallery footer test timed out in an earlier run concurrent with
a build; the serial focused rerun passed without changing Gallery or its test.
An initial new HTML test used an unsuitable transformed module URL in Vitest;
its file read now uses the repository-relative path.

The full-suite failure was
`liveChatFunctions.test.js:33`, "returns a stable 503 response when server
credentials are missing". Its duration was 16,327ms against the configured
15,000ms test limit, but the JSON reporter preserved only `STACK_TRACE_ERROR`.
A timeout under machine load is plausible, not a conclusively diagnosed cause.
The unmodified case then passed in 904ms and its entire file passed. No Live
Chat source or test was changed. The handler's missing-configuration branch
returns before database calls. The complete 600-test run was not repeated;
do not describe the full-suite result as clean. Residual risk: test timing or
isolation remains worth investigating if the failure recurs on an idle runner.
The focused chat rerun also logged Supabase's multiple-client warning because
the fixtures reset imported modules; it was not an ESLint warning.

Local preview: http://127.0.0.1:5181/app/ . Generated profiling JSON, reference
assets, build output and screenshots remain ignored local artifacts. This pass
does not test real wallet signatures or funded transactions, prove continuous
RPC availability, or constitute a formal smart-contract/security audit.
