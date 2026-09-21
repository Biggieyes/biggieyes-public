# CORE VRF Recovery V2

Status: local implementation, NOT deployed. Existing production addresses and V1 sources are unchanged.
`BiggiEyesMainV2` is the new version of the VRF collection, NOT `BiggiEyesMain2` (the public collection).

## Confirmed V1 failure

The September 18, 2026 audit reproduced an exhausted 300,000-gas callback on a Polygon
fork at block 94,041,102 after nine occupied consecutive NFT indices. Ticket redemption
had succeeded before the callback, so the burned ticket and pending request persisted.
The previous recovery requests new randomness or allows owner-selected emergency minting.
Those are not equivalent to completing the original draw.

## V2 behavior

- A sealed, complete and reward-consistent 550-entry metadata matrix is required before redeem.
- Pending requests count against supply. One wallet cannot open two concurrent requests in one collection.
- The router stores the verified word permanently, including zero, before external calls.
- Selection preserves V1's `word % 550 + 1`, then first available index with circular wrap.
  Three availability bitmaps replace the full NFT-struct scan; selection reads at most four words.
- The collection reserves the index in one call. The router then attempts minting in a separate,
  gas-bounded call. Failure of ERC721 receipt, revert-data expansion or mint execution does not
  undo the router's word or a successfully reserved index.
- `deliverRandomness(requestId)` is permissionless. It reuses the saved target and word.
  `completePendingMint(requestId)` is also permissionless, always minting to the original requester.
- Compatibility methods `retryPendingMint()` and `ownerRetryPendingMint(user)` complete the original
  request. They do not call Chainlink again. `pendingRetryDelay()` is zero. There is no delay setter.
- `emergencyResolvePendingMint(user, 0)` may only complete verified randomness.
  Any nonzero preferred index is rejected. An owner cannot manufacture randomness.
- Requests/assignments are idempotent. Duplicate or unknown oracle delivery cannot create another NFT.
- Pausing stops new redeems but does not prevent completion of already accepted requests.
- Routing (router, TicketHub, chapter) is locked after the first accepted request. Compute and
  administrative price changes are blocked while requests are pending.

The default callback limit is 750,000. Configuration allows 300,000 to 2,500,000 on Polygon,
3 to 200 confirmations and exactly one word. A lower budget may defer mint completion while
retaining the result. Gas reserves are not a substitute for testing the actual consumer.

## Preserved Economics and Interfaces

NFT IDs, metadata matrix, IPFS path construction, background-to-same-color price increases,
integer rounding, ticket price snapshots, final-price calculation, block/background counters,
character completion rewards and collection eligibility predicates are unchanged.

Prices and character rewards are applied on successful mint completion, not reservation.
If a receiver delays completion, subsequent completed mints can affect its eventual price snapshot,
as with other delayed fulfillment. Its reserved NFT cannot be taken by another request.
The existing first-free selection rule remains order-dependent and is not a uniform draw over the
remaining NFTs. This patch does not silently change that business rule.

The frontend claim payload also had a confirmed ID/index mix-up: NFT token ID 1001 was sent as 1.
Both frontend copies now retain the actual ERC721 token ID; an index is used only to validate its
range. New tests first reproduced the wrong IDs and deduplication, then verify the correction.
This changes claim inputs, not reward amounts, eligibility rules or tokenomics.

`VRFFulfillStarted` and `NFTMinted` are emitted in the same successful completion transaction,
including later recovery. The existing frontend correlates these events by transaction hash.
`RandomFulfilled` only proves storage of randomness; it does NOT prove NFT ownership.

## Limits and External Dependencies

- There is no absolute guarantee against oracle downtime, an unfunded subscription, chain outages
  or a callback that receives insufficient gas even to save its word. No new word is fabricated.
- A contract wallet that permanently rejects ERC721 receipt still cannot receive the NFT.
  The reservation remains. V2 does not add an owner-controlled redirect or unsafe `_mint` fallback.
- This router is for CORE V2 collections only. NFT mystery rewards remain on their existing router;
  their recovery logic is NOT fixed by this change. `BiggiNFTRewardsV2.vrfRouter` is immutable.
- Tests here are engineering regression checks, not an independent formal security audit.
- EVM mocks/fork impersonation do not verify real oracle proofs, DON liveness or Chainlink billing.

## Safe Local Verification

Run from `biggi-project/bekend`. `hardhat.vrf-recovery.cjs` loads no dotenv or private keys and
configures no remote writable network. The explicit `hardhat` network is mandatory.

