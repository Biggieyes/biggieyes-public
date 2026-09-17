# Token / DEX console failures - 2026-09-13

## Evidence and scope

The three supplied attachments contain the same 907-line log. In each copy:

- Two session-restoration errors and two unhandled rejections say MetaMask's
  extension was not found; their stacks point to `inpage.js`.
- 17 TokenDex helper warnings report `INSUFFICIENT_LIQUIDITY` from `getAmountsOut`.
- 54 TokenDex helper warnings report `TypeError: Failed to fetch`.
- One DRIP warning requests `VITE_ARCHIVE_RPC_URL` for historical event totals.

`installHook.js` is the console interception location, not evidence that the
failure originates in application code at that filename. No credentials,
private RPC URL paths or original calldata are reproduced here.

Existing uncommitted work, including startup improvements, was preserved. No
deployment, commit, dependency/configuration change or on-chain write occurred.

## Confirmed issues and changes

1. `src/shared/services/tokenomics/tokenDex.reader.js` requested a router quote
   before resolving and reading the pair. The router rejects quotes when either
   reserve is zero. Now pair/reserve reads precede the quote; absent, unreadable,
   mismatched or empty pairs do not trigger that call. A funded pair is checked
   again on the next normal refresh, with no permanent suppression/cache flag.
   A quote that reverts after a successful reserve read remains unavailable.
   This matches the reserve precondition in
   [Uniswap V2's library](https://github.com/Uniswap/v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol).

2. The same reader caught every multicall failure, then tried individual fields
   and logged every failure. It now stops that snapshot on transport/rate-limit
   failures, returning a sanitized error to the polling hook instead of issuing
   a new series of field reads. Optional contract reverts/empty ABI responses can
   still fall back to individual reads. Existing RPC-provider retries remain
   unchanged; this does not repair an external provider outage.

3. The local ABI check treated ethers `Interface.getFunction()` returning null
   as success. It now excludes those methods. Optional absent methods remain
   null. Token decimals preserve a real zero; unavailable decimals are an error
   instead of an invented value of 18. The feed address uses ethers v6 `target`.

4. `src/hooks/tokenomics/useTokenDexSnapshot.js` now also reads positional reserve
   tuple fields. An empty side cannot become a displayed market price of zero.
   `src/shared/services/tokenomics/tokenDex.mappers.js` preserves actual zero
   reserves, distinguishes `No liquidity` from `Unavailable`, and leaves prices
   unavailable for an empty pair. Healthy-market thresholds are unchanged.

5. `src/features/tokenomics/tabs/TokenDexTab.jsx` displays a refresh-failure
   notice when a previous successful snapshot is retained. Existing polling
   already preserves that snapshot on rejection; no retry interval or cache
   policy was changed. Initial failure still uses the existing error state.

These are read-flow and financial-display corrections, not changes to trading
rules, liquidity funding, NFT prices, mint/redeem/VRF, reward eligibility,
permissions or financial transfers. No transaction retries were introduced.
The raw snapshot additionally exposes `dex.quoteStatus`.

## MetaMask and archive RPC

The supplied MetaMask stack does not identify an application caller. The exact
session-restoration message was not found in application sources. The current
Web3 provider's initial disconnected path does not request wallet accounts;
its reconnect/account-selection tests passed. No speculative wallet-provider
rewrite or global rejection/console suppression was added.

The user's extension runtime has NOT been reproduced or repaired. Check that
MetaMask is enabled for the browser profile/site, then reload the affected tab
and reconnect explicitly. MetaMask's
[provider documentation](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/)
also documents reloading to re-establish a disconnected provider. This is not a
recommendation to reinstall the wallet, reset accounts or disclose recovery
phrases. If the error persists, inspect the actual extension/script origin and
enabled-wallet conflict before changing connection logic.

DRIP emits its archive notice once when historical-log providers are unavailable.
This path retains cached event totals, if present, and uses separate live reads.
No archive endpoint was invented or configured, and this limitation was not
hidden. It does not by itself prove whether any automation transaction succeeds.

## Verification

| Check / command | Status | Result |
| --- | --- | --- |
| Focused Vitest: `tokenDexReadFailures.test.jsx`, `ecosystemMainnetMappers.test.js`, `pollingSnapshotConsistency.test.jsx`, `Web3Provider.reconnect.test.jsx`, `injectedAccountSelection.test.js`, `rpcErrors.test.js`; `--maxWorkers=1 --reporter=dot` | PASS | 6 files, 45 tests, 56.77s. Includes 16 new reader/hook/UI regression cases. |
| ESLint API `fix:false`, `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])` | PASS | 490 files, 0 errors, 0 warnings. Rules unchanged. |
| `npm run typecheck` | PASS | Configured TS/TSX scope; not a full JSX type audit. |
| Reviewed release helper, fixed in memory to stage `build`, receipt `tmp-dex-build.json` | PASS | Production-configured Vite build, generated security headers and built-output known-credential check. Netlify configuration read only, no deployment. |
| Build preflight `scripts/check-rpc-health.mjs` | PASS | Four independent endpoints, chain 137, fresh blocks 93739157-93739159; minimum two healthy hosts required. Point-in-time check only. |
| `node scripts/smoke-token-dex.mjs` | PASS | Offline fixtures, actual panel/CSS, widths 1440/768/390/320; empty, stale and recovered states, no document overflow/page errors. External HTTP requests blocked. Screenshots inspected. |
| Playwright against local production build `/app/`, Ecosystem -> TOKEN / DEX | PASS | Real mainnet read data showed zero pair reserves and `No liquidity`. Another 22 seconds observed after readiness: zero `getAmountsOut` calls, zero old TokenDex helper warnings and zero uncaught page errors. |
| `npm run security:secrets` | PASS | Pattern scan of tracked/pending files. Not a complete credential/security audit. |
| `git diff --check` | PASS | Existing LiveStats CRLF normalization notice only. |
| Full Vitest suite | SKIPPED | This pass uses the targeted suite above. The preceding startup pass's full-suite result and isolated Live Chat timing failure remain documented separately. |
| Real wallet/transaction tests | SKIPPED | No signatures, approvals, swaps, liquidity deposits, mints or claims. No real MetaMask extension available in automated Chromium. |
| Netlify deployment / Git publication | SKIPPED | Changes are local only. |

Build entry: `/assets/app-CiN0SgLF.js`.
Built: `2026-09-13T15:37:55.467Z`.
Artifact SHA-256: `75c98cef387a7e04fdd95064285b87a98faf3b27dc6d08725b6d5668212ab020`.
Base commit: `a092e489e8dffd573fe656da007153a1d0524210` plus existing dirty work;
the commit alone does not reproduce this artifact.

Local preview: http://127.0.0.1:5181/app/ . The existing preview remains running.
Build receipts and screenshots are ignored local artifacts. No runtime speed-up,
continuous endpoint availability or formal smart-contract security is claimed.
