# BiggiCollectionRewards - Technical Specification

## Source of truth

- Contract: `CORE/BiggiCollectionRewards.sol`
- Solidity: `^0.8.24`
- Legacy live Polygon address: `0x5d1273070c9133381C570009768621762F024FB8`
- Replacement address: pending explicit mainnet redeploy
- Registry: `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058`
- Distributor: `0xCE892698159D8D799D5eF7f0dF0111487511fD22`
- Default VRF collection: `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4`

The repository source and `ABI.json` describe the budget-gated replacement.
They must not be submitted as verification input for the legacy address. The
replacement address and constructor arguments must be recorded here only
after the redeploy report confirms all post-deploy checks.

The contract pays fixed native POL rewards for ownership milestones in each
eligible VRF collection. Public collections are intentionally excluded.

## Live reward amounts

- Orange: `1000 POL`
- Block: `3000 POL`
- Rainbow: `10000 POL`

The owner can change reward amounts only before the first collection budget is
configured. The reward schedule is then permanently locked for consistent
liability accounting across all chapters.

Maximum liability per collection is:

```text
10 * 1000 + 9 * 3000 + 1 * 10000 = 47000 POL
```

Five configured chapters therefore have a maximum aggregate liability of
`235000 POL` before any claims are settled.

## Claim rules

### Orange

`claimOrangeRewardFor(collection, mainId)` accepts `mainId` 1-10. The caller
must currently own all ten background variants for that Main ID in block 1.
Only one payout exists for each Main ID and at most ten payouts exist per VRF
collection.

### Block

`claimBlockRewardFor(collection, blockIdx)` accepts blocks 1-9. The caller must
currently own at least one minted NFT for every one of the ten distinct Main
IDs assigned to the block. Only one payout exists for each block and at most
nine payouts exist per VRF collection.

### Rainbow

`claimRainbowRewardFor(collection)` requires the caller to currently own all
ten distinct Main IDs assigned to block 10. There is one Rainbow payout per
VRF collection.

The legacy `claimOrangeReward`, `claimBlockReward`, and `claimRainbowReward`
entrypoints always use `defaultMain`. Multi-chapter clients must use the
explicit `*For` entrypoints.

## Eligibility

`defaultMain` is always eligible. When `registry` is configured, any additional
collection must satisfy `BiggiSeriesRegistry.isCollectionRewardsCollection`.
The registry returns true only for a chapter's VRF collection when its
CollectionRewards flag is enabled. A Public collection is not eligible.

The selected collection must implement:

```solidity
hasAllTenMainIdsInBlock(address owner, uint16 blockIdx)
hasAllBackgroundsForMainIdInBlock(
    address owner,
    uint16 blockIdx,
    uint256 mainId
)
```

Unsupported collection interfaces are rejected as `InvalidCollection`.

## Claim safety

- Every claim entrypoint is `nonReentrant`.
- Eligibility is checked against current on-chain ownership.
- Global paid state is written before the native payout call.
- A failed payout reverts the complete state transition.
- An underfunded collection budget reverts with `ClaimsBudgetLocked`.
- A claim cannot consume POL accounted to another collection.
- Physical balance and isolated available budget are both checked at payout.
- Preview helpers return `ok` plus a reason code without sending a transaction.

## Funding

`depositMintShareFromDistributor()` and `receiveMintShare()` both require the
configured distributor as caller and a non-zero value. Each transfer is
credited to `fundingCollection`. Explicit top-ups use
`fundCollectionBudget(collection)`.

For native TicketHub mints, TicketHub sends 60% to the shared distributor and
the distributor sends 25% of that amount here. The effective share is 15% of
the native ticket price. At the live starting price of `500 POL`, the live
`10033` price factor, and 500 native sales, the projected inflow is about
`95292.1393 POL`; one chapter's `47000 POL` liability is reached after 341
native sales.

BIGGI-paid ticket mints do not fund this native POL pool. Native sales keep
funding the selected collection, but its claims stay fail-closed until the
full `47000 POL` maximum liability has arrived. Failed native forwarding is
tracked in the distributor's `pending(CollectionRewards)` balance and can be
retried.

Only one chapter may sell at a time. Before enabling the next chapter, first
disable the previous chapter, confirm no pending rewards transfer, call
`setFundingCollection(nextVrfCollection)`, and only then activate the next
chapter.

## State isolation

These values are keyed by VRF collection:

- `orangeWinnersCount`
- `blockWinnersCount`
- `rainbowRewardClaimedGlobal`
- `orangeMainIdPaid`
- `blockPaid`
- `userClaimedBlock`
- `collectionBudgets`

A claim in one chapter cannot mark the same milestone paid in another chapter.

## Administration

Owner-only methods:

- `setOwner`
- `setMain`
- `setRegistry` / `clearRegistry`
- `setDistributor`
- `setRewardsAmounts`
- `configureCollectionBudget`
- `setFundingCollection` / `clearFundingCollection`

The contract has no pause switch and no owner withdrawal function. Operational
changes to registry, distributor, funding collection, or ownership must
therefore be monitored directly from on-chain state.

## Redeploy procedure

Read-only preflight:

```bash
npm run prepare:collection-rewards-redeploy:polygon
```

The execute command is intentionally separate and must not be run without an
explicit mainnet approval. It deploys the replacement and a new
`BiggiMainReader`, configures all registered VRF budgets, switches Distributor
and MasterConfig, verifies post-state, and synchronizes address books.

## Verification

Run the read-only Polygon audit:

```bash
npm run audit:collection-rewards:polygon
```

The JSON result is written to
`reports/collection-rewards-claims-audit-polygon.json`.
