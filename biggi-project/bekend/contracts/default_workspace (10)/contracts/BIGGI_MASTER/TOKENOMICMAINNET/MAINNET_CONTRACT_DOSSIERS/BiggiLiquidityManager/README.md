# BiggiLiquidityManager Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiLiquidityManager; Source=BiggiLiquidityManager.sol; Abi=ABI/BiggiLiquidityManager.abi.json; Role=Execution module for liquidity actions using reserve assets and router interactions.; Delta=Mainnet branch formalizes reserve pull permissions, cooldown-safe top-up workflow, and clearer event accounting.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiLiquidityManager; Source=BiggiLiquidityManager.sol; Abi=ABI/BiggiLiquidityManager.abi.json; Role=Execution module for liquidity actions using reserve assets and router interactions.; Delta=Mainnet branch formalizes reserve pull permissions, cooldown-safe top-up workflow, and clearer event accounting.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Execution module for liquidity actions using reserve assets and router interactions.

## Mainnet delta vs testnet
Mainnet branch formalizes reserve pull permissions, cooldown-safe top-up workflow, and clearer event accounting.

## Critical integrations
- BiggiReserveV4
- BiggiLiquidityOrchestrator
- DEX router/factory/pair
- BiggiLiquidityVault

## Privileged actions
- Owner sets router/pair dependencies
- Authorized orchestrator/keeper triggers actions
- Owner can pause route

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
