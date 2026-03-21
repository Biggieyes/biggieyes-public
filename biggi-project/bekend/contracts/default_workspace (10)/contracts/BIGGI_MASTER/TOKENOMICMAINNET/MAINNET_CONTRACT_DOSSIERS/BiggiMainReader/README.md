# BiggiMainReader Mainnet Dossier

## Source of truth
- Source: $(@{Name=BiggiMainReader; Source=BiggiMainReader.sol; Abi=ABI/BiggiMainReader.abi.json; Role=Primary read aggregator for frontend/backoffice checks across ticketing, rewards, and tokenomics links.; Delta=Mainnet read layer standardizes observability and reduces custom RPC stitching in clients.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=BiggiMainReader; Source=BiggiMainReader.sol; Abi=ABI/BiggiMainReader.abi.json; Role=Primary read aggregator for frontend/backoffice checks across ticketing, rewards, and tokenomics links.; Delta=Mainnet read layer standardizes observability and reduces custom RPC stitching in clients.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Primary read aggregator for frontend/backoffice checks across ticketing, rewards, and tokenomics links.

## Mainnet delta vs testnet
Mainnet read layer standardizes observability and reduces custom RPC stitching in clients.

## Critical integrations
- BiggiMain
- BiggiMain2
- BiggiTicketHub
- Tokenomics readers

## Privileged actions
- Read-only contract
- Owner-like mutable privileges should remain absent
- Any write path is considered regression

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