```powershell
node node_modules/hardhat/internal/cli/cli.js compile --config hardhat.vrf-recovery.cjs --network hardhat
node node_modules/hardhat/internal/cli/cli.js test --config hardhat.vrf-recovery.cjs --network hardhat test/master/vrf-recovery-v2.test.js
node node_modules/hardhat/internal/cli/cli.js test --config hardhat.vrf-recovery.cjs --network hardhat
```

The existing mock's unbounded `fulfill` remains for legacy unit tests. New regressions use
`fulfillGasLimited`, which forwards the configured gas limit and permits one coordinator attempt.

An optional historical migration rehearsal reads Polygon but signs only against the local EVM:

```powershell
$env:VRF_RECOVERY_FORK_URL = 'https://polygon.drpc.org'
$env:VRF_RECOVERY_FORK_BLOCK = '94041102'
node node_modules/hardhat/internal/cli/cli.js test --no-compile --config hardhat.vrf-recovery.cjs --network hardhat test/master/vrf-recovery-v2.fork.test.js
Remove-Item Env:VRF_RECOVERY_FORK_URL
Remove-Item Env:VRF_RECOVERY_FORK_BLOCK
```

The original fork test copies all 550 actual on-chain metadata rows and URI/price settings, preserves
TicketHub and its existing ticket, updates local registry/controller bindings, registers the
new local consumer and exercises ticket #3 -> NFT #1001. It is not a full production migration
script and does not migrate reward funding or immutable readers.

The additional `test/master/vrf-recovery-v2-migration.fork.test.js` rehearses all five chapters.
It uses bounded, read-only historical Multicall requests for metadata, checks the chain and block
hash against the fork, and deploys/signs exclusively on the local Hardhat provider. It never loads
an owner key or changes address manifests. Run it with the same explicit fork variables/config:

```powershell
node node_modules/hardhat/internal/cli/cli.js test --no-compile --config hardhat.vrf-recovery.cjs --network hardhat test/master/vrf-recovery-v2-migration.fork.test.js
```

Chapters 2-5 have no historical VRF metadata (`background = 0`, `blockIdx = 0`, `mainId = 0`) for
all 550 rows. Originals/chapter 1 is the only chapter with a copyable metadata matrix at the tested
historical block. Future chapter layouts are intentionally deferred in
`metadata/main/core-v2-seed-plan.json` until their images, traits and game layout are explicitly
defined and approved; they must never be described as copied historical data.

The local candidate layout file `biggi-project/bekend/metadata/main/main-layout.json` contains 550
valid rows with the expected 100/90/80/70/60/50/40/30/20/10 block distribution. Its exact SHA-256
is pinned only so rehearsals remain reproducible. It is not approved content for Chapters 2-5.
The migration refuses a future chapter unless its seed-plan entry is explicitly changed to
`approved-layout-seed`, `broadcastAuthorized` is set to true and the separate execution confirmation
is supplied. The rehearsal still rejects partially populated metadata, a changed file hash or
malformed rows.

The test restores a local EVM snapshot between cases. Synthetic oracle delivery, local activation,
test wallet balances and local budget deposits are not transactions on Polygon. A characterization
test that reproduces an existing defect is evidence of that defect, NOT a production readiness pass.

## Production Migration Gates (Separate Approval Required)

1. Keep the affected chapters inactive. Re-read current mainnet state, all chapter addresses,
   subscription balance/configuration and ownership. The historical snapshot is not current proof.
2. Prove zero minted NFTs and zero pending requests for EVERY collection being replaced.
   Reconcile historical request/fulfillment logs and subscription commitments, not just one wallet.
   If any are present, STOP: this zero-state migration cannot carry their ownership or pending state.
3. Snapshot exact metadata rows, IPFS/contract URIs, prices, chapter IDs, ticket caps, owners,
   existing reward liabilities and budgets. Tickets already sold stay on the SAME TicketHub.
   For chapters 2-5, require all rows to be completely unset and seed only the hash-pinned approved
   layout. STOP on partial data, a hash mismatch or any inconsistency; copying zero rows is invalid.
4. Deploy/verify new CORE router and per-chapter Main V2 contracts only for chapters with a proven
   metadata matrix. Copy metadata exactly, compare every row, seal it, copy prices/URIs, verify
   compute and chapter IDs before wiring.
