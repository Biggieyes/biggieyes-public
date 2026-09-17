# NFT card consistency follow-up - 2026-09-13

Continuation of the [LiveStats follow-up](livestats-consistency-2026-09-13.md)
and [JS/React/blockchain audit](javascript-react-blockchain-audit-2026-09-11.md).
Starting commit: `a092e48`. All pre-existing gallery, navigation, LiveStats,
smoke-test and report changes were preserved.

This step changes `src/components/NftCard.jsx` and `NftCard.css`, adds
`__tests__/nftCardLifecycle.test.jsx`, `scripts/smoke-nft-cards.mjs` and records
the results here. Temporary
diagnostics, screenshots and local build output are ignored by Git.
No deployment, commit/push, dependency installation, environment edits, wallet
signing, approvals, ABI/address changes or contract transactions were performed.
Neither NFT metadata files/tokenURI nor image assets were edited. Card markup is
unchanged; the internal keyed component adds no DOM wrapper. A narrow-card CSS
rule was added after screenshots exposed unreadable mobile price columns.

## Conclusion

The active NFT card contained reproducible presentation and read-lifecycle bugs:
late image replies, incorrect collection fallback, incomplete price extraction,
invented zero prices/rarity and incorrect background-index fallback. These are
locally repaired. This is not a formal smart-contract security audit or a proof
that every production dependency is available.

The existing image gateway fallback remains bounded and preserves the exact IPFS
filename. Existing collection/asset identity helpers and ethers 6.17.0 are used;
no new library or architecture migration is required.

## Confirmed findings and fixes

All findings are P2, high confidence, reproduced with controlled component tests.
Line numbers below refer to the locally repaired `src/components/NftCard.jsx`.

### NC01: Late image/metadata responses

- Location: `fetchMetadata`, lines 584-720.
- A cancellation check preceded `await resolveImageUrl`, but the later image
  assignment was unguarded. Cleanup during `tokenURI` still started JSON loading.
- Impact: a slow earlier read could overwrite a newer parent image or provider
  result, and unnecessary HTTP work continued after unmount.
- Fix: check cancellation after each await, do not mark cancelled refreshes
  complete, and reset loading for new effect runs. Keep a usable metadata image
  while preferred-gateway resolution is pending.
- Behavior/data-flow change: stale results are discarded; valid current images
  can appear sooner. No transaction or metadata mutation.
- Tests: delayed URI, JSON and image resolution; unmount; changed provider;
  changed direct image; StrictMode repeated setup/cleanup; failed read loading.

### NC02: Collection identity and fallback

- Location: `NftCard`/`NftCardContent`, lines 302-373; read effects.
- An explicit unknown address fell back to main/main2. Effect-level fallbacks
  repeated that mistake. State resets used only a numeric token ID.
- Impact: another collection's metadata or prices could be shown. Gallery already
  normally supplies composite keys, but the reusable card did not enforce this.
- Fix: accept only an address-matched collection; scope inner state to chain,
  contract, token and ticket/pending/NFT state. Legacy reader fallback is allowed
  only when no explicit contract is known, never for an unknown explicit address.
- Behavior/data-flow change: missing readers produce unknown data rather than
  another collection's result. Public props and DOM structure are unchanged.
- Tests: unknown address, exact main2 matching without lookup helper, equal IDs
  in different contracts, delayed old prices, reset of open details.

### NC03: Historical/current price confusion

- Location: mint input synchronization, lines 404-416; `fetchMintData`, lines
  722-810; `loadCurrentBlockPrice`, lines 839-951; derived prices, lines 974-986.
- Main `getMintData` used only the first of three return values. Missing block
  and final fields were fabricated from the current block price; historical
  block prices were also shown as current prices when current reads failed.
  Same-asset parent updates to `nft.mint` were ignored after initialization.
