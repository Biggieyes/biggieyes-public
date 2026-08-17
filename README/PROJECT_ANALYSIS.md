# Project Analysis - Current Frontend State

Last verified: 2026-08-17

This document summarizes the current frontend architecture, dependencies, environment requirements, troubleshooting paths, and operational checks for the BiggiEyes Polygon mainnet application.

## Short Description

The app is a React/Vite Web3 frontend for NFT ticket minting, VRF redemption, collection rewards, BIGGI token rewards, tokenomics transparency, liquidity, buyback, reserve, treasury, gallery, and community views. It uses ethers v6 for blockchain access, WalletConnect/injected wallets for signing, and Netlify Functions for chat and IPFS pinning support.

## Main Directories

- `src/`: frontend application, components, hooks, services, and Web3 utilities.
- `src/app/`: main application shell and panel orchestration.
- `src/features/`: larger feature panels.
- `src/shared/utils/addresses.js`: canonical frontend contract address registry.
- `src/shared/utils/contract.js`: read/write contract factories and provider helpers.
- `src/shared/utils/rpcConfig.js`: RPC selection and filtering.
- `src/config/abi/`: JSON ABI files.
- `functions/`: Netlify Functions for nonce/message/admin/pinning flows.
- `public-repo/`: public mirror docs and client assets.

## Active Network

- Network: Polygon mainnet.
- Chain ID: `137`.
- Native currency label in UI: `POL`.
- Explorer: `https://polygonscan.com`.

The active frontend supports only Polygon mainnet; any other chain ID is rejected without an address fallback.

## Contract And ABI Sources

- Canonical frontend addresses: `src/shared/utils/addresses.js`.
- Backend mirror: `biggi-project/bekend/addresses.json`.
- ABI exports: `src/config/abi/index.js`.
- ABI JSON files: `src/config/abi/*.json`.
- Contract metadata registry: `src/config/contracts/index.js`.

Current checks:

- `npm run check:contracts`: 161 runtime frontend/backend keys, five chapters and seven canonical CORE ABI comparisons; historical `OLD_TICKET_HUB` is excluded.
- `npm run check:abis`: 58 ABI files and 801 functions.

## External Services

- Polygon RPC: read-only chain access.
- WalletConnect: wallet sessions and mobile/desktop connection.
- Supabase: chat messages, nonces, moderation state.
- Netlify Functions: server-side chat/admin/pinning endpoints.
- Pinata/IPFS: NFT media and metadata pinning.
- Optional nft.storage fallback for pinning.

## Environment Checklist

Frontend/public variables:

- `VITE_JSON_RPC_URL`
- `VITE_POLYGON_RPC_URL`
- `VITE_ADDITIONAL_RPC_URLS`
- `VITE_DEFAULT_CHAIN_ID`
- `VITE_WC_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CHAT_API_BASE`

Server-only variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PINATA_API_KEY`
- `PINATA_SECRET_API_KEY`
- `PINATA_JWT`
- `NFT_STORAGE_KEY`
- `ALLOWED_ORIGIN`

Do not place server-only keys in `VITE_*` or `NEXT_PUBLIC_*` variables.

## RPC Notes

Active public fallbacks:

- `https://polygon.drpc.org`
- `https://polygon-bor-rpc.publicnode.com`

`https://polygon-rpc.com` is filtered by runtime config because it returned HTTP 401 during smoke testing. For production traffic, use a private or paid Polygon RPC.

## Troubleshooting

If a panel shows stale or empty chain data:

1. Run `npm run check:contracts`.
2. Run `npm run check:abis`.
3. Run `npm run check:rpc`.
4. Run `npm run smoke:runtime`.
5. Confirm the browser is on Polygon mainnet (`chainId 137`).

If a Netlify function returns `500`:

- Check server-only environment variables in Netlify.
- Do not expose service role keys to the frontend.
- Inspect Netlify function logs.

If IPFS media does not load:

- Check gateway fallback behavior in `src/shared/utils/ipfs.js`.
- Confirm metadata URI format from the mainnet contracts.
- Confirm public gateways are not rate-limiting.

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

## Current Residual Risks

- Public RPC providers can rate-limit or prune history.
- Pinning endpoints need strict server-side secrets and operational rate limiting.
- High-value launch should still include independent smart-contract and infrastructure review.
