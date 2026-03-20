# BiggiTokenRewards Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiTokenRewards; Source=../BiggiTokenRewards.sol; Abi=../CORE_ABI/BiggiTokenRewards.abi.json; Role=Core token rewards ledger and claim engine for eligible collection holders and configured operators.; Delta=Mainnet tokenomics branch depends on reliable refill path from Token and Treasury for continuity under stress.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiTokenRewards; Source=../BiggiTokenRewards.sol; Abi=../CORE_ABI/BiggiTokenRewards.abi.json; Role=Core token rewards ledger and claim engine for eligible collection holders and configured operators.; Delta=Mainnet tokenomics branch depends on reliable refill path from Token and Treasury for continuity under stress.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Core token rewards ledger and claim engine for eligible collection holders and configured operators.

## Mainnet delta vs testnet
Mainnet tokenomics branch depends on reliable refill path from Token and Treasury for continuity under stress.

## Critical integrations
- BiggiToken
- BiggiTreasury
- BiggiMain/BiggiMain2 collections
- BiggiSupplyController

## Privileged actions
- Owner configures sources and operators
- Approved operators can trigger reward operations
- Emergency pause/rescue if implemented

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
