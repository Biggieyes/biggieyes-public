# Audit Notes - BiggiTreasury

## Security invariants
- Split percentages and destination routes are deterministic
- No silent balance sink in transfer/approval flow
- Historical counters remain monotonic
- Ecosystem BIGGI callers are explicit allowlist entries
- Plain ERC20 transfers to treasury do not trigger BIGGI split logic

## Required test coverage
- Happy path with production-like parameters.
- Revert path for unauthorized caller or invalid config.
- Pause/emergency behavior where applicable.
- Cross-contract integration smoke with downstream dependencies.
- BIGGI NFT payment smoke from `BiggiTicketHub` and `BiggiMain2` through `receiveEcosystemBiggi`.

## Runtime monitoring checklist
- Track critical events and balances via readers and indexer.
- Alert on paused states, failed upkeep runs, and threshold breaches.
- Alert on ownership/keeper changes.
- Alert if `ecosystemBiggiCallers(TicketHub/Main2)` or `Reserve.notifyCallers(Treasury)` changes.

## Status (2026-06-03)
- Code consistency in this branch: reviewed against the current source and ABI artifact.
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- External dependency readiness: final mainnet addresses and keeper/liquidity/automation production wiring still required before launch.
- Ecosystem BIGGI path: implemented and covered by local smoke tests; final mainnet still needs canonical addresses for TicketHub/Main2/Treasury/Reserve before go-live.
