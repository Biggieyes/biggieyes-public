# Audits And Reviews

This project aims to be transparent. The following frontend and integration reviews have been completed:

- 2026-06-16: Mainnet frontend documentation and integration review. Confirmed Polygon mainnet as the active chain, refreshed address/ABI documentation, and validated Gallery, LiveStats, and Rewards runtime smoke flows.
- 2026-08-17: ABI usage review. `npm run check:abis` reports 58 ABI files and 801 functions.
- 2026-08-17: Address and CORE mirror review. `npm run check:contracts` reports 161 runtime frontend/backend keys, all five chapter pairs, and 7 canonical CORE ABI matches in both frontend trees. Historical `OLD_TICKET_HUB` remains backend-only.

No independent third-party smart-contract security audit has been published in this frontend documentation set.