- Evidence: root BiggiMain/BiggiMain2 ABIs return three uint256 values. The local
  mainnet Solidity source `BiggiMain.sol:getMintData` returns ticketPrice,
  blockPrice and finalPrice. `tokenURI` uses the external token ID, while these
  historical reads use the normalized index. No ABI/source change was necessary.
- Fix: consume all historical fields, synchronize changed parent price inputs,
  and remove substitutions of current prices for historical ones and vice versa.
  Uppercase known block colors now resolve the same block index as title case.
- Behavior change: financial presentation only. Unknown current/final prices
  remain `--`; existing known parent/current fields still work. No economic
  percentage, price calculation, pricing contract or payment amount was changed.
- Tests: historical 500/100/105 versus current 150; current-only reader; updated
  parent mint values; delayed different-collection response; genuine zero prices.

### NC04: Invented zero traits

- Location: `fmtEtherNum` and `formatTraitPrice`, lines 217-242.
- `Number(null)` created `0.0000 POL` attributes, overwriting real metadata prices.
  Missing tuple fields and failed conversions could also become zero.
- Fix: keep unknown values null; preserve actual zero block/final prices. Existing
  formatted price attributes are left intact when no replacement value is known.
- Behavior change: display only; no alteration of source attributes or balances.
- Tests: metadata-only 500/100/105 prices, failed RPC, current-only contract,
  and confirmed zero block/final/current values.

### NC05: Incorrect inferred rarity and image block

- Location: `normalizeIndex`, line 37; `rarityTierFromBlockRank`, line 131;
  on-chain metadata fallback, lines 479-582.
- Missing rank became zero and therefore Legendary. Uninitialized nftInfo fields
  became Orange. Missing block URI triggered reads of neighboring block indices.
- Fix: validate known one-based block/background indices, leave unknown rarity
  unclassified and request only the exact block's base URI. The existing local
  image-path fallback retains its exact block/background filename.
- Behavior change: no invented classification or neighboring-block image URL.
  Existing known rarity tiers, mint rarity and background price rules are unchanged.
- Tests: unknown rarity, zero nftInfo, missing URI with nonempty neighboring URIs;
  existing IPFS gateway traversal and exhaustion tests remain green.

### NC06: Incomplete metadata and redundant ticket reads

- Location: metadata synchronization, lines 429-449; `fetchMetadata`; mint/current
  price guards, lines 725 and 844.
- Existing partial metadata discarded newly fetched fields; re-rendering with a
  new equivalent parent object dropped enriched fields again. `image_url` did not
  count as an existing image. Tickets/pending assets unnecessarily read NFT prices.
- Fix: merge missing fields while retaining supplied known traits, recognize
  `image_url`, and skip NFT metadata/mint/current-block reads for ticket/pending.
- Behavior/data-flow change: fewer redundant reads, stable enriched details.
  Ticket live-price and availability props are preserved. No burn/redeem/VRF change.
- Tests: partial attributes and repeated parent render, no mutation of supplied
  attributes, complete image_url fast path and both ticket/pending read guards.

### NC07: Unreadable prices in narrow cards

- Location: `src/components/NftCard.css`, `.nft-card` and the 250px container query.
- Runtime evidence: the existing 390px gallery fits two narrow cards, while each
  card still forces three price columns. `overflow-wrap: anywhere` prevented
  horizontal overflow but broke labels and amounts almost character by character.
- Fix: use the card as an inline-size container and stack price fields only when
  its content width is at most 250px. Wide cards retain their existing columns.
- Behavior change: layout only in narrow cards; colors, text sizes, controls,
  image paths, amount formatting and gallery column counts are unchanged.
- Verification: screenshot inspection plus a minimum readable text-width check
  in the new isolated Playwright smoke. Details and zoom/Escape are exercised.

## Verification

