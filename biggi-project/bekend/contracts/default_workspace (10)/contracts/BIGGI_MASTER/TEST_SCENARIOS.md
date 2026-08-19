# Biggi Protocol — End-to-End Test Scenarios

This document defines the recommended end-to-end test matrix for the refactored chapter architecture.

## Scope

Contracts covered:
- BiggiSeriesRegistry.sol
- BiggiChapterController.sol
- BiggiTicketHub.sol
- BiggiMain.sol
- BiggiMain2.sol
- BiggiMultiCollectionDistributor.sol
- BiggiTokenRewards.sol
- BiggiCollectionRewards.sol
- BiggiVrfRouter.sol

The goal is to validate the whole lifecycle:
- chapter registration
- ticket sale
- marketing tickets
- redeem flow
- VRF finalization
- block pricing propagation
- public collection unlock
- distributor accounting
- token rewards
- collection rewards

---

## Test Environment

Recommended actors:
- `owner`
- `alice`
- `bob`
- `marketingWallet`
- `keeper` / `vrfOperator`
- `treasury`
- `reserve`
- `buyback`
- `tokenRewardsFunding`

Recommended mocks:
- VRF router mock or test callback harness
- BIGGI ERC20 mock with mint ability
- reserve mock implementing `notifyBiggiReceived(uint256)`
- distributor destination mocks for split targets
- optional metadata-preload helper for `BiggiMain`

---

## Global Preconditions

Before running functional tests:

1. Deploy registry.
2. Deploy chapter controller and set registry.
3. Deploy distributor and set registry.
4. Deploy BiggiMain (VRF chapter collection).
5. Deploy BiggiMain2 (public chapter collection).
6. Deploy TicketHub and point it to BiggiMain.
7. Deploy rewards contracts and set registry.
8. Register chapter relationships in registry.
9. Configure chapter controller with chapter caps and collection addresses.
10. Configure BiggiMain with VRF router and ticketHub.
11. Configure BiggiMain2 with chapter controller.
12. Configure TicketHub with distributor, BIGGI token, reserve, sink, pricing.
13. Preload BiggiMain metadata/index slots before any redeem test.

---

# Scenario 1 — Registry / Chapter bootstrap

## Objective
Verify that system relationships are registered consistently.

## Steps
1. `owner` deploys `BiggiSeriesRegistry`.
2. `owner` creates a series.
3. `owner` creates a chapter under that series.
4. `owner` sets chapter collections:
   - VRF collection = `BiggiMain`
   - Public collection = `BiggiMain2`
   - TicketHub = `BiggiTicketHub`
5. `owner` configures `BiggiChapterController` for that chapter.

## Assertions
- Registry returns the correct series/chapter mapping.
- Registry resolves chapter by collection address.
- Controller validates chapter against registry without divergence.
- TokenRewards eligibility includes VRF + Public collection.
- CollectionRewards eligibility includes VRF only.

## Failure cases
- configuring a controller chapter with mismatched seriesId must revert
- configuring a controller chapter with collection addresses different from registry must revert

---

# Scenario 2 — Native ticket mint

## Objective
Validate standard ticket mint via native currency.

## Steps
1. `alice` calls `TicketHub.mintTicket()` with exact `ticketPrice`.
2. `alice` mints a second ticket.
3. Repeat until wallet limit threshold behavior is reached.

## Assertions
- ticket is minted to `alice`
- `ticketCount[alice]` increments
- `ticketMinted` increments
- `saleMinted` increments
- `mintedTicketPrice[ticketId]` equals price at mint time
- global `ticketPrice` increases after each sale mint
- distributor receives its mint share
- DEV wallet receives remaining share

## Failure cases
- mint below price must revert
- mint above wallet limit must revert
- mint past `saleCap` must revert
- mint when paused must revert

---

# Scenario 3 — BIGGI ticket mint

## Objective
Validate ticket mint paid in BIGGI.

## Steps
1. Mint BIGGI tokens to `bob`.
2. `bob` approves TicketHub.
3. `bob` calls `mintTicketWithBiggi()`.

## Assertions
- ticket minted to `bob`
- `mintedTicketPrice[ticketId]` stores ticket price snapshot
- BIGGI amount equals `_ethToBiggi(ticketPriceAtMint)`
- token sink receives the configured sink share
- reserve receives the remaining BIGGI share
- reserve hook is called if implemented

