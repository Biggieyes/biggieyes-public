# Gallery navigation and lint follow-up - 2026-09-12

Local follow-up to [the published release](netlify-release-2026-09-12.md).
Starting commit: `a092e48`; the working tree was clean before this task.
No Netlify deployment, Git commit/push, configuration changes, dependency
updates, contract transactions or permission changes were performed here.

## Confirmed findings and fixes

### G01: Duplicate gallery anchor

- P3, high confidence. `src/components/layout/MainLayout.jsx`, `GallerySection`
  usage: the outer deferred host owned `id="gallery"`, but passing an undefined
  inner `sectionId` activated the child's default ID again after lazy mount.
- Impact: ambiguous DOM/anchor selection; browser automation reproduced two IDs
  instead of one, including under StrictMode.
- Fix: explicitly pass `null` to the inner section. The persistent outer anchor
  and standalone GallerySection's default anchor are preserved. No CSS changes.
- Verified: intersection-triggered mount, StrictMode cleanup, standalone section,
  footer navigation and unique IDs in the built desktop/mobile application.

### G02: Direct gallery links did not force the lazy content to mount

- P2, high confidence. `MainLayout` compared `anchor` with `gallery`, although
  `src/shared/hooks/useHashRouting.ts` returns `#gallery`.
- Impact: explicit navigation still depended on intersection observation;
  the intended immediate loading path never activated.
- Fix: compare the actual fragment. Changes UI loading/navigation behavior,
  not the data source or collection rules.
- Verified: initial `#gallery`, hash-router `#/dashboard#gallery`, and subsequent
  hash changes mount the real GallerySection without simulating intersection.

### G03: Invalid fragments and stale animation-frame callbacks

- P2, high confidence. `useHashRouting.scrollToAnchor` used a URL fragment as a
  CSS selector and did not cancel queued scrolling.
- Impact: fragments such as `#[` caused a DOM SyntaxError; an older request or
  unmounted component could still scroll after navigation had changed.
- Fix: decode the fragment and use exact `getElementById`; ignore malformed
  encoding and empty targets. Track/cancel the pending animation frame when
  another target is requested, the hash changes, or the component unmounts.
  Preserve the existing bound of at most three frame attempts.
- Internal API behavior: this helper accepts fragment IDs, not arbitrary CSS
  selectors. Its only active caller is MainLayout and already passes fragments.
- Verified: encoded IDs containing `:`, malformed targets, newer-target wins,
  unmount, hash changes and bounded retry tests. Browser smoke also changes the
  real application's hash to `#[` and checks for runtime errors.

### G04: Empty inputs invalidated gallery memoized calculations

- P3, high confidence; demonstrated code-path overhead, not a browser speed
  benchmark. `src/components/Gallery.jsx` created fresh empty arrays for omitted
  or invalid items and disconnected-wallet rendering.
- Impact: existing memoized filtering/counting chains ran again on unrelated
  rerenders. Ten dependency warnings described this same underlying problem.
- Fix: use one frozen empty-array fallback. No extra hooks or caches; supplied
  asset lists, chapter grouping, ordering, metadata and prices remain unchanged.
- Verified: spies around the actual chapter counter confirm no additional
  calls on unrelated rerenders for all three empty-input cases. Existing gallery
  tests still verify TicketHub, VRF and Public assets together by chapter.

## Verification

| Check / command | Status | Result / boundary |
| --- | --- | --- |
| New tests before source fixes, Vitest single worker | FAIL | 16 of 18 failed with reproduced duplicate IDs, missing lazy mount, selector errors, stale scrolling and redundant counter calls. Two unaffected cases passed. |
| New tests plus `galleryChapterSwitcher.test.jsx` and `galleryMainnetConsistency.test.js` | PASS | 24 tests across five files. Gallery leaf rendering, wallet and observers are mocked in layout tests; MainLayout, GallerySection and routing hook are real. |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1` | PASS | 81 files, 432 tests, 220.60 seconds. |
| `npm run typecheck` | PASS | Configured TypeScript surface; includes the changed routing hook. |
| ESLint API `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`, `fix: false` | PASS | 481 files, zero errors; warnings decreased from 137 to 127 without changing lint rules. |
| `npm run build` | PASS | 4380 modules, 52.43 seconds; nine inline-script CSP hashes. Local environment, not a newly verified Netlify production configuration. |
| `node scripts/smoke-runtime.mjs` with URL-sanitized output | PASS | Desktop/mobile Gallery, footer link, unique anchor, direct gallery URL, invalid fragment, LiveStats, Rewards preview and mobile overflow. Preview and browser closed. |
| Existing local preview, Playwright widths 1440 and 390 | PASS | Current build entry `/assets/app-GWLzxCAs.js`; one gallery ID, no horizontal overflow or page errors. Screenshots inspected. |
| `git diff --check` | PASS | No whitespace errors. |
| `node scripts/check-secrets.mjs` | PASS | No credential-like values found in tracked or pending files. |
| Backend/mainnet transactions and deployment | SKIPPED | No backend/ABI/address/financial-logic changes in this task; not needed for these DOM fixes. |

Local preview: http://127.0.0.1:5181/app/#gallery . The existing server was
reused after verifying it serves the new `dist` entry. It was not replaced.
The public deployment remains the release referenced above.

## Remaining warnings and next scope

The 127 warnings are not 127 confirmed functional defects:

- 34 hook dependency warnings: prioritize the image lifecycle in LiveStats and
  NftCard, then shared provider/read callbacks. Trace dependencies before editing.
- 52 unused-variable warnings: distinguish unused presentation state from a
  missing consumer of loading/error state before removing anything.
- 28 Fast Refresh export warnings: development-module structure, not evidence
  of a mainnet failure. Do not split modules only to reduce the warning count.
- Five `prefer-const`, three unescaped JSX text, one irregular-whitespace and
  four unused lint-disable warnings remain as lower-priority cleanup.

No percentage speedup is claimed. This is not a formal security audit or a
real-wallet mint/redeem/claim test. No change to token supply, pricing growth,
NFT metadata, VRF randomness, reward eligibility or financial recipients.
