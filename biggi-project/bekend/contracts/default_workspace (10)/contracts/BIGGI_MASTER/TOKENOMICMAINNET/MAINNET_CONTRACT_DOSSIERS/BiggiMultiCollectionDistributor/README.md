# BiggiMultiCollectionDistributor Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiMultiCollectionDistributor; Source=../BiggiMultiCollectionDistributor.sol; Abi=../CORE_ABI/BiggiMultiCollectionDistributor.abi.json; Role=Revenue dispatcher for multi-collection ecosystem, routing native flows to configured protocol branches.; Delta=Mainnet uses this as scalable bridge between collection sales and tokenomics/community buckets.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiMultiCollectionDistributor; Source=../BiggiMultiCollectionDistributor.sol; Abi=../CORE_ABI/BiggiMultiCollectionDistributor.abi.json; Role=Revenue dispatcher for multi-collection ecosystem, routing native flows to configured protocol branches.; Delta=Mainnet uses this as scalable bridge between collection sales and tokenomics/community buckets.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Revenue dispatcher for multi-collection ecosystem, routing native flows to configured protocol branches.

## Mainnet delta vs testnet
Mainnet uses this as scalable bridge between collection sales and tokenomics/community buckets.

## Critical integrations
- BiggiCommunityCenter
- ModeratorCenter
- BiggiTreasury
- Reserve/Treasury destinations

## Privileged actions
- Owner sets branch percentages and receivers
- Authorized collection contracts trigger distribution
- Owner emergency route controls

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