## Failure cases
- no BIGGI token configured must revert
- insufficient allowance must revert
- invalid reserve with forward amount > 0 must revert
- mint past sale cap must revert

---

# Scenario 4 — Marketing ticket distribution

## Objective
Validate owner-distributed marketing tickets.

## Steps
1. `owner` sets `saleCap` and `marketingCap` such that total equals 550.
2. `owner` calls `mintMarketingTicket(marketingWallet)` repeatedly.

## Assertions
- marketing tickets mint without payment
- `marketingMinted` increments
- `ticketMinted` increments
- ticket ownership belongs to `marketingWallet`
- marketing tickets are redeemable later

## Failure cases
- non-owner call must revert
- mint above `marketingCap` must revert
- zero address recipient must revert

---

# Scenario 5 — Redeem entry through TicketHub

## Objective
Ensure end users cannot redeem directly through VRF collection and must use TicketHub.

## Steps
1. `alice` owns a ticket.
2. `alice` tries direct `BiggiMain.redeemFromTicketHub(...)`.
3. `alice` redeems through `TicketHub.redeemTicket(ticketId)`.

## Assertions
- direct call to `BiggiMain.redeemFromTicketHub` from user must revert
- TicketHub burns the ticket
- `ticketCount[alice]` decrements
- `isTicket[ticketId]` becomes false
- `BiggiMain.pendingMintRequest[alice]` is set
- `pendingMinters[requestId] == alice`
- `pendingTicketId[requestId]` or equivalent request tracing is stored if implemented

## Failure cases
- redeem non-ticket must revert
- redeem ticket not owned by caller must revert
- redeem while paused must revert
- redeem while caller already has pending request must revert

---

# Scenario 6 — VRF fulfillment and final NFT mint

## Objective
Validate random fulfillment and final NFT generation.

## Preconditions
- metadata/index slot for the chosen NFT index is initialized in `BiggiMain`
- VRF router is configured

## Steps
1. TicketHub creates a pending redeem.
2. Simulate VRF callback into `BiggiMain.fulfillRandomFromRouter(requestId, randomWord)`.

## Assertions
- only VRF router may call fulfill
- selected NFT index is marked minted
- `biggiMinted` increments
- final NFT is minted to the original redeemer
- `nftInfo[idx].ticketPrice` equals ticket snapshot from TicketHub, not current global ticket price
- `nftInfo[idx].blockPrice` is stored
- `nftInfo[idx].finalPrice` is stored
- `blockMintCounts` increments for the correct block
- `backgroundMintCounts` increments for the correct background
- pending mappings are cleared

## Failure cases
- uninitialized metadata index must revert
- invalid compute module or missing VRF router must revert appropriately
- non-router fulfill caller must revert

---

# Scenario 7 — Block price propagation after redeem

## Objective
Validate that VRF collection block pricing updates and becomes the source for public mint pricing.

## Steps
1. Record current block price in `BiggiMain`.
2. Fulfill a VRF mint that applies background-based price increase.
3. Query block price again in `BiggiMain`.
4. Query public mint pricing through `BiggiMain2` for same chapter.

## Assertions
- block price in `BiggiMain` changes according to `compute.bgIncreasePct(bg)`
- `BiggiMain2` resolves chapter price provider via controller
- public mint pricing reflects updated VRF block price

## Failure cases
- if controller returns no provider and no explicit provider is set, local fallback should be used only if intended by deployment mode

---

# Scenario 8 — Character reward mint trigger

## Objective
Validate character mint when a full block supply is completed.

## Steps
1. Mint/redeem NFTs until a target block reaches `_totalBlockNFTs(block)`.
2. Fulfill the final NFT required to complete that block.

## Assertions
- `characterClaimed[block]` flips to true exactly once
- character token is minted to the redeemer of the completing NFT
- repeated completion attempts do not mint another character reward

---

# Scenario 9 — Public collection unlock

## Objective
Validate strict Variant A unlock rule.

## Steps
1. Configure `saleCap` and `marketingCap`.
2. Mint sale tickets until `saleMinted == saleCap`.
3. Mint marketing tickets until `marketingMinted == marketingCap`.
4. Confirm `ticketMinted == totalCap`.
5. Attempt public mint before and after full exhaustion.

## Assertions
- before full exhaustion, `BiggiMain2` public mint must revert
- after full exhaustion, `isPublicMintUnlocked(chapterId)` must return true
- public mint succeeds only after all three conditions are met:
  - `saleMinted == saleCap`
  - `marketingMinted == marketingCap`
  - `totalMinted == totalCap`

