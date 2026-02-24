# Deployment Checklist (Netlify)

Use this list before each production deploy.

## Preflight
- Confirm current branch/tag and commit hash.
- Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Run `npm run check:abis` and `npm run check:contracts` after ABI/address changes.
- Run `npm run check:rpc` and confirm at least one healthy endpoint.

## Secrets and environment
- Set Netlify environment variables (do not commit secrets):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CHAT_OWNER_ADDRESS`
  - `ALLOWED_ORIGIN` (your production domain)
  - `PINATA_API_KEY` / `PINATA_SECRET_API_KEY` or `PINATA_JWT`
  - `PINATA_GATEWAY_BASE_URL` (optional)
  - `ENABLE_NFT_STORAGE_BACKUP` + `NFT_STORAGE_KEY` (optional)
  - `SENTRY_DSN` (functions, optional)
  - `SENTRY_TRACES_SAMPLE_RATE` (functions, optional)
  - `VITE_SENTRY_DSN` (frontend, optional)
  - `VITE_SENTRY_TRACES_SAMPLE_RATE` (frontend, optional)
  - All `VITE_ADDR_*` contract addresses and RPC URLs
- Rotate any leaked keys immediately and purge from git history.

## Netlify settings
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `functions`
- Ensure `netlify.toml` is present and correct.

## Post-deploy
- Open the app and validate:
  - Wallet connect and chain switching
  - Mint / redeem / claim flows
  - Gallery loads and images resolve
  - Chat nonce/message flow works
  - Admin moderation flows (if enabled)
- Check Sentry for new errors.
- Run RPC health check: `node scripts/check-rpc-health.js`

## Rollback plan
- Keep the last known-good deploy in Netlify.
- If a critical bug appears, redeploy the previous build.
