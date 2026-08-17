# Sources Of Truth - BiggiNFT Web

Last verified: 2026-08-17

This document defines the authoritative configuration and data sources used by the frontend. Do not duplicate live values in feature components.

## 1. Active Network

- Network: Polygon mainnet.
- Chain ID: `137`.
- Explorer: `https://polygonscan.com`.
- Native currency label in UI: `POL`.

## 2. Smart-Contract Addresses

Primary source:

- `src/shared/utils/addresses.js`

Mirrors and re-exports:

- `biggi-project/bekend/addresses.json`
- `public-repo/src/shared/utils/addresses.js`
- `src/config/addresses/mainnet.js`
- `src/config/addresses/index.js`
- `src/config/addresses.js`
- `src/addresses.js`

Rules:

- Components must import addresses from the shared registry.
- Documentation may list selected live addresses for audit context, but implementation must not rely on documentation tables.
- Run `npm run check:contracts` after any address update.

Current sync check:

```bash
npm run check:contracts
```

Expected current result: 161 runtime frontend/backend keys, five chapter pairs, and seven canonical CORE ABI matches in both frontend trees. Backend-only `OLD_TICKET_HUB` is historical and intentionally absent from runtime.

## 3. ABI Definitions

Primary source:

- `src/config/abi/index.js`

ABI JSON files:

- `src/config/abi/*.json`
- `src/abis/*.json` where legacy copies are still required

Inventory:

- `ABI_INVENTORY.md`

Current ABI check:

```bash
npm run check:abis
```

Expected current result: 58 ABI files and 801 functions.

## 4. Contract Metadata Registry

Primary source:

- `src/config/contracts/index.js`

This registry maps contract keys to address keys and ABI names. Use `getContractMeta()` instead of hand-building address/ABI pairs in UI code.

All deployed chapter pairs are exposed by `CORE_CHAPTERS` / `getCoreChapter()` in `src/shared/utils/addresses.js`. `useChapterSeriesReader` must query all five current chapter IDs, not only the default `MAIN/MAIN2` pair.

## 5. RPC Configuration

Primary source:

- `src/shared/utils/rpcConfig.js`

Read RPC variables:

- `VITE_JSON_RPC_URL`
- `VITE_POLYGON_RPC_URL`
- `VITE_MOD_CHAIN_RPC`
- `VITE_ADDITIONAL_RPC_URLS`

Current built-in public fallbacks:

- `https://polygon.drpc.org`
- `https://polygon-bor-rpc.publicnode.com`

`https://polygon-rpc.com` is intentionally blocked/filtered because it returned HTTP 401 during runtime smoke testing.

## 6. Frontend Contract Factories

Primary source:

- `src/shared/utils/contract.js`

Use this file for:

- read-only providers
- signer providers
- chain enforcement
- contract factory helpers
- reader/direct fallback helpers

## 7. Frontend Data Views

Primary implementation areas:

- Gallery: `src/features`, `src/components`, and shared metadata/IPFS utilities.
- LiveStats: mainnet reader services and dashboard panels.
- Rewards: token, NFT, and collection reward panels/services.
- Tokenomics: reserve, treasury, buyback, liquidity, token, pair, and system reader panels.
- Community: Netlify/Supabase-backed chat and community contract views.

## 8. Serverless And Database Sources

Netlify routing:

- `netlify.toml`

Functions:

- `functions/nonce.js`
- `functions/message.js`
- `functions/pinFile.js`
- `functions/pinJson.js`
- `functions/admin/*`

Supabase schema:

- `sql/migration_init.sql`

Server-only secrets must remain outside frontend bundles and outside committed files.

## 9. Public Documentation Mirror

Public documentation and assets live in:

- `public-repo/`

When mainnet addresses, ABI inventory, or active network language changes, update root docs and public docs together.

## 10. Required Verification

After frontend configuration or documentation changes:

```bash
npm run build
```

After address or ABI changes:

```bash
npm run check:contracts
npm run check:abis
npm run smoke:runtime
```

Before release:

```bash
npm run lint
npm run typecheck
npm test
npm run check:rpc
```
