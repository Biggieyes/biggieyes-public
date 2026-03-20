# BiggiLiquidityVault Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiLiquidityVault; Source=BiggiLiquidityVault.sol; Abi=ABI/LiquidityVault.abi.json; Role=Custody vault for LP positions and reserve-side liquidity assets.; Delta=Mainnet vault is used as explicit custody endpoint to reduce EOA handling risk for LP assets.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiLiquidityVault; Source=BiggiLiquidityVault.sol; Abi=ABI/LiquidityVault.abi.json; Role=Custody vault for LP positions and reserve-side liquidity assets.; Delta=Mainnet vault is used as explicit custody endpoint to reduce EOA handling risk for LP assets.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Custody vault for LP positions and reserve-side liquidity assets.

## Mainnet delta vs testnet
Mainnet vault is used as explicit custody endpoint to reduce EOA handling risk for LP assets.

## Critical integrations
- BiggiLiquidityManager
- BiggiReserveV4
- Treasury ops

## Privileged actions
- Owner manages authorized spenders/receivers
- Liquidity manager approved pull/push paths
- Emergency rescue restricted to owner

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
