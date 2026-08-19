# Audit Notes - BiggiMain2

Deployment status: corrected 100-NFT implementation is awaiting Polygon redeploy. The previously recorded 550-row Public deployment is superseded.

## Security invariants
- Public mint limits and payment validation
- Consistent metadata URI behavior
- No drift in integration callbacks vs Main1

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
- `BiggiMain2` now exposes the same metadata readiness views as `BiggiMain`: `metadataConfiguredCount`, `isMetadataFullyConfigured`, `isRewardMatrixConsistent`, `metadataConsistency`, and `assertMetadataConsistency`.
- Public block URI category is `2`; VRF `BiggiMain` block URI category remains `3`.
- Launch readiness requires all 100 metadata rows seeded, exactly ten per block, all ten block URIs configured, and `assertMetadataConsistency()` passing before public mint is opened.
