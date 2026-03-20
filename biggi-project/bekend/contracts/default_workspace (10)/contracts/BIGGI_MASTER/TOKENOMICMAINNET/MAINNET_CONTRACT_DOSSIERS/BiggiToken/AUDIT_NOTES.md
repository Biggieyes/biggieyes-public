# Audit Notes - BiggiToken

## Security invariants
- Total cap cannot be exceeded under any mint path
- Only approved authorities can mint/refill
- Pause cannot be bypassed through helper routes

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
