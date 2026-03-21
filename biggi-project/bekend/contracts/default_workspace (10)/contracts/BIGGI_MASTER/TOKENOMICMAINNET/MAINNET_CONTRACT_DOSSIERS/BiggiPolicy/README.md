# BiggiPolicy Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiPolicy; Source=BiggiPolicy.sol; Abi=ABI/BiggiPolicy.abi.json; Role=Global risk-policy registry for slippage, deadline, cadence, and daily buyback quotas.; Delta=Mainnet policy adds explicit daily quota accounting and emergency pause semantics for buyback flow.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiPolicy; Source=BiggiPolicy.sol; Abi=ABI/BiggiPolicy.abi.json; Role=Global risk-policy registry for slippage, deadline, cadence, and daily buyback quotas.; Delta=Mainnet policy adds explicit daily quota accounting and emergency pause semantics for buyback flow.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Global risk-policy registry for slippage, deadline, cadence, and daily buyback quotas.

## Mainnet delta vs testnet
Mainnet policy adds explicit daily quota accounting and emergency pause semantics for buyback flow.

## Critical integrations
- BiggiBuybackAgent
- BiggiTreasury
- Automation upkeeps

## Privileged actions
- Owner updates slippage/deadline/interval
- Owner can pause buyback policy
- Owner sets daily native quota

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
