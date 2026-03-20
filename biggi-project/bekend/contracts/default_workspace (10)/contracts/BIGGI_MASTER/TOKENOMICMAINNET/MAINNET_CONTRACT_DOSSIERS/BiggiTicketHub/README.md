# BiggiTicketHub Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiTicketHub; Source=../BiggiTicketHub.sol; Abi=../CORE_ABI/BiggiTicketHub.abi.json; Role=Ticket minting and lifecycle hub for collection entries, routing into rewards and referral systems.; Delta=Mainnet package expects Main1 VRF + Main2 Public branches to feed a common scalable hub flow.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiTicketHub; Source=../BiggiTicketHub.sol; Abi=../CORE_ABI/BiggiTicketHub.abi.json; Role=Ticket minting and lifecycle hub for collection entries, routing into rewards and referral systems.; Delta=Mainnet package expects Main1 VRF + Main2 Public branches to feed a common scalable hub flow.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Ticket minting and lifecycle hub for collection entries, routing into rewards and referral systems.

## Mainnet delta vs testnet
Mainnet package expects Main1 VRF + Main2 Public branches to feed a common scalable hub flow.

## Critical integrations
- BiggiMain
- BiggiMain2
- ModeratorCenter
- BiggiTokenRewards
- BiggiCollectionRewards

## Privileged actions
- Owner controls collection authorization
- Reporters/operators can record sale events
- Metadata and pricing config updates

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
