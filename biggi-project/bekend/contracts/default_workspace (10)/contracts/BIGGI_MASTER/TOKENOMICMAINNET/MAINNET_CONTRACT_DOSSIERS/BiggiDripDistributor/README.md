# BiggiDripDistributor Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiDripDistributor; Source=BiggiDripDistributor.sol; Abi=ABI/BiggiDripDistributor.abi.json; Role=Drip inventory ledger and payout engine for token drip allocations across enabled collections/operators.; Delta=Mainnet alignment adds historical state seeding, explicit available-vs-balance sync, and cap-safe refill semantics.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiDripDistributor; Source=BiggiDripDistributor.sol; Abi=ABI/BiggiDripDistributor.abi.json; Role=Drip inventory ledger and payout engine for token drip allocations across enabled collections/operators.; Delta=Mainnet alignment adds historical state seeding, explicit available-vs-balance sync, and cap-safe refill semantics.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Drip inventory ledger and payout engine for token drip allocations across enabled collections/operators.

## Mainnet delta vs testnet
Mainnet alignment adds historical state seeding, explicit available-vs-balance sync, and cap-safe refill semantics.

## Critical integrations
- BiggiToken
- BiggiDripLMToModerator
- BiggiTreasury
- BiggiSupplyController

## Privileged actions
- Owner configures collection and treasury endpoints
- Authorized mint notifier increases tracked availability
- Operators tune per-mint emission

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
