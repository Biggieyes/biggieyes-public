# Deployment

This project is designed for static hosting plus serverless functions.

## Prereqs
- Node 18.18+ and npm.
- A Polygon mainnet RPC endpoint (or mainnet if you deploy there).
- Supabase project for chat (optional).
- Pinata account for IPFS pinning (optional).

## Build
1. Install deps: `npm ci`
1. Build: `npm run build`

## Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `functions`

## Environment variables

Client (public, Vite)
- VITE_POLYGON_RPC_URL or VITE_JSON_RPC_URL
- VITE_WC_PROJECT_ID
- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- VITE_CHAT_API_BASE (if using external API)
- VITE_IPFS_GATEWAY_URL or VITE_PINATA_GATEWAY_BASE_URL (optional)

Serverless (private)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- PINATA_JWT or PINATA_API_KEY and PINATA_SECRET_API_KEY
- PINATA_GATEWAY_BASE_URL (optional)
- NFT_STORAGE_KEY and ENABLE_NFT_STORAGE_BACKUP (optional)
- REDIS_URL (optional)
- ALLOWED_ORIGIN
- CHAT_OWNER_ADDRESS

## Supabase setup
1. Run `sql/migration_init.sql` in the Supabase SQL editor.
1. Set CHAT_OWNER_ADDRESS to your admin wallet.
1. Make sure RLS policies are enabled as in the SQL script.

## Pinning setup
- Use Pinata for primary pinning.
- Optionally enable NFT.Storage backup with ENABLE_NFT_STORAGE_BACKUP=true.

## Production checklist
- Use dedicated RPC endpoints.
- Rotate and store secrets in your hosting provider.
- Enable secret scanning in CI.