5. Register the new router with the actual subscription owner. Retain old consumers until all
   old commitments and mystery-reward dependencies are resolved. Do not replace the immutable
   NFT rewards router accidentally or revoke its permission.
6. With chapters still inactive: update TicketHub's chapter main first, then bind each Main's hub,
   update the series registry, approve each new Main on the V2 router, and check ChapterController
   stack/cap consistency. Public collection addresses and caps must remain unchanged.
7. Audit all downstream consumers of the old Main addresses. `BiggiMainReader` contains immutable
   Main/Hub/rewards addresses and needs a replacement. Check default Main/funding collection in
   CollectionRewards, per-collection budgets and claims, token rewards, moderator allowlists,
   distributor weights, other readers, backend indexing and automation. Never reset budgets or claims
   merely by changing an address. Reconcile any old-address balance before switching funding.
8. Generate version-specific ABIs and update canonical address maps, Netlify environment, readers,
   indexers and frontend together. Adapt admin tooling to remove arbitrary index selection and the
   retry delay setter. Frontend recovery wording must distinguish waiting for randomness from
   completing a saved draw. Preserve NFTMinted receipt confirmation and wallet/network guards.
9. Repeat the entire migration on a fresh fork, including reward/readers wiring, then review the
   transaction plan and obtain approval. Existing `redeployCoreMainOnly.js` deploys V1 and does NOT
   perform these V2 checks; do not run it as the V2 migration.
10. Only after verification, funded subscription and smoke checks: explicitly approve chapter
    activation and one real ticket redeem. Monitor both saved randomness and final NFT ownership.

Changing only Netlify or only callbackGasLimit cannot upgrade the immutable deployed Main.

### Resumable Polygon Tooling

The production migration tools default to read-only preflight and never activate a chapter:

```powershell
cd biggi-project/bekend
npm run prepare:core-v2-migration:polygon
npm run stage:core-v2-chapters-1-2:polygon
npm run migrate:core-v2:polygon
npm run resume:core-v2-migration:polygon

npm run prepare:distributor-v2-migration:polygon
npm run migrate:distributor-v2:polygon
npm run resume:distributor-v2-migration:polygon
npm run verify:core-v2-migration:polygon
```

Execution additionally requires the exact confirmation values printed by the scripts. The CORE
tool requires a separate confirmation for using the hash-pinned chapter 2-5 seed. Both tools save
the transaction hash before waiting for its receipt and refuse to resend an unresolved transaction.
Their resume files and reports are intentionally separate from canonical address books.
Read-only CORE checks write `reports/core-v2-preflight-polygon.json`; they never overwrite the
resumable execution report at `reports/core-v2-migration-polygon.json`.

Both execution scripts also load `metadata/main/core-v2-gas-baseline.json`. That baseline records
the successful five-case fork rehearsal at Polygon block 94,082,827. The original fork CORE total
was 205,911,019 gas and
the distributor migration used 3,661,046 gas. The scripts split the remaining baseline gas by the
actual deployer/owner roles, subtract receipts already recorded during a resume, price the remainder
using the current base fee plus the configured priority fee, and require a 25% safety margin by
default. A failed financial gate sends no transaction. `maxFeePerGas` is only the EIP-1559 ceiling;
it is reported separately and is not presented as the expected final cost.

The first Polygon stage showed that `sealMetadata` has a materially different mainnet estimate from
the local-fork receipt: 16,548,157 versus 7,169,978 gas. The first fixed 9,000,000-gas attempt
exhausted its complete limit without changing state; all 550 rows and the reward matrix remained
valid and unsealed. Production sealing now uses live `eth_estimateGas` plus a 20% margin and refuses
a limit at or above the current block capacity. The conservative CORE baseline therefore replaces
all five fork seal measurements with the mainnet estimate, resulting in 252,801,914 gas for CORE
and 256,462,960 gas for CORE plus distributor. A failed pending receipt is resumable only when its
label is `sealMetadata` and receipt gas exactly equals the submitted limit; other failures remain
fail-closed.

The optional `stage:core-v2-chapters-1-2:polygon` command is a deliberately bounded first phase for
an underfunded owner wallet. It deploys the new router and five Main instances, configures and seals
only chapters 1-2, writes a resumable checkpoint, and exits before final metadata verification,
VRF subscription registration, registry changes, reward-budget changes or any TicketHub/public
collection cutover. It still requires both explicit CORE/seed confirmations. Continue later with
the normal full resume command after the owner wallet passes the remaining-gas financial gate.

