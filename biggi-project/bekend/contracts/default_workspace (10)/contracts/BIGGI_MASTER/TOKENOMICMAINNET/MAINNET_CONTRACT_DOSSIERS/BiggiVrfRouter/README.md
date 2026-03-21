# BiggiVrfRouter Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiVrfRouter; Source=../BiggiVrfRouter.sol; Abi=../CORE_ABI/BiggiVRFRouter.abi.json; Role=Router for VRF requests/fulfillments, dispatching randomness to approved consumer collections.; Delta=Mainnet requires final coordinator/keyHash/subscription wiring and strict consumer allowlisting.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiVrfRouter; Source=../BiggiVrfRouter.sol; Abi=../CORE_ABI/BiggiVRFRouter.abi.json; Role=Router for VRF requests/fulfillments, dispatching randomness to approved consumer collections.; Delta=Mainnet requires final coordinator/keyHash/subscription wiring and strict consumer allowlisting.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Router for VRF requests/fulfillments, dispatching randomness to approved consumer collections.

## Mainnet delta vs testnet
Mainnet requires final coordinator/keyHash/subscription wiring and strict consumer allowlisting.

## Critical integrations
- Chainlink VRF coordinator
- BiggiMain
- BiggiSeriesRegistry
- BiggiChapterController

## Privileged actions
- Owner sets coordinator and consumer permissions
- Only coordinator should fulfill randomness
- Owner can adjust callback limits

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
