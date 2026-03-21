# BiggiDexReserveGuard Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiDexReserveGuard; Source=BiggiDexReserveGuard.sol; Abi=ABI/BiggiDexReserveGuard.abi.json; Role=Secondary guard keeper watching DEX reserve depletion and triggering constrained refill path.; Delta=Mainnet adds baseline reserve model, cooldown checks, and optional price deviation gate before refill.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiDexReserveGuard; Source=BiggiDexReserveGuard.sol; Abi=ABI/BiggiDexReserveGuard.abi.json; Role=Secondary guard keeper watching DEX reserve depletion and triggering constrained refill path.; Delta=Mainnet adds baseline reserve model, cooldown checks, and optional price deviation gate before refill.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Secondary guard keeper watching DEX reserve depletion and triggering constrained refill path.

## Mainnet delta vs testnet
Mainnet adds baseline reserve model, cooldown checks, and optional price deviation gate before refill.

## Critical integrations
- BiggiSupplyController
- DEX pair BIGGI/WNATIVE
- BiggiSupplyControllerReader

## Privileged actions
- Owner sets keeper list and thresholds
- Keeper performs guarded refill upkeep
- Owner can pause guard branch

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
