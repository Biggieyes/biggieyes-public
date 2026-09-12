# NFT Rewards V2 migration - 2026-09-09

## Deployment

Polygon mainnet, chain ID `137`. Owner remains
`0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`.

| Component | Address | Source verification |
| --- | --- | --- |
| BiggiNFTRewardsV2 | `0xd1cefDf3b4ce4c174291F8eB0729980c50D293b9` | [Polygonscan](https://polygonscan.com/address/0xd1cefDf3b4ce4c174291F8eB0729980c50D293b9#code) |
| BiggiNftRewardsReader | `0x789873e6b1d944b207D2E76a71D95135be4e33c6` | [Polygonscan](https://polygonscan.com/address/0x789873e6b1d944b207D2E76a71D95135be4e33c6#code) |

V2 is approved on the existing VRF router. MasterConfig's NFT rewards slot now
points to V2; the other three reward bundle addresses were preserved exactly.
Total gas for both deployments and both configuration transactions:
`0.987334531510184071 POL`.

Transaction hashes, block numbers and fees are recorded in
[`nft-rewards-v2-consistency-polygon.json`](../biggi-project/bekend/reports/nft-rewards-v2-consistency-polygon.json).
Deployment and migration preconditions are recorded in
[`nft-rewards-v2-deployment-polygon.json`](../biggi-project/bekend/reports/nft-rewards-v2-deployment-polygon.json).

The initial approval attempt was rejected before broadcast because its priority
fee was below the RPC minimum. The already-deployed contracts were reused;
`completeNftRewardsV2.js` completed approval without deploying duplicates.
Both contracts are verified on Polygonscan. Sourcify verification was not completed.

## Migration Safety

- V1 had no events, reward records or POL balance. No reward inventory needed moving.
- Mainnet consistency check passed after retirement at block `93478314`: owner, immutable router,
  reader target/status, VRF approval, MasterConfig, counters and transaction receipts.
- No game contract, NFT trait, metadata URI, block-price rule, collection reward,
  weekly token reward or liquidity parameter was changed.
- No mainnet reward event was created and no real NFT was claimed for testing.
- V1 VRF approval was revoked after the public V2 frontend passed verification.
  V2 remains approved. Retirement transaction:
  [Polygonscan receipt](https://polygonscan.com/tx/0x28115b8e0516aeae24df6eff0fd92c11f50bff473202b298041b9562c62be96f).
  Confirmed at block `93478300`; fee `0.01086086010728082 POL`.

## Frontend

- Canonical addresses, local environment overrides and the NFT Rewards ABI now use V2.
- User panel retains its layout, pagination, wallet-assignment filters and guarded
  claim flow. Contract details show V2, its reader, immutable router and ownership.
- Removed calls to absent V1 `mainContract` and `registry` getters.
- Admin NFT tab is now available without missing AppCore action callbacks. It
  directly supports manual assignment, mystery creation, draw request, delayed
  retry and retry-delay settings.
- Removed obsolete main/router setters. Owner and network checks run again
  before signing; failed gas estimates abort the operation. Duplicate clicks,
  zero recipients, invalid IDs and excessive reward-to-recipient counts are blocked.
- Metadata URIs are split only by line, preserving embedded commas. Eligible
  addresses are normalized and deduplicated before submission.
- Backend wiring/check scripts detect V1 versus V2 instead of sending legacy
  collection/registry setters to V2. Legacy deployments remain supported.
- Updated the current contract records and English/Czech CORE whitepapers.
  Historical audit/deployment snapshots retain their original V1 evidence.

## Verification

- Frontend: 50 targeted tests passed across 7 suites covering NFT service,
  claim panel, pagination, admin actions/access and both parent panels.
- Hardhat: 10 tests passed, including assignment/claim, duplicate claim rejection,
  unique VRF winners, stale/reused request IDs, ownership and version detection.
- Typecheck passed. ABI audit found no missing methods (heuristic check).
- ESLint: no errors; existing unrelated RewardsPanel unused-variable warnings remain.
- Production build passed; CSP headers generated. Built application entry:
  `/assets/app-DNlKCYy0.js` (rebuilt with the Netlify production environment).
- Local production preview: user and actual AdminPanel NFT tab checked at
  1440, 768, 390 and 320 px. No horizontal overflow or uncaught JavaScript errors.
  Admin visual test uses an unsigned owner-address stub, real read-only RPC data
  and blocks all signing/transaction requests.
- Build credential scan passed for 98 textual output files. V2 ABI matches the
  canonical Solidity ABI in both source registries.
- A missing local `caniuse-lite` file was restored from the exact locked npm
  archive after verifying its SHA-512 integrity; dependency versions were not changed for this repair.
  Babel JSX transformation passes. The standalone dev-server visual harness
  timed out during cold startup; browser layout verification above used the
  actual production bundle instead. The temporary dev server was stopped.

## Publication Status

**Blockchain migration and Netlify publication are complete; legacy V1 approval is revoked.**

Netlify site `biggieyescom`, domain `biggieyes.com`, publishes deployment
`6aa0ca18a06d42d1aaafcda8` since `2026-09-09T02:53:39Z`.
The previous deployment was `6aa09dcf7a272120ec966e0c`.
There are no NFT Rewards overrides in site, account or legacy build environment
settings; the production build uses the updated source addresses. No remote
environment values were changed.

The public homepage and app return HTTP 200. The public NFT panel was verified
at 1440, 768, 390 and 320 px with the correct V2/reader addresses and no uncaught
JavaScript errors or horizontal overflow. All four configured RPC endpoints
passed the Polygon chain-137 freshness check before publication.
Machine-readable release evidence: [publication report](nft-rewards-v2-publication.json).

Preview: `http://127.0.0.1:5181/app/`.

Operational Follow-Up:

1. Before an intentional production mystery event, confirm VRF subscription
   funding and callback gas for the intended event size. Local mock-coordinator
   tests do not prove DON delivery or callback-gas sufficiency for arbitrary sizes.
2. Do not rerun the initial deployment or republish a frontend that points to V1.
   The retirement script records and checks the V1=false/V2=true approval state.

Read-only recheck from `biggi-project/bekend`:

```powershell
node scripts/master/checkNftRewardsV2.js
```