Required order is: successful fresh-fork rehearsal, current-state CORE preflight, CORE execution,
CORE post-checks, distributor preflight, distributor execution and post-checks, contract source
verification, then one coordinated address/ABI/frontend cutover. The old VRF router remains a
subscription consumer. Paid mint, redeem and chapter activation stay disabled throughout this
sequence. Activation and one real-ticket smoke test require a separate reviewed action.

## Redeployment Inventory

For adopting CORE V2 across all five chapters after valid metadata exists, the planned minimum is
**seven new contract instances**:

| Instance | Count | Why |
| --- | ---: | --- |
| BiggiEyesMainV2 | 5 | Originals, Universe, Mutant, Apocalipse, Super Hero need the new reservation/recovery code |
| BiggiVRFRouterV2 | 1 | Permanent randomness storage and bounded, replayable delivery for those five collections |
| BiggiMainReader | 1 | Its `main` address is immutable; MAIN_READER and READER are aliases of the same current instance |

Existing linked BiggiNamesLib and Compute can be reused after bytecode/ownership verification.
This is not seven new versions of every financial module and is not yet an executable migration
approval. The metadata selection for chapters 2-5 is now hash-pinned and passes the complete fork
rehearsal; the contracts are still not deployed and the plan remains subject to current-state
preflight plus explicit transaction approval.

If the same cutover must also satisfy automatic per-chapter reward-budget funding, the practical
minimum becomes **nine new instances**: the seven above, one collection-aware distributor that sends
the CollectionRewards share through `fundCollectionBudget(collection)`, and one replacement
MultiCollectionDistributorReader because its distributor address is immutable. The existing
CollectionRewards contract already exposes the required collection-aware payable entry point and
does not need replacement for this specific fix. The replacement distributor now uses strict
chapter attribution, calls `fundCollectionBudget(vrfCollection)`, and preserves failed reward
forwarding per target collection. Its unit and full Polygon fork rehearsals pass.

**Keep, but rewire/check:**

- TicketHub: keep its address, existing ticket IDs, holders, prices, token URIs and OpenSea listings.
  Change the five `chapterMainCollection` bindings, without activating chapters mid-migration.
- SeriesRegistry: change the five VRF collection entries, retain public collections and TicketHub.
- ChapterController and ChapterSeriesReader: keep their addresses; validate registry-driven stack/caps.
- Five public collections (`BiggiEyesMain2`): keep; verify controller-driven price resolution and
  update any explicit `priceProvider` fallback pointing to an old Main.
- CollectionRewards: keep; set default Main and funding collection, configure the five new budgets.
  Never assume an old-address budget follows a new address automatically.
- MultiCollectionDistributor and its reader: a VRF-only migration could keep them, but both the
  registry and explicit `collections` whitelist must be checked. Registry membership does not grant
  permission to send mint revenue. The deployed distributor at the tested block is older than the
  repository source: `supportsChapterMintShare()` reverts. TicketHub therefore falls back to legacy
  `receiveMintShare()`. Because one TicketHub address is registered for all chapters, registry lookup
  returns `chapterByCollection(TicketHub) = 0`; a chapter-2 ticket mint increases the distributor's
  Hub/source total but no chapter counter. CollectionRewards then independently credits its single
  `fundingCollection` (chapter 1), because `receiveMintShare()` carries no chapter or collection ID.
The replacement source fixes this path, but a mainnet deployment and coordinated receiver/hub
  cutover are still required before promising automatic per-chapter budget funding.
- Token Rewards and its reader: can stay through the existing registry/multicollection API.
  `mainNFT()` remains the OLD immutable legacy default; it cannot be relabeled as the new collection.
  New NFTs must use `claimWithCollections`, `claimablePreviewFor` and collection-aware claim history.
  The frontend already selects that path when the asset's collection differs from `mainNFT()`;
  canonical address maps must be switched together. Audit every remaining legacy-only caller.
- NFT Rewards: keep the mystery rewards router/dependency separate. The deployed V2 NFT Rewards
  contract has an immutable `vrfRouter` and no CORE main-collection setter; it must not be pointed
  to the CORE-only router.
- BIGGI token, Treasury, Reserve, buyback, drip, liquidity, SupplyController/Guardian, Moderator and
  Community: no redeploy is required solely by this CORE replacement. Verify existing dependencies
  and allowlists; the preserved TicketHub avoids invalidating Moderator V2's immutable hub binding.
