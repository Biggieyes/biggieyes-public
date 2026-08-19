# Audit Notes - BiggiMultiCollectionDistributor

Deployment status: live on Polygon mainnet as of 2026-06-16. These notes are predeploy audit notes for final mainnet preparation.

## Security invariants
- BPS totals must always equal denominator
- No destination receives more than allocated share
- Distribution remains deterministic across many collections

## Required test coverage
- Happy path with production-like parameters.
- Revert path for unauthorized caller or invalid config.
- Pause/emergency behavior where applicable.
- Cross-contract integration smoke with downstream dependencies.

## Runtime monitoring checklist
- Track critical events and balances via readers and indexer.
- Alert on paused states, failed upkeep runs, and threshold breaches.
- Alert on ownership/keeper changes.

## Status (2026-03-20)
- Code consistency in this branch: reviewed.
- External dependency readiness: final mainnet addresses, keeper registration, and VRF production wiring still required before launch.
