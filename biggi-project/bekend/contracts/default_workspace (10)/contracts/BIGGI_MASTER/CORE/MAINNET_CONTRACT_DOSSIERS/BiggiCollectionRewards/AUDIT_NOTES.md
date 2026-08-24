# Audit Notes - BiggiCollectionRewards

Deployment status: replacement source prepared; legacy address remains live.

## Security invariants
- No cross-collection state collision
- Per-collection accounting remains isolated
- Claims are globally one-time per milestone and isolated by VRF collection
- Public collections remain ineligible for CollectionRewards
- State changes revert when the native payout fails or the pool is underfunded
- Claims remain disabled independently for each collection until its full
  maximum liability is funded
- A collection cannot spend another collection's accounted budget
- Reward amounts cannot change after budget accounting starts

## Required test coverage
- Happy path with production-like parameters.
- Revert path for unauthorized caller or invalid config.
- Underfunded pool and failed payout rollback.
- Cross-contract integration smoke with downstream dependencies.

## Runtime monitoring checklist
- Track critical events and balances via readers and indexer.
- Track `CollectionBudgetFunded` and `CollectionClaimsEnabled` per collection.
- Alert if an active chapter differs from `fundingCollection`.
- Alert on distributor pending transfers and owner/configuration changes.

## Status (2026-08-24)
- Read-only Polygon claim audit: `55/55` checks passed at block `92590349`.
- Live reward amounts: `1000 / 3000 / 10000 POL`.
- Maximum liability: `47000 POL` per chapter, `235000 POL` across five chapters.
- Current pool and distributor receipts: `0 POL`; claims remain fail-closed until mint revenue funds the pool.
- Native ticket mints route an effective 15% to CollectionRewards; BIGGI-paid ticket mints route no POL to this pool.
- Replacement dry-run passed for all five chapters on 2026-08-24; no mainnet
  write was submitted.
- Audit command: `npm run audit:collection-rewards:polygon`.
