# User Panel read consistency - 2026-09-13

Follow-up to the [JS/React/blockchain audit](javascript-react-blockchain-audit-2026-09-11.md)
and [NFT card fixes](nft-card-consistency-2026-09-13.md). Starting commit: `a092e48`.
All pre-existing uncommitted changes were preserved. This step is local only.

## Scope and conclusion

Reproducible read-lifecycle and display errors in the active User Panel and its
AppCore claim preview have been repaired. No CSS, image assets, NFT metadata,
ABI, addresses, Solidity, dependency versions, environment or financial rules
were changed. No transactions, approvals, deployment, commit or push were made.
This is not a formal smart-contract security audit or an uptime guarantee.

The existing mainnet readers and ethers 6.17.0 are retained. Tests use controlled
read responses; they do not sign transactions or query private RPC endpoints.

## Findings and fixes

All findings below are P2, high confidence, reproduced through component or
production-callback tests. Locations refer to the repaired working tree.

### UP01: Wrong-chain and previous-account balances

- Location: `src/features/user/USERPANEL.jsx:170`, `refreshOverview` at line 346.
- The native balance preferred the connected wallet provider. A wallet on Amoy
  could therefore display its balance under POL alongside mainnet contract reads.
  A previous account's balances remained visible during loading; no effect cleanup
  invalidated reads on unmount.
- Fix: prefer the shared read provider, require chain ID 137 before reading
  balances, associate the snapshot with account/network/provider/contracts and
  invalidate the request generation on cleanup. Discard late results.
- Behavior change: unavailable or wrong-chain reads show unknown values rather
  than a misleading mainnet balance. The wallet is not switched by this reader.
- Verification: different wallet/read networks, delayed account changes, clearing
  successful old values, unmount during network validation, StrictMode replay.

### UP02: Missing responses presented as zero or an empty wallet

- Location: `USERPANEL.jsx:72`, `:511`, `:601`, collection/community render states.
- Failed NFT/ticket reads fell through to an empty inventory count of zero.
  `Number(null)` made unknown rewards look like zero; other malformed values
  could enable claim based solely on possessing an NFT. Community loading with
  missing claim counts was rendered as no claimable prize.
- Fix: distinguish unknown/loading from confirmed zero. Accept only safe,
  nonnegative integer counts and a known nonnegative claim amount. Keep loaded
  positive inventory fallback and show explicit missing preview/data states.
  Hide parent inventory/claim props when their wallet differs from the context.
- Behavior change: claim is disabled without a known positive preview. Valid
  redeem fallback from loaded tickets is preserved. Supplied decimal-string
  claim amounts are displayed without first rounding them through Number.
- Verification: null/blank/NaN/negative claim values; malformed counts; real
  zeros; mismatched parent wallet; failed reads; genuine positive claims.

### UP03: Token decimals and concurrent read failures

- Location: `USERPANEL.jsx:346`, BIGGI read inside `refreshOverview`.
- Missing decimals silently assumed 18. Evaluation of concurrent calls could
  also abandon an already-started rejected promise if the other method threw
  synchronously or was absent.
- Fix: require both methods, validate the returned decimals (including valid 0),
  and attach both operations to Promise.all before invoking their methods.
- Behavior change: unknown token amounts stay unknown. No token units or
  transaction amounts are modified.
- Verification: null decimals, zero decimals, absent method, simultaneous
  synchronous decimals exception and rejected balance read. Vitest also checks
  that these cases produce no unhandled rejections.

### UP04: Ambiguous and failed BIGGI claim previews

- Location: `src/app/AppCore.jsx:3303`, `refreshClaimable`.
- A malformed `[units]` response used units as a token amount. Failed preview
  reads fell back to another API and ultimately zero. Secondary collection
  previews could fall back to bare IDs when collection-aware support was missing.
- Fix: only consume the amount field, validate its integer representation,
  preserve missing/error results as null and require collection-aware reads for
  secondary or overlapping IDs. Only use a legacy claimStatus reader when there
  is no preview method, not after a failed/malformed preview.
- Behavior/data-flow change: unavailable previews cannot invent a claim amount
  or silently substitute another collection. The numeric-or-null interface to
  existing reward widgets is preserved; actual claim submission is unchanged.
- Verification: valid amounts, real zero, malformed tuples, read rejection,
  ticket exclusion, empty/unloaded inventory, duplicate IDs across collections
  and absent collection-aware capability.

### UP05: Reward snapshots and reconnect inventories

- Location: `AppCore.jsx:1963`, `:3303`, reconnect handlers at `:7282`, `:7471`,
  resume handler at `:7647`.
- A previous claim preview remained visible during wallet changes. Reconnect
  and resume paths did not always clear the previous wallet's inventory before
  loading the new one, unlike the accountsChanged handler.
- Fix: scope the claim snapshot to wallet and inventory identity; validate the
  active wallet/request at publication and invalidate on cleanup. Clear inventory
  and derived traits on account changes in reconnect/resume paths.
