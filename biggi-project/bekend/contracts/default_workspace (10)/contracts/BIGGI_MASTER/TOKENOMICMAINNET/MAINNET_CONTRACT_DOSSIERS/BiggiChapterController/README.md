# BiggiChapterController Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiChapterController; Source=../BiggiChapterController.sol; Abi=../CORE_ABI/BiggiChapterController.abi.json; Role=Governance/control plane for chapter lifecycle and collection activation constraints.; Delta=Mainnet hardening emphasizes strict chapter transitions and compatibility with registry/reward readers.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiChapterController; Source=../BiggiChapterController.sol; Abi=../CORE_ABI/BiggiChapterController.abi.json; Role=Governance/control plane for chapter lifecycle and collection activation constraints.; Delta=Mainnet hardening emphasizes strict chapter transitions and compatibility with registry/reward readers.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Governance/control plane for chapter lifecycle and collection activation constraints.

## Mainnet delta vs testnet
Mainnet hardening emphasizes strict chapter transitions and compatibility with registry/reward readers.

## Critical integrations
- BiggiSeriesRegistry
- BiggiCollectionRewards
- BiggiMainReader
- BiggiTokenRewards

## Privileged actions
- Owner/admin controls chapter state transitions
- Authorized contracts read chapter eligibility
- Emergency freeze path if defined

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