- MultiCollectionDistributor cannot be treated as already chapter-aware merely because the current
  source tree contains that API. The deployed bytecode does not expose it at the tested block. Fixing
  ticket-income attribution therefore requires deploying a compatible distributor implementation,
  wiring all five recipients/registry/allowlists, updating TicketHub and recipient distributor
  permissions, and updating its reader if the reader has an immutable distributor address.
- Frontend/backend manifests, ABIs, env, event indexers, RPC caches and admin recovery tools need a
  coordinated update. Netlify needs a new application deployment AFTER address migration, not now.

### Distributor V2 Migration Tool

`scripts/master/migrateChapterAwareDistributorV2.js` is fail-closed and dry-run by default. It
checks chain ID 137, contract code, common ownership, inactive chapters, configured per-collection
budgets, exact old-distributor bindings, zero old pending amount and zero old distributor balance.
It derives all 11 allowed sources (five VRF collections, five public collections and the central
TicketHub) from the registry. The Polygon-fork dry-run passes without sending a transaction.

Execution additionally requires `--execute`, an owner signer and the exact
`CONFIRM_DISTRIBUTOR_V2_MIGRATION` confirmation value printed by the script. It deploys the
replacement distributor and immutable reader, configures them, rewires all five recipients, and
switches TicketHub last. It writes a report but intentionally does not modify canonical address
books; those changes belong to the reviewed combined CORE cutover.

### Application Cutover Requirements

- `src/app/AppCore.jsx` now distinguishes V1 retry from V2 completion. A V2 recovery receipt is
  accepted as complete only when the same transaction contains matching `VRFFulfillStarted` and
  `NFTMinted` events for the saved request, collection and wallet. It then clears the pending context
  and refreshes wallet assets/rewards instead of displaying another VRF wait.
- `src/features/vrf/VRFPanel.jsx` preserves the legacy V1 retry label. For V2 it reads the router's
  saved request result and exposes `Complete Pending` only when randomness is ready and the consumer
  matches the active collection. Otherwise it displays `Waiting for Chainlink` and disables the
  action. This frontend behavior must still be built and deployed together with the address cutover.
- `BiggiTokenRewardsReader.preview/previewFor` call a contract whose preview uses `msg.sender`.
  Calling through that reader changes the caller to the reader, not the NFT owner. Current frontend
  call sites use TokenRewards directly; preserve that path and do not introduce this reader wrapper
  for wallet-dependent previews during migration. Reader status/claim-week getters are separate.
- Keep the old mystery router address distinct from new CORE router aliases. A blanket replacement
  of every occurrence of `VRF_ROUTER` would break the separate NFT mystery reward interface.

**If replacing Token Rewards as well:** that is a separate, larger migration, not part of the
seven-instance minimum. Immutable dependencies include TokenRewardsReader, BiggiSupplyController,
SupplyControllerReader, BiggiSystemReader and BiggiTokenomikReader. Treasury, token reward targets,
emission controller, Guardian and automation would need rewiring too. Existing balances, mint caps,
claim history and budgets must not be reset. Avoid that cascade unless legacy-default replacement
is actually required.

### Public Read-Only Snapshot, September 19, 2026

- Polygon block **94,042,852**: all five chapter Main contracts report `biggiMinted = 0`, all five
  TicketHub chapters are inactive, all point to the current shared V1 router. Original chapter and
  chapters 2-5 have different runtime hashes; do not assume identical historical builds.
- Same block: Token Rewards uses the expected registry; its immutable Main and MainReader's immutable
  Main both point to old Originals. `rewardsMinted` and `totalDistributed` are zero.
- Polygon block **94,042,915**: CollectionRewards native balance is zero. All five old collection
  budgets are configured, funded = 0, spent = 0, claims disabled; fundingCollection is old Originals.
- These observations support the limited migration plan but DO NOT prove absence of all historical
  pending requests. Repeat reads and reconcile logs before any mainnet transaction.

## Verification Results

Local checks on September 18-19, 2026:

