# Frontend lint cleanup - 2026-09-13

Starting commit: `a092e48`. Existing uncommitted gallery, NFT card, User Panel,
LiveStats and RPC repairs were preserved. This report describes the subsequent
warning-reduction step, not every change relative to HEAD.

## Result

The frontend ESLint scan decreased from **115 warnings to 23**, with **0 errors**
across 481 source files. All remaining warnings are
`react-refresh/only-export-components`. No ESLint configuration was weakened,
no new rule suppression was added, and four obsolete `no-console` suppression
comments were removed while retaining the actual logs.

## Repairs

- `src/app/AppCore.jsx:9083`: the resume effect captures its timer-owning object
  once and cleans up that same object even if the ref has been replaced. An
  extracted-effect test proves that the old timer cannot run after cleanup.
- `src/ACTIONBUTTONS/REDEEMTICKET/RedeemOverlay.jsx:24`: invalidate the network
  label request on unmount and reject older completions after a chain change;
  remove only the listener this effect installed. This is a legacy component,
  not the currently mounted dashboard redeem flow. Tests cover account-network
  label lifecycle, cleanup and development StrictMode without RPC writes.
- `src/shared/components/FullscreenPanel.jsx:205`: capture the DOM node and its
  previous overscroll style at setup; restore the same node on close, including
  after detach. Verified with and without StrictMode. Layout while open remains
  unchanged.
- `src/providers/ContractsProvider.jsx:101`: stabilize the existing `rwOrRo`
  factory with the actual signer/provider dependencies and include it in the
  context memo. Tests cover stable context identity, no eager factory reads,
  account connection/change/disconnection and the existing read fallback. The
  factory's write/read selection behavior was not redesigned.
- AppCore callbacks, `LiveChatPanel`, `NftCard` and Tokenomics memos: remove
  redundant module-constant dependencies; include the existing stable
  `callFirst` where used. No blanket useMemo/useCallback or lint-rule disabling.
- Collection hero formatting now lives inside its memo; chapter fallback lists,
  modal colors and static Expansion roadmap stages have stable references.
  `public-repo/src/features/tokenomics/expansion/ExpansionPanel.jsx` has the
  identical Expansion change. Chapter counts, prices, styles and constants are
  unchanged.
- Remove unused props, catch parameters, duplicate private styles and unused
  state from the affected panels. Calls with side effects were retained, e.g.
  the existing `await liqRO()` in RewardsProvider. Removing the unused Collection
  background-count setter does not remove its reader or alter background price
  effects, metadata or mint counts used by the display.
- LiveStats: remove the private, unreferenced legacy `handleClaim` implementation,
  its unused inline ABI, local state and helpers. **The active weekly claim path
  remains `useWeeklyCountdown -> weeklyHandleClaim -> WeeklyCountdown.onClaim`**
  (`src/components/LiveStats.jsx:1001`, `:3561`). No active claim feature was
  removed, and no contract ABI artifact was changed. The 24-hour price-change
  field remains unknown; no replacement price is invented.
- Five component-only compatibility shims no longer use redundant `export *`:
  FullscreenPanel, LineChart, SimpleLineChart, BiggiButton and StatCard. Their
  canonical modules only export default; runtime import tests verify identical
  export keys and component identity. Mixed helper/hook exports were not removed.
- Replace a garbled VRF error-message separator with `Admin > VRF`; JSX quote
  and apostrophe escapes preserve their displayed text.

The lifecycle changes affect cleanup and stale read publication. The other
changes remove unused work or stabilize existing dependencies. They do not
change mint/redeem/VRF, claim eligibility, reward formulas, pricing, approvals,
addresses, Solidity, token flows or NFT metadata. Six LiveStats frames and the
button arrangement are retained. No measured speed-up is claimed.

## Remaining warnings

All 23 are development Fast Refresh export-boundary warnings:

