# BiggiCommunityCenter Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiCommunityCenter; Source=BiggiCommunityCenter.sol; Abi=ABI/BiggiCommunityCenter.abi.json; Role=Community allocation and payout coordinator for configured destinations and incentive branches.; Delta=Mainnet setup expects deterministic branch percentages and compatibility with multi-collection revenue routing.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiCommunityCenter; Source=BiggiCommunityCenter.sol; Abi=ABI/BiggiCommunityCenter.abi.json; Role=Community allocation and payout coordinator for configured destinations and incentive branches.; Delta=Mainnet setup expects deterministic branch percentages and compatibility with multi-collection revenue routing.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Community allocation and payout coordinator for configured destinations and incentive branches.

## Mainnet delta vs testnet
Mainnet setup expects deterministic branch percentages and compatibility with multi-collection revenue routing.

## Critical integrations
- BiggiMultiCollectionDistributor
- ModeratorCenter
- Reserve/Treasury destinations

## Privileged actions
- Owner sets routes and payout shares
- Authorized sender deposits native funds
- Owner updates emergency settings

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