| Check | Result | Evidence |
| --- | --- | --- |
| Solidity compile, safe Hardhat config | PASS | Solidity 0.8.24, optimizer 200, viaIR; four new/changed files then two recompiled files |
| Backend master tests | PASS | Full run: 140 passed with six optional fork cases skipped; the subsequently added hash-pinned seed-plan test also passes independently |
| Explicit Polygon fork test at block 94,041,102 | PASS | One test passed in 17m; ticket #3 -> NFT #1001, all 550 metadata rows equal, chapter/controller bindings verified; synthetic callback receipt 300,005 gas including intrinsic cost and refunds |
| Five-chapter approved-seed fork rehearsal at block 94,041,102 | PASS | 5/5 cases passed: hash-pinned 2,750 rows, ticket/cap/price/reader bindings, one redeem + VRF mint + BIGGI claim per chapter, isolated reward claims, reproduction of the deployed legacy defect, and replacement-distributor mint routing to the exact chapter-2 VRF budget |
| Fresh five-chapter migration rehearsal at block 94,082,827 | PASS | 5/5 cases passed in 40m; CORE migration used 205,911,019 gas and distributor migration 3,661,046 gas; stderr was empty |
| Polygon staged deployment at block 94,086,326 | PASS (staged) | Router V2 and five Main V2 contracts deployed; chapters 1-2 configured and sealed; all old Hub/registry bindings retained, chapters inactive, new router not registered as consumer |
| Polygonscan source verification | PASS | Router V2 and all five Main V2 contracts verified; MainReader/distributor/reader are not deployed yet |
| Runtime bytecode verification | PASS | Six deployed runtimes match current compiler artifacts after normalizing only compiler-declared link/immutable slots; all Main V2 links resolve to the canonical BiggiNamesLib |
| Staged checkpoint snapshot | PASS | 43 successful receipts, one recorded seal OOG receipt, no pending transaction; SHA-256 `072ad458974ae718b78f7e37431dbcebf5759e771c7457721038a3651f788788` |
| Current backend master tests | PASS | 142 passing; six explicit fork-only cases pending |
| Current frontend Vitest run | PASS | 102 files and 684 tests passed |
| Current lint/type/ABI/contract checks | PASS | ESLint, custom typecheck, 490-file ABI audit and both frontend address/ABI maps passed |
| Current production build and secret scan | PASS | Vite production build completed; CSP header generated; no credential-like values found; no Netlify deployment |
| Distributor V2 migration dry-run at block 94,041,102 | PASS | All owners, inactive chapters, configured budgets, zero pending/balance and 11 registry-derived sources validated; no transaction sent |
| Exhaustive V2 mint cases | PASS | Two full 550-NFT runs; peak gross callback-call measurements 313,299 and 335,199 gas, limit 750,000 |
| Targeted frontend VRF/write tests | PASS | 57 tests in six files |
| V2 receipt/readiness frontend regression tests | PASS | 51 tests in `pendingVrf`, app write lifecycle and reward token identity suites; V2 completion receipt is correlated by collection, request and wallet |
| New claim-ID regression before fix | FAIL (expected) | Three failures reproduce ID 1001 -> 1 and incorrect deduplication |
| Full frontend `vitest run --maxWorkers=2` after fix | PASS | 101 files and 681 tests passed; the previously observed LiveChat timeout did not recur |
| Isolated rerun `vitest run __tests__/rewardTokenIdentity.test.js __tests__/liveChatFunctions.test.js --maxWorkers=1` | PASS | All eight tests, including the previously timed-out LiveChat case |
| ESLint on src | PASS | No errors/warnings emitted |
| `node scripts/typecheck.mjs` | PASS | Exit 0 |
| `node scripts/check-contracts.js` | PASS | Both frontend address maps, five chapters and eight CORE ABIs agree |
| `node scripts/check-abis.js` | PASS | 489 source files, 61 ABI files; no missing methods in this heuristic check |
| `npm.cmd run build` | PASS | Vite production build and CSP header generation; no deployment |

The local audit report was moved from root-level `tmp-vrf-audit-20260918.md` to
`tmp/vrf-audit-20260918.md` so the documentation glob does not bundle it. A clean rebuild
confirmed it is no longer an emitted asset. Generated compiler-cache changes were removed from
tracked files; the dedicated test config now uses an ignored local cache.

The approved seed plan deliberately distinguishes the historical Originals copy from newly seeded
chapters 2-5. The complete five-chapter flow and strict replacement distributor work on the pinned
Polygon fork. Remaining work is deployment preflight, transaction review, mainnet deployment and
coordinated address/ABI/frontend cutover; no production transaction was sent by these tests.

References:
- [Chainlink VRF security](https://docs.chain.link/vrf/v2-5/security)
- [Polygon VRF configuration](https://docs.chain.link/vrf/v2-5/supported-networks#polygon-mainnet)