| Group | Files | Count |
| --- | --- | --- |
| Entry | `src/app/main.jsx` | 1 |
| Provider compatibility re-exports | `src/app/providers/{Contracts,REWARDS,Vrf,Web3}Provider.jsx` | 4 |
| Address component/helper exports | `src/components/common/Address.jsx`, `src/shared/components/Address.jsx` | 3 |
| Tokenomics exports | `src/features/tokenomics/index.jsx`, `tabs/FlowTab.jsx`, `tabs/HistoryTab.jsx`, `tabs/TransparencyTab.jsx` | 7 |
| Provider component/hook exports | `src/providers/{Contracts,Inventory,Rewards,Stats,Vrf,Web3}Provider.jsx` | 8 |

They are not production-build errors. Removing them correctly requires a
separate, scoped split of components, hooks/helpers and their import paths,
including compatibility exports and tests. They are deliberately left visible;
this result does not claim that every remaining warning is irrelevant or that
the project has no other defects.

## Verification

| Check | Status | Evidence |
| --- | --- | --- |
| ESLint, no fixes | PASS with warnings | `ESLint({fix:false}).lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`: 481 files, 0 errors, 23 warnings. Final `npm run lint` independently confirmed 0 errors and 23 warnings. |
| New regression tests | PASS | `node node_modules/vitest/vitest.mjs run __tests__/contractsProviderStability.test.jsx __tests__/lintLifecycleRegression.test.jsx __tests__/componentShimExports.test.js --maxWorkers=2 --reporter=dot`: 3 files, 14 tests. |
| Full Vitest suite | PASS | `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=tmp-lint-cleanup-tests.json`: final rerun after the public Expansion mirror repair, 91 files, 562 passed, 0 failed/skipped, 241.07 seconds. |
| Typecheck | PASS | `npm run typecheck`; existing TS/TSX scope, `checkJs:false`. Not a guarantee of full JSX type safety. |
| Production build | PASS | `npm run build`: 4380 modules, 58.36 seconds, 9 inline-script CSP hashes; local artifacts only. App entry `/assets/app-CCMAwoSn.js`, LiveStats chunk `LiveStats-BhIL1Jdp.js`. |
| Browser fixture | PASS | `node scripts/smoke-pools.mjs`: widths 1440/768/390/320, error/partial/success transitions, explicit refresh and close; no checked modal/button overflow or overlap. Real component and global styles, offline read fixtures. Desktop and 320px screenshots inspected. |
| Built-app smoke | PASS | `node scripts/smoke-runtime.mjs`, with URL paths redacted from captured output: Gallery, LiveStats, Rewards claim status, disconnected User Panel and mobile layout. Real pool reads reached `ready`; no console errors reported. `tmp-runtime-pools.png` inspected. No wallet was connected or transaction sent. |
| Local preview | PASS | HTTP 200 at `http://127.0.0.1:5181/app/`, serving `/assets/app-CCMAwoSn.js`. |
| Secret scan | PASS | `npm run security:secrets`; tracked/pending-file pattern scan, not a full security audit. No secret values printed. |
| Whitespace | PASS | `git diff --check`; only Git's existing LiveStats CRLF normalization notice. |
| Mainnet writes | SKIPPED | No signing, approve, mint, redeem, claim, buyback, drip or liquidity transactions. |
| Deployment / commit / push | SKIPPED | Local only; no Netlify, environment or credentials changed. |

The first full run passed 561 tests and failed one: the existing byte-for-byte
Expansion public-mirror consistency assertion. The same small source edit was
applied to the public copy, preserving the assertion rather than weakening it.
The final rerun status is recorded above. This is not a formal smart-contract
security audit or a runtime performance benchmark.

All test, build and temporary browser-fixture processes finished. The existing
preview remains available at `http://127.0.0.1:5181/app/`; Netlify was not updated.
Successful read checks during this run do not guarantee uninterrupted RPC
availability or establish the correctness of untested on-chain write flows.
