# BiggiReserveV4 Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiReserveV4; Source=BiggiReserveV4.sol; Abi=ABI/BiggiReserveV4.abi.json; Role=Reserve bucket contract for BIGGI/native POL with dedicated waiting and DEX-refill accounting.; Delta=Mainnet branch adds stricter notify-caller controls and better reserve-to-liquidity trigger hooks.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiReserveV4; Source=BiggiReserveV4.sol; Abi=ABI/BiggiReserveV4.abi.json; Role=Reserve bucket contract for BIGGI/native POL with dedicated waiting and DEX-refill accounting.; Delta=Mainnet branch adds stricter notify-caller controls and better reserve-to-liquidity trigger hooks.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Reserve bucket contract for BIGGI/native POL with dedicated waiting and DEX-refill accounting.

## Mainnet delta vs testnet
Mainnet branch adds stricter notify-caller controls and better reserve-to-liquidity trigger hooks.

## Critical integrations
- BiggiLiquidityManager
- BiggiTreasury
- BiggiSupplyController
- BiggiSystemReader

## Privileged actions
- Owner assigns liquidity manager and distributor
- Owner can enable strict notify caller allowlist
- LiquidityManager can pull approved refill buckets

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
