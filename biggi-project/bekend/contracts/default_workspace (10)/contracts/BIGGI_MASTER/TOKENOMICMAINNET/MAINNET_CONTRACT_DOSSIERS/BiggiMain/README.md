# BiggiMain Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiMain; Source=../BiggiMain.sol; Abi=../CORE_ABI/BiggiEyesMain.abi.json; Role=Main collection branch intended for VRF-backed mint/reveal and metadata progression.; Delta=Mainnet branch is expected to run with production VRF router wiring and chapter/series constraints.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiMain; Source=../BiggiMain.sol; Abi=../CORE_ABI/BiggiEyesMain.abi.json; Role=Main collection branch intended for VRF-backed mint/reveal and metadata progression.; Delta=Mainnet branch is expected to run with production VRF router wiring and chapter/series constraints.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Main collection branch intended for VRF-backed mint/reveal and metadata progression.

## Mainnet delta vs testnet
Mainnet branch is expected to run with production VRF router wiring and chapter/series constraints.

## Critical integrations
- BiggiVrfRouter
- BiggiTicketHub
- BiggiSeriesRegistry
- BiggiCollectionRewards

## Privileged actions
- Owner/admin controls sale phases and metadata config
- VRF router callback path updates randomness state
- Operators may handle reveal/finalize actions

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
