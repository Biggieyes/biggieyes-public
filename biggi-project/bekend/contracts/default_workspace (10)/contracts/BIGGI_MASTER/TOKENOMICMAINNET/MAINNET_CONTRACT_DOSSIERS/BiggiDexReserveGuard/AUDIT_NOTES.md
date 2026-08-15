# Audit Notes - BiggiDexReserveGuard

## Security invariants
- No duplicate refill in same interval with controller
- Baseline refresh is explicit and auditable
- Price-check settings fail-safe on stale data

## Required test coverage
- Happy path with production-like parameters.
- Revert path for unauthorized caller or invalid config.
- Pause/emergency behavior where applicable.
- Cross-contract integration smoke with downstream dependencies.

## Runtime monitoring checklist
- Track critical events and balances via readers and indexer.
- Alert on paused states, failed upkeep runs, and threshold breaches.
- Alert on ownership/keeper changes.

## Status (2026-06-03)
- Code consistency in this branch: reviewed against the current source and ABI artifact.
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- External dependency readiness: final mainnet addresses and keeper/liquidity/automation production wiring still required before launch.
