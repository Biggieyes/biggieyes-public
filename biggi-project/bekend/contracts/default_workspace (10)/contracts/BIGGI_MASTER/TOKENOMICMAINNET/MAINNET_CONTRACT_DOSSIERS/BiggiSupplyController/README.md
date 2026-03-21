# BiggiSupplyController Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiSupplyController; Source=BiggiSupplyController.sol; Abi=ABI/BiggiSupplyController.abi.json; Role=Primary keeper-driven maintenance controller for DEX reserve refills and TokenRewards floor refills.; Delta=Mainnet introduces upkeep hooks, pair baseline snapshots, cooldown controls, and optional circuit-breaker thresholds.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiSupplyController; Source=BiggiSupplyController.sol; Abi=ABI/BiggiSupplyController.abi.json; Role=Primary keeper-driven maintenance controller for DEX reserve refills and TokenRewards floor refills.; Delta=Mainnet introduces upkeep hooks, pair baseline snapshots, cooldown controls, and optional circuit-breaker thresholds.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Primary keeper-driven maintenance controller for DEX reserve refills and TokenRewards floor refills.

## Mainnet delta vs testnet
Mainnet introduces upkeep hooks, pair baseline snapshots, cooldown controls, and optional circuit-breaker thresholds.

## Critical integrations
- BiggiToken
- DEX pair BIGGI/WNATIVE
- BiggiDexReserveGuard
- BiggiTokenRewards

## Privileged actions
- Owner sets pair and refill parameters
- Keepers/allowed callers run performMaintenance
- Owner pause/unpause control

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