| Check / command | Result | Scope |
| --- | --- | --- |
| Initial `node node_modules/vitest/vitest.mjs run __tests__/nftCardLifecycle.test.jsx --maxWorkers=1 --reporter=json --outputFile=tmp-nft-red.json` | FAIL, expected | 15 failed / 1 passed before source fixes. A further partial-metadata rerender regression was also reproduced before repair. |
| `node node_modules/vitest/vitest.mjs run __tests__/nftCardLifecycle.test.jsx __tests__/nftCardGatewayFallback.test.jsx --maxWorkers=1` | PASS | 24 tests, including 22 new cases; mocked read-only contracts, no wallet signing. |
| `npm test` | PASS | 84 files, 486 tests, 60.20 s. Root Vitest suite, not backend/Jest coverage. |
| Final `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=tmp-nft-final-tests.json` | PASS | Repeated after final CSS/helper changes: 84 files, 486 passed, 0 failed, 0 pending; JSON success true, approximately 110.48 s through last result. |
| ESLint API `new ESLint({fix:false}).lintFiles(['src/**/*.{js,jsx,ts,tsx}'])` | PASS | 481 files, 0 errors, 115 warnings. Same scope as `npm run lint`, no fixes. Six existing warnings remain in NftCard; warnings are not claimed resolved. |
| `npm run typecheck` | PASS | Existing TS/TSX scope, checkJs false; does not typecheck all JSX. |
| `npm run build` | PASS | Final rebuild including the CSS fix: 4380 modules, 31.49 s, 9 CSP inline-script hashes; local dist only. |
| Initial isolated browser harness | FAIL | Startup stalled during broad Vite discovery; later missing jsx-dev-runtime export prevented mount. Fixed only the helper's discovery/watch/runtime setup. No application workaround. |
| `node scripts/smoke-nft-cards.mjs` | PASS | Chromium 1440/768/390/320px, four cards and four loaded local bitmap images each; zero page/card overflow, narrow-text failures or page errors. Details and zoom/Escape work. |
| `node scripts/smoke-runtime.mjs` | PASS | Rerun on the final CSS build: gallery navigation, LiveStats, Rewards claim-status and mobile shell. Disconnected wallet; outputs URL-redacted. |
| `node --check scripts/smoke-nft-cards.mjs` | PASS | New standalone smoke script parses. |
| `node scripts/check-secrets.mjs` | PASS | Tracked/pending source signature scan, not a complete production secret audit. |
| `git diff --check` | PASS | Only the pre-existing LiveStats CRLF normalization notice. |
| Wallet E2E, mainnet transactions, remote Netlify, backend/CRE deployment | SKIPPED | Outside this local presentation/read-lifecycle step. No external state changes. |

Local built entry: `/assets/app-DUQHfhEA.js`. Existing preview is
`http://127.0.0.1:5181/app/`; HTTP 200 and this exact entry were verified there.
The public Netlify deployment is unchanged.

The card smoke uses explicitly synthetic values and existing local image variants,
not a report of live NFT traits or prices. Contract/ImportNftButton modules are
stubbed, environment loading and filesystem watching disabled, and external HTTP
requests blocked. Screenshots are `tmp-nft-cards-{1440,768,390,320}.png` (ignored).
The temporary server/browser close in finally; the user's existing preview stays up.

## Remaining limits and next steps

- Request-count reduction is supported by removed read paths, not a measured
  percentage speedup. No new LCP, production throughput or load-test claim.
- Do not abort shared IPFS-cache requests from an individual card; component
  cancellation excludes stale results without disrupting other consumers. Existing
  shared service time budgets remain in force.
- Same-asset public metadata can survive wallet/provider changes; wallet ownership
  filtering remains the responsibility of Gallery/AppCore and was not rewritten.
- Local source/ABI inspection is not a fresh verification of deployed bytecode or
  availability of every contract. Existing mainnet-only configuration is unchanged.
- Continue with remaining audit findings in small regression-tested steps; do not
  mix claim/signing or financial automation changes into UI cleanup. Review this
  local batch before a separately requested deployment.
