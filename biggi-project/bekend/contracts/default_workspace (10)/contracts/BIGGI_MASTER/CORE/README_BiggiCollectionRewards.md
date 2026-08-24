# BiggiCollectionRewards

Deployment status: budget-gated contract deployed and verified on Polygon on
2026-08-24 at `0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43`.
The superseded address is recorded in `addresses.master.json` as
`OLD_COLLECTION_REWARDS`.

## Purpose
Native-token rewards contract for collection completion milestones.

## Constructor
```solidity
constructor(address main_, address owner_)
```

## Reward configuration
- orange reward: `1000 ether`
- block reward: `3000 ether`
- rainbow reward: `10000 ether`

## What it supports
- default-main claims and explicit per-collection claims
- optional registry-based collection eligibility
- distributor-gated named funding functions
- isolated native budget accounting for every eligible VRF collection
- automatic claim unlock only after that collection reaches full coverage
- one active `fundingCollection` for sequential chapter sales

## Main runtime role
- pays orange, block, and rainbow rewards
- tracks per-collection claim caps and one-time claims
- exposes preview helpers such as `canClaim*` and `rewardsSnapshot`

## Funding invariant

Each native mint forwards 60% to `BiggiMultiCollectionDistributor`; the
distributor immediately forwards 25% of that amount here. Therefore 15% of
the native mint price is credited to the active VRF collection budget in the
same transaction. BIGGI-paid mints do not create a native POL inflow.

With the production reward schedule, one collection unlocks claims at:

```text
10 * 1000 + 9 * 3000 + 10000 = 47000 POL
```

Until then, `canClaim*For` returns reason `9` and claim transactions revert
with `ClaimsBudgetLocked`.
