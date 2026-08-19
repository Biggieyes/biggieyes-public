# Audit Notes - BiggiMain

Deployment status: live on Polygon mainnet as of 2026-06-16. These notes are predeploy audit notes for final mainnet preparation.

## Security invariants
- VRF callback authorization and replay protection
- Mint limits and phase gates remain enforced
- Metadata reveal cannot desync token state

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

## Metadata consistency update (2026-06-07)
- VRF `BiggiMain` uses `setURI(0, 0, rewardsBaseURI)`, `setURI(1, 0, charactersBaseURI)`, and `setURI(3, blockIdx, blockBaseURI)`.
- Ticket metadata is not configured through `BiggiMain`; it is configured through `BiggiTicketHub.setTicketBaseURI`.
- Launch readiness requires `metadataConsistency()` to return `550, true, true` and `assertMetadataConsistency()` to pass before redeem is opened.
