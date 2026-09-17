# React export boundaries - 2026-09-13

Follow-up to [the lint cleanup](lint-cleanup-2026-09-13.md). Starting commit
`a092e48`, with all prior uncommitted work preserved. Local changes only.

## Outcome and scope

The previous pass left 23 `react-refresh/only-export-components` warnings.
`npm run lint` now exits successfully without warnings or errors. A counted
scan confirms **490 source files, 0 errors and 0 warnings**. Rules and
ignore patterns are unchanged. This does not mean the application is free of
all bugs, security risks or possible console messages.

- Extract the unchanged Bootstrap component from `src/app/main.jsx` to
  `src/app/Bootstrap.jsx`. Startup timing, cancellation, StrictMode selection,
  loading markup, documentation routing and Sentry initialization are retained.
- Extract six context instances and eight hooks into
  `src/providers/{Web3,Contracts,Rewards,Vrf,Stats,Inventory}Context.js`.
  Provider JSX files now export components only and import their single context
  instance. All application hook consumers and test mocks use the new paths.
- Provider aliases in `src/app/providers` explicitly re-export the corresponding
  component. The `useVRF.js` compatibility entry retains its hook and provider
  exports; the UI contracts hook shares the canonical context.
- Move Address formatting/checking helpers to `addressFormatting.js`, and Flow
  amount wrappers to the existing `amountFormatting.js`. Move history/timeline
  builders and their private number formatter to `historyFormatting.js`.
  Function bodies and rendered values are unchanged.
- Rename the pure Tokenomics re-export module from `index.jsx` to `index.js`.
  It contains no component implementation or JSX; actual components have their
  own JSX boundaries. Its complete export API is tested, including utility and
  hook identity. No warning is hidden by renaming a component implementation.
- Update the two offline browser fixtures to intercept the new context imports,
  rather than accidentally loading real wallet readers. External requests stay
  blocked in those fixtures.

## Compatibility and boundaries

This is an **internal JavaScript module interface change**: hooks are no longer
exported from the Provider JSX files or the application component aliases.
Address and tab helpers also moved out of component modules. Their known
consumers have been updated. Import examples are recorded in
`FRONTEND_ARCHITECTURE.md`. Explicit references to the former Tokenomics
`index.jsx` must use `index.js`; no such reference remained in application,
tests or scripts at verification time.

This is not an API/ABI, contract-address, metadata, RPC configuration or
financial-rule change. It does not change account selection, wallet connection,
mint/redeem/VRF, reward eligibility, pricing, permissions or money movement.
The existing `@refresh reload` annotations on provider files were retained.
No new dependencies or ESLint suppressions were introduced.

## Verification

| Check | Status | Evidence |
| --- | --- | --- |
| ESLint without fixes | PASS | `npm run lint`, exit 0, no diagnostics. Final `ESLint({fix:false}).lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`: 490 files, 0 errors, 0 warnings. |
| Focused suite | PASS | `node node_modules/vitest/vitest.mjs run __tests__/providerContextBoundaries.test.jsx __tests__/bootstrapLifecycle.test.jsx __tests__/componentBoundaryExports.test.js __tests__/contractsProviderStability.test.jsx __tests__/Web3Provider.reconnect.test.jsx __tests__/flowTabFormatting.test.js __tests__/ecosystemHistory.test.jsx --maxWorkers=2 --reporter=dot`: 7 files, 46 tests, 12.73 seconds. |
| Moved function bodies | PASS | Babel-selected function/declaration comparison against `git show HEAD:<source>`: 16 unchanged bodies, allowing only the context identifier rename and export wrapper. |
| Full Vitest suite | PASS | `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=tmp-refresh-boundaries-tests.json`: 94 files, 591 passed, 0 failed/skipped, 136.93 seconds. |
| Typecheck | PASS | `npm run typecheck`; existing TS/TSX scope only, not full JSX type checking. |
| Production build | PASS | `npm run build`: 4387 modules, 36.09 seconds, 9 inline-script CSP hashes. App entry `/assets/app-Bnfey5pE.js`. Local artifacts only. |
| Browser fixtures | PASS | `node scripts/smoke-user-panel.mjs` and `node scripts/smoke-nft-cards.mjs`: 1440/768/390/320px, controlled data, no wallet signing or external requests. User balance failure/account change/recovery, claim enablement, card details and zoom/escape, loaded images, no checked overflow or page errors. Desktop/320px screenshots inspected. |
| Built-app smoke | PASS | `node scripts/smoke-runtime.mjs`, captured output with URL paths redacted: Gallery, LiveStats, Rewards claim status, User Panel without a connected wallet, and mobile layout. Pool reads reached `ready`; no console errors were reported. |
| Local preview | PASS | HTTP 200 at `http://127.0.0.1:5181/app/`, serving `/assets/app-Bnfey5pE.js`. |
| Secret scan | PASS | `npm run security:secrets`: no credential-like values found in tracked/pending files. This is a pattern scan, not a complete credential audit. No secret values printed. |
| Whitespace | PASS | `git diff --check`; only the existing Git notice about LiveStats CRLF normalization. |
| Mainnet writes | SKIPPED | No signing, approval, mint, redeem, claim, buyback, drip or liquidity transaction. |
| Deploy / commit / push | SKIPPED | No Netlify or git publication. |

The 29 new tests cover Bootstrap completion/timeout/unmount/StrictMode,
component-only exports, preserved Tokenomics and VRF aliases, shared context
identity and missing-provider guards. The context-wiring test disables effects
to avoid polling; the separate existing wallet reconnect suite exercises the
real provider effects with controlled wallet responses.

Initial new assertions incorrectly expected a null account and function-typed
memoized components. They were corrected to the existing empty-string account
and React's valid element-type check, without changing production behavior.
The reconnect test intentionally emits a warning for its missing-MetaMask
fixture. It is not an ESLint warning or proof of a production outage.

No runtime speed-up or uninterrupted RPC availability is claimed. These checks
are not a formal security audit or a real funded wallet transaction test.

Verification processes and temporary fixture servers finished. The existing
local preview remains running; Netlify, secrets, dependencies, contract ABIs,
addresses and on-chain state were not changed by this step.
