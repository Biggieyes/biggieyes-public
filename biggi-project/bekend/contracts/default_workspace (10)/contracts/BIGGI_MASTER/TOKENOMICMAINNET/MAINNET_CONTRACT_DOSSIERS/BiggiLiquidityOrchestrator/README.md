# BiggiLiquidityOrchestrator Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiLiquidityOrchestrator; Source=BiggiLiquidityOrchestrator.sol; Abi=ABI/BiggiLiquidityOrchestrator.abi.json; Role=Rule layer that decides when liquidity manager should execute add/refill operations.; Delta=Mainnet profile adds keeper-oriented orchestration and anti-duplication with alternate automation branch.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiLiquidityOrchestrator; Source=BiggiLiquidityOrchestrator.sol; Abi=ABI/BiggiLiquidityOrchestrator.abi.json; Role=Rule layer that decides when liquidity manager should execute add/refill operations.; Delta=Mainnet profile adds keeper-oriented orchestration and anti-duplication with alternate automation branch.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Rule layer that decides when liquidity manager should execute add/refill operations.

## Mainnet delta vs testnet
Mainnet profile adds keeper-oriented orchestration and anti-duplication with alternate automation branch.

## Critical integrations
- BiggiLiquidityManager
- BiggiLiquidityKeeperProxy
- BiggiLiquidityAutomation
- BiggiMainReader

## Privileged actions
- Owner sets keeper and thresholds
- Keeper triggers scheduled orchestration
- Owner can reconfigure limits

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
