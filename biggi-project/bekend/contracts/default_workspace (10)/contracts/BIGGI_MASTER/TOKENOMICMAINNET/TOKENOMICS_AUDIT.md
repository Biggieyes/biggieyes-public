# Tokenomics consistency notes

## Changes applied
- Fixed malformed `BiggiToken.sol` by merging guardian/controller authority into the contract body.
- Raised total BIGGI cap to include guardian refill budgets.
- Added explicit guardian budgets in `BiggiCapsLib`.
- Expanded `BiggiDripDistributor` historical cap to accept guardian drip refills.
- Rewrote `BiggiBuybackDripSetup.sol` to remove invalid interface bodies and keep setup-only behavior.
- Upgraded `BiggiSupplyController` with reserve-floor detection, Chainlink/Gelato-style upkeep hooks, keeper allowlist, and maintenance preview.
- Converted `BiggiSupplyGuardian` into a manual ops helper over the controller instead of a second mint authority brain.

## Logic changes
- **MAJOR**: tokenomics is now elastic within bounded guardian budgets.
- **MINOR**: setup/orchestrator cleanup and controller automation hooks.
- **NO LOGIC CHANGE**: readers and malformed syntax cleanup where behavior was preserved.

## Remaining review targets
- `Multicall2.sol` is a standard utility and was not modified.
- `BiggiLiquidityAutomation.sol`, `BiggiLiquidityKeeperProxy.sol`, `BiggiUpKeeperProxy.sol` remain architecturally compatible; they should be exercised in integration tests with real deploy addresses.
