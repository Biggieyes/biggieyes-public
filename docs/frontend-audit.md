# Frontend Audit - Current Mainnet State

Last verified: 2026-08-17

This document is the active frontend audit note for the repository. It supersedes the old January analysis that referenced pre-mainnet reader gaps and historical branches.

## Scope

- React/Vite frontend under `src/`.
- Mainnet address registry and ABI exports.
- Gallery, LiveStats, Rewards, tokenomics, and ecosystem panel data flow.
- Netlify function integration at documentation level.
- Public frontend mirror documentation under `public-repo/`.

## Verified Mainnet State

- Active chain: Polygon mainnet, `chainId 137`.
- Canonical address map: `src/shared/utils/addresses.js`.
- Backend mirror: `biggi-project/bekend/addresses.json`.
- ABI export entry: `src/config/abi/index.js`.
- ABI inventory: 58 ABI files, 801 functions.
- Address sync: 161 runtime frontend/backend keys; historical `OLD_TICKET_HUB` remains backend-only.
- CORE sync: five chapter pairs and seven critical ABI snapshots match backend canonical sources.
- Runtime smoke: Gallery, LiveStats, and Rewards passed.

## Current Reader Coverage

Configured reader keys used by the frontend:

- `MAIN_READER`
- `CHAPTER_SERIES_READER`
- `MCD_READER_V2`
- `NFT_REWARDS_READER`
- `TOKEN_REWARDS_READER`
- `RESERVE_TREASURY_READER`
- `BUYBACK_READER`
- `BIGGI_TOKENOMICS_READER`
- `TOKENOMICS_SYSTEM_ADDON_READER`
- `SYSTEM_READER`
- `LM_READER`
- `LIQUIDITY_BRANCH_USER_READER`

The previous missing-reader recommendation is no longer current.

## Data Flow Findings

- Gallery reads ownership and metadata through mainnet-aware services and scoped cache keys.
- LiveStats reads from deployed mainnet readers and direct read-only fallbacks where no specialized reader exists.
- Rewards panels use token, NFT, and collection rewards contracts/readers configured in the mainnet registry.
- Tokenomics panels use reserve, treasury, buyback, LM, system, pair, and token readers from the current registry.
- Write flows use signer-backed contract factories and Polygon mainnet enforcement.

## RPC Findings

- Active public fallbacks are `https://polygon.drpc.org` and `https://polygon-bor-rpc.publicnode.com`.
- `https://polygon-rpc.com` is kept only as a blocked/problematic host in RPC config, not as an active default.
- Production traffic should use a reliable private or paid Polygon RPC.

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run check:contracts
npm run check:abis
npm run check:rpc
npm run smoke:runtime
```

## Remaining Operational Notes

- Keep server-only secrets out of `VITE_*` variables and out of committed files.
- Run `npm run check:contracts` whenever deployed addresses change.
- Run `npm run check:abis` whenever ABI JSON files or contract calls change.
- Treat this as frontend integration validation, not a replacement for an independent smart-contract audit.
