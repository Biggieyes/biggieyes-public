# Architecture

## High level
The app is a React and Vite frontend that talks to:
- Read-only RPC providers for on-chain data.
- Wallet injected providers for signed transactions.
- Netlify functions for chat and IPFS pinning.
- Supabase for chat storage and moderation.

## Frontend layout
- `src/app` for the main application shell and orchestration.
- `src/features` for large UI panels and feature areas.
- `src/components` for reusable UI pieces.
- `src/shared` for services, utils, ABIs, and styles.
- `src/config` for chain and ABI configuration.

## On-chain configuration
- Addresses: `src/shared/utils/addresses.js` and `src/config/addresses/*`.
- ABIs: `src/config/abi/index.js` and `src/config/abi/*.json`.
- Inventory: `ABI_INVENTORY.md`.

## Data flow
- Read paths use read-only providers with RPC fallback.
- Write paths require a wallet and explicit user signature.
- Reader contracts provide fast snapshots for dashboards.

## IPFS flow
- Media and metadata are served from IPFS.
- The UI uses gateway fallback to improve availability.
- Pinning is done via serverless functions.

## Serverless functions
- `functions/pinFile.js` and `functions/pinJson.js` handle IPFS pinning.
- `functions/nonce.js` and `functions/message.js` support signed chat.
- Admin actions use Supabase service role keys on the server only.