## Failure cases
- partial sellout must not unlock public collection

---

# Scenario 10 — Distributor chapter-aware accounting

## Objective
Validate that mint funds are attributed to the right collection/chapter/series.

## Steps
1. Mint one ticket via TicketHub.
2. Mint one public NFT via BiggiMain2 after unlock.
3. Inspect distributor accounting.

## Assertions
- `receivedBySource[TicketHub]` increased
- `receivedBySource[BiggiMain2]` increased
- `receivedByChapter[chapterId]` includes both flows
- `receivedBySeries[seriesId]` includes both flows
- split routing percentages remain unchanged from existing logic

## Failure cases
- calls from non-whitelisted senders must revert or be rejected according to original distributor rules

---

# Scenario 11 — TokenRewards across VRF + Public collections

## Objective
Validate multi-collection weekly BIGGI rewards.

## Steps
1. Register both VRF and Public collection as eligible in registry.
2. Mint NFTs from both collections to `alice`.
3. Call TokenRewards claim.

## Assertions
- both VRF and Public NFTs are counted if registry allows them
- weekly claim tracking works per token
- reward math remains unchanged
- payout uses contract balance first and mint-to-cap second

## Failure cases
- collection not eligible in registry must not count
- same token claimed twice in same week must not count twice

---

# Scenario 12 — CollectionRewards VRF-only behavior

## Objective
Validate that collection rewards apply only to VRF collections.

## Steps
1. Register VRF collection as CollectionRewards-eligible.
2. Ensure Public collection is not eligible.
3. Test orange, block, rainbow claims against VRF collection.
4. Attempt same style of claim against Public collection.

## Assertions
- VRF claims succeed when conditions are met
- Public collection claims fail or are ignored according to implementation
- claim uniqueness is namespaced per VRF collection

## Failure cases
- Public collection must never receive CollectionRewards
- duplicate orange/block/rainbow claims for same VRF collection scope must fail

---

# Scenario 13 — Pause and admin safety

## Objective
Validate pause behavior and restricted admin functions.

## Steps
1. Pause TicketHub.
2. Pause BiggiMain.
3. Pause BiggiMain2.
4. Test mint/redeem behavior.
5. Test owner-only setters from non-owner.

## Assertions
- paused contracts reject their state-changing user actions
- only owner can update sensitive addresses and config
- only TicketHub can call `redeemFromTicketHub`
- only VRF router can call fulfill

---

# Scenario 14 — Edge-case supply exhaustion

## Objective
Validate system behavior at the end of chapter supply.

## Steps
1. Mint up to full 550 ticket cap.
2. Redeem enough tickets to mint full VRF NFT supply where applicable.
3. Attempt one additional mint/redeem.

## Assertions
- no mint above total ticket cap
- no redeem above VRF NFT max supply
- sold-out paths revert cleanly

---

# Scenario 15 — Recommended smoke test sequence

Run this minimum smoke sequence before any public mainnet rollout:

1. Deploy all contracts.
2. Register one series and one chapter.
3. Configure one VRF + one Public + one TicketHub.
4. Mint 2 sale tickets.
5. Mint 1 marketing ticket.
6. Redeem 1 ticket.
7. Fulfill VRF request.
8. Verify `nftInfo` snapshot and block price update.
9. Exhaust remaining ticket supply in a reduced-cap local configuration.
10. Confirm public unlock.
11. Mint 1 public NFT.
12. Claim TokenRewards.
13. Claim CollectionRewards for VRF only.
14. Verify distributor attribution by source/chapter/series.

---

# Final Go/No-Go Checklist

Mainnet promotion should be blocked unless all are true:

- [ ] TicketHub direct mint works in native and BIGGI modes
- [ ] Redeem only works through TicketHub
- [ ] VRF fulfill mints correct final NFT
- [ ] metadata slots are initialized before redeem
- [ ] block price updates propagate to Public collection pricing
- [ ] Public collection stays locked until full VRF ticket exhaustion
- [ ] Distributor attributes funds correctly to chapter and series
- [ ] TokenRewards accepts VRF + Public collections only when registry allows them
- [ ] CollectionRewards accepts VRF collections only
- [ ] all owner-only and router-only restrictions are enforced
- [ ] pause flows behave correctly
- [ ] sold-out behavior is deterministic and safe
