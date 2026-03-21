# BiggiSupplyGuardian Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiSupplyGuardian; Source=BiggiSupplyGuardian.sol; Abi=ABI/BiggiSupplyGuardian.abi.json; Role=Manual emergency operator for bounded fallback actions when automated supply paths are unstable.; Delta=Mainnet refactor reduces guardian scope to helper role over controller constraints instead of independent policy brain.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiSupplyGuardian; Source=BiggiSupplyGuardian.sol; Abi=ABI/BiggiSupplyGuardian.abi.json; Role=Manual emergency operator for bounded fallback actions when automated supply paths are unstable.; Delta=Mainnet refactor reduces guardian scope to helper role over controller constraints instead of independent policy brain.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Manual emergency operator for bounded fallback actions when automated supply paths are unstable.

## Mainnet delta vs testnet
Mainnet refactor reduces guardian scope to helper role over controller constraints instead of independent policy brain.

## Critical integrations
- BiggiSupplyController
- BiggiToken
- BiggiPolicy

## Privileged actions
- Owner designates guardian operators
- Guardian can execute emergency bounded actions
- Owner can disable guardian operations

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