- Behavior change: previous-account data is hidden until current reads resolve.
  No cached on-chain ownership, ownership rule or transfer is changed.
- Verification: mounted production snapshot declarations, production read
  callback under wallet/request changes, WalletConnect reconnect and resume
  callbacks asserting that inventory is cleared before the replacement fetch.

### UP06: Refresh action omitted BIGGI claim preview

- Location: `USERPANEL.jsx:593`, AppCore panel binding at `:9400`.
- Refresh data previously refreshed balances/community only. A failed token
  reward preview could not be explicitly refreshed from this panel.
- Fix: optional internal `onRefreshClaimable` prop, wired to the existing root
  read callback, with partial refresh failures contained by Promise.allSettled.
  The panel memo includes the callback dependency.
- Behavior/interface change: the refresh button also re-reads BIGGI claim data.
  This is a read-only callback; no automatic claim/retry or signing is added.
- Verification: component refresh invokes the callback and finishes even when
  that read rejects; production bundle smoke opens the actual lazy User Panel.

## Verification

| Check | Result | Command/evidence |
| --- | --- | --- |
| Reproduction before fixes | FAIL, expected | New User Panel tests: 22 failed / 3 passed. Initial claim callback tests: 8 failed / 5 passed. These established the regressions before implementation. |
| Focused final new regressions | PASS | `node node_modules/vitest/vitest.mjs run __tests__/appClaimPreviewRead.test.js __tests__/userPanelReadLifecycle.test.jsx --maxWorkers=2 --reporter=dot`: 45 tests. |
| Full final Vitest suite | PASS | `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=tmp-user-panel-final-tests.json`: 86 files, 531 passed, 0 failed; 138.33 seconds. Includes existing write-lifecycle and loaded-ticket redeem tests. |
| ESLint, no automatic fixes | PASS with existing warnings | `ESLint({fix:false}).lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`: 481 files, 0 errors, 115 existing warnings. User Panel: 0 warnings. The newly introduced panel-memo dependency warning was fixed. |
| Typecheck | PASS | `npm run typecheck`. Existing configuration covers TS/TSX; this is not a type-safety guarantee for the JSX files modified here. |
| Production build | PASS | `npm run build`: 4380 modules, 46.81 seconds, 9 inline-script CSP hashes. Local app entry: `/assets/app-DcaRYCr8.js`; User Panel chunk: `USERPANEL-CyfOPu2K.js`. |
| User Panel browser fixture | PASS | `node scripts/smoke-user-panel.mjs`: widths 1440/768/390/320, successful reads, all-unknown failure state, disabled unknown claim and recovery after account change. No horizontal/button overflow, no page errors. Local NFT image loaded; desktop/mobile screenshots visually inspected. |
| Built-app smoke | PASS with read warning | `node scripts/smoke-runtime.mjs`, output URL paths redacted: desktop Gallery/LiveStats/Rewards/User Panel and mobile shell passed. The actual lazy User Panel renders unknown balances and disables claim when disconnected. One non-fatal `refreshPools error: no runners?!` was observed; pool RPC health is not verified by this pass. |
| Credential scan | PASS | `npm run security:secrets`: no credential-like values in tracked/pending files. |
| Patch whitespace | PASS | `git diff --check`; existing LiveStats CRLF normalization notice only. |
| Real wallet/mainnet claim | SKIPPED | No signing, approvals, write transactions or external-state changes authorized for this repair step. |
| Deployment/commit/push | SKIPPED | Local changes only; no Netlify or GitHub publishing. |

The initial isolated browser fixture failed because its no-discovery Vite setup
did not prebundle the `react-dom` CommonJS entry used by portals. Adding that
dependency to this test harness's existing prebundle list fixed the harness.
No dependency installation, production build configuration or application code
change was needed for that failure. All four final browser fixture runs passed.

Screenshots and JSON results are ignored local artifacts (`tmp-user-panel-*`).
Temporary fixture/preview processes were closed; the existing local preview
remains at `http://127.0.0.1:5181/app/`.

## Boundaries and next checks

- AppCore callbacks and selected snapshot declarations are executed from the
  production source with dependencies mocked. This is not a fully mounted
  wallet-connected AppCore transaction E2E or real mainnet claim execution.
- No changes to mint, redeem/burn, VRF request/fulfillment, reward percentages,
  eligibility rules, approval permissions or money routing. The claim button's
  unknown-state gating and read fallback changes above are intentional behavior
  changes, not hidden as cosmetic refactoring.
- AppCore's numeric reward-widget interface can still round very large token
  quantities for display; transaction amounts continue to use integer values.
- Follow-up scope: per-wallet activity history and referral clipboard lifecycle,
  pool/volume partial-read presentation, then measured reward-panel polling and
  RPC load. Those paths are not claimed to be repaired by this report.
- Investigate the observed `refreshPools: no runners?!` with read-only endpoint
  diagnostics before claiming that all pool data or RPC services are healthy.
  The structural browser smoke passing does not resolve this provider error.
