# BiggiTreasury Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiTreasury; Source=BiggiTreasury.sol; Abi=ABI/BiggiTreasury.abi.json; Role=Treasury routing hub that receives assets and forwards BIGGI/native splits to protocol branches.; Delta=Mainnet routing formalizes buyback split paths into TokenRewards, Reserve, and Drip branches with accounting events.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiTreasury; Source=BiggiTreasury.sol; Abi=ABI/BiggiTreasury.abi.json; Role=Treasury routing hub that receives assets and forwards BIGGI/native splits to protocol branches.; Delta=Mainnet routing formalizes buyback split paths into TokenRewards, Reserve, and Drip branches with accounting events.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Treasury routing hub that receives assets and forwards BIGGI/native splits to protocol branches.

## Mainnet delta vs testnet
Mainnet routing formalizes buyback split paths into TokenRewards, Reserve, and Drip branches with accounting events.

## Critical integrations
- BiggiBuybackAgent
- BiggiTokenRewards
- BiggiReserveV4
- BiggiDripDistributor

## Privileged actions
- Owner sets downstream addresses
- Authorized distributors can deposit native
- Owner emergency rescue paths

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
