# BiggiBuybackAgent Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiBuybackAgent; Source=BiggiBuybackAgent.sol; Abi=ABI/BiggiBuybackAgent.abi.json; Role=Buyback execution agent converting native liquidity into BIGGI and forwarding proceeds to treasury split logic.; Delta=Mainnet wiring hardens policy-driven limits and upkeep compatibility for deterministic buyback cadence.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiBuybackAgent; Source=BiggiBuybackAgent.sol; Abi=ABI/BiggiBuybackAgent.abi.json; Role=Buyback execution agent converting native liquidity into BIGGI and forwarding proceeds to treasury split logic.; Delta=Mainnet wiring hardens policy-driven limits and upkeep compatibility for deterministic buyback cadence.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Buyback execution agent converting native liquidity into BIGGI and forwarding proceeds to treasury split logic.

## Mainnet delta vs testnet
Mainnet wiring hardens policy-driven limits and upkeep compatibility for deterministic buyback cadence.

## Critical integrations
- BiggiPolicy
- BiggiTreasury
- DEX router
- BuybackUpkeepProxy

## Privileged actions
- Owner sets keeper and policy dependencies
- Keeper/automation can execute scheduled buyback
- Owner emergency pause/rescue

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
