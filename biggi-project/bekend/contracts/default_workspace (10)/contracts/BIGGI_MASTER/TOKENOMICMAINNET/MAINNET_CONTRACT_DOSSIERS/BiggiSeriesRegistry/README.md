# BiggiSeriesRegistry Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiSeriesRegistry; Source=../BiggiSeriesRegistry.sol; Abi=../CORE_ABI/BiggiSeriesRegistry.abi.json; Role=Registry of series/chapter/collection relationships used by rewards, VRF, and routing layers.; Delta=Mainnet branch includes stricter uniqueness and linkage guarantees to avoid duplicate chapter-collection assignment.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiSeriesRegistry; Source=../BiggiSeriesRegistry.sol; Abi=../CORE_ABI/BiggiSeriesRegistry.abi.json; Role=Registry of series/chapter/collection relationships used by rewards, VRF, and routing layers.; Delta=Mainnet branch includes stricter uniqueness and linkage guarantees to avoid duplicate chapter-collection assignment.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Registry of series/chapter/collection relationships used by rewards, VRF, and routing layers.

## Mainnet delta vs testnet
Mainnet branch includes stricter uniqueness and linkage guarantees to avoid duplicate chapter-collection assignment.

## Critical integrations
- BiggiChapterController
- BiggiMain
- BiggiMain2
- BiggiCollectionRewards
- BiggiVrfRouter

## Privileged actions
- Owner/admin registers and updates mappings
- Trusted consumers query canonical links
- Migration/update operations must be controlled

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
