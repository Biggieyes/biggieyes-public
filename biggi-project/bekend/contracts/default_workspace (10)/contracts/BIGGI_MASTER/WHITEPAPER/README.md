# BIGGI Technical Whitepapers

Version: 1.0
State snapshot: Polygon PoS mainnet, 2026-08-27

This directory contains the contract-grounded technical whitepapers for the
deployed BIGGI protocol. English and Czech documents are maintained as paired
versions and must preserve the same formulas, limits, addresses, and status
qualifiers.

## Documents

- [CORE whitepaper - English](BIGGI_CORE_WHITEPAPER_EN.md)
- [CORE whitepaper - Czech](BIGGI_CORE_WHITEPAPER_CS.md)
- [Tokenomics whitepaper - English](BIGGI_TOKENOMICS_WHITEPAPER_EN.md)
- [Tokenomics whitepaper - Czech](BIGGI_TOKENOMICS_WHITEPAPER_CS.md)

## Interpretation rules

1. Solidity and live Polygon reads override prose if a later deployment or
   configuration transaction changes the system.
2. "Contract rule" means behavior enforced by the deployed bytecode.
3. "Current configuration" means an owner-adjustable value read from Polygon
   at the snapshot date.
4. "Planned" or "staged" behavior is not presented as active production
   behavior.
5. Rewards, buybacks, liquidity actions, and marketplace prices are not
   guarantees of profit, value, availability, or execution.

## Canonical technical sources

- [`../CORE/CORE_MAINNET_REAL_DATA.md`](../CORE/CORE_MAINNET_REAL_DATA.md)
- [`../CORE/CORE_ARCHITECTURE_CS.md`](../CORE/CORE_ARCHITECTURE_CS.md)
- [`../TOKENOMICMAINNET/BIGGI_MASTER_SOURCE_OF_TRUTH_CS.md`](../TOKENOMICMAINNET/BIGGI_MASTER_SOURCE_OF_TRUTH_CS.md)
- [`../TOKENOMICMAINNET/MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md`](../TOKENOMICMAINNET/MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md)
- [`../../../../../addresses.master.json`](../../../../../addresses.master.json)
- Solidity sources under [`../CORE`](../CORE) and
  [`../TOKENOMICMAINNET`](../TOKENOMICMAINNET)

Read-only verification commands are listed in each whitepaper.
