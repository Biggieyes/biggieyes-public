# Audit Notes - BiggiCollectionRewards

Deployment status: live on Polygon mainnet as of 2026-06-16.

## Security invariants
- No cross-collection state collision
- Per-collection accounting remains isolated
- Claims are globally one-time per milestone and isolated by VRF collection
- Public collections remain ineligible for CollectionRewards
- State changes revert when the native payout fails or the pool is underfunded

## Required test coverage
- Happy path with production-like parameters.
- Revert path for unauthorized caller or invalid config.
- Underfunded pool and failed payout rollback.
- Cross-contract integration smoke with downstream dependencies.

## Runtime monitoring checklist
- Track critical events and balances via readers and indexer.
- Alert when pool balance is below outstanding maximum liability.
- Alert on distributor pending transfers and owner/configuration changes.

## Status (2026-08-24)
- Read-only Polygon claim audit: `55/55` checks passed at block `92590349`.
- Live reward amounts: `1000 / 3000 / 10000 POL`.
- Maximum liability: `47000 POL` per chapter, `235000 POL` across five chapters.
- Current pool and distributor receipts: `0 POL`; claims remain fail-closed until mint revenue funds the pool.
- Native ticket mints route an effective 15% to CollectionRewards; BIGGI-paid ticket mints route no POL to this pool.
- Audit command: `npm run audit:collection-rewards:polygon`.
