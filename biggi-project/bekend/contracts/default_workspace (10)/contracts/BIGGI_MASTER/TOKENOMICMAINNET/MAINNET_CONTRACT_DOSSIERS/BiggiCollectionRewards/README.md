# BiggiCollectionRewards Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiCollectionRewards; Source=../BiggiCollectionRewards.sol; Abi=../CORE_ABI/BiggiCollectionRewards.abi.json; Role=Scalable reward-distribution layer for multiple collections linked to chapter/series structure.; Delta=Mainnet emphasis is scalability and deterministic weighting across more than one collection branch.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiCollectionRewards; Source=../BiggiCollectionRewards.sol; Abi=../CORE_ABI/BiggiCollectionRewards.abi.json; Role=Scalable reward-distribution layer for multiple collections linked to chapter/series structure.; Delta=Mainnet emphasis is scalability and deterministic weighting across more than one collection branch.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Scalable reward-distribution layer for multiple collections linked to chapter/series structure.

## Mainnet delta vs testnet
Mainnet emphasis is scalability and deterministic weighting across more than one collection branch.

## Critical integrations
- BiggiSeriesRegistry
- BiggiChapterController
- BiggiTokenRewards
- BiggiMain/BiggiMain2

## Privileged actions
- Owner/admin assigns collection routes
- Trusted collection contracts submit events
- Owner updates distribution parameters

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
