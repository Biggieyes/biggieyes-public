# BiggiToken Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiToken; Source=BiggiToken.sol; Abi=ABI/BiggiToken.abi.json; Role=Core BIGGI ERC20 with capped elastic mint branches for reserve, drip, and rewards continuity.; Delta=Mainnet profile hardens authority split (owner/controller/guardian) and aligns refill budgets with cap accounting.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiToken; Source=BiggiToken.sol; Abi=ABI/BiggiToken.abi.json; Role=Core BIGGI ERC20 with capped elastic mint branches for reserve, drip, and rewards continuity.; Delta=Mainnet profile hardens authority split (owner/controller/guardian) and aligns refill budgets with cap accounting.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Core BIGGI ERC20 with capped elastic mint branches for reserve, drip, and rewards continuity.

## Mainnet delta vs testnet
Mainnet profile hardens authority split (owner/controller/guardian) and aligns refill budgets with cap accounting.

## Critical integrations
- BiggiReserveV4
- BiggiDripDistributor
- BiggiTokenRewards
- BiggiSupplyController
- BiggiSupplyGuardian

## Privileged actions
- Owner sets critical addresses and pause state
- SupplyController and SupplyGuardian use bounded mint paths
- Rewards operator can trigger controlled refill helper

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
