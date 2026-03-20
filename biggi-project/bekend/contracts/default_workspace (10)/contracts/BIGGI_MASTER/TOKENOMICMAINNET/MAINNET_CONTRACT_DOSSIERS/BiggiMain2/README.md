# BiggiMain2 Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiMain2; Source=../BiggiMain2.sol; Abi=../CORE_ABI/BiggiEyesMain2.abi.json; Role=Public sale collection branch complementary to VRF main branch, sharing ecosystem reward/ticket interfaces.; Delta=Mainnet version should align metadata and ticket routing with Main1 while preserving public-sale rules.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiMain2; Source=../BiggiMain2.sol; Abi=../CORE_ABI/BiggiEyesMain2.abi.json; Role=Public sale collection branch complementary to VRF main branch, sharing ecosystem reward/ticket interfaces.; Delta=Mainnet version should align metadata and ticket routing with Main1 while preserving public-sale rules.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Public sale collection branch complementary to VRF main branch, sharing ecosystem reward/ticket interfaces.

## Mainnet delta vs testnet
Mainnet version should align metadata and ticket routing with Main1 while preserving public-sale rules.

## Critical integrations
- BiggiTicketHub
- BiggiCollectionRewards
- BiggiSeriesRegistry
- BiggiMainReader

## Privileged actions
- Owner/admin controls public sale parameters
- Operators handle metadata base updates
- Trusted hubs can record ticket/reward hooks

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
