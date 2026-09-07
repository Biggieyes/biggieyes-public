# Deployment Checklist (Netlify)

Use this list before each production deploy.

## Preflight

- Confirm current branch/tag and commit hash.
- Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Run `npm run check:abis` and `npm run check:contracts` after ABI/address changes.
- Run `npm run check:rpc` and confirm at least two fresh primary RPC hostnames on Polygon mainnet (137).

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
- Run RPC health check: `node scripts/check-rpc-health.mjs`

## RPC Health monitoring

- `.github/workflows/rpc-health.yml` runs hourly or via `workflow_dispatch`. It only reads RPC state; it does not deploy, sign transactions or invoke keepers.
- No secrets are required for the public-only check: dRPC, PublicNode and 1RPC are built-in fallbacks. At least two fresh, distinct primary hostnames must pass. Different paths/keys on the same host do not count as independent hosts.
- Optional GitHub repository secrets for the actual production endpoints: `VITE_JSON_RPC_URL`, `VITE_POLYGON_RPC_URL`, `VITE_RPC_URL_POLYGON`, `VITE_RPC_URL_ACTIVE_CHAIN`, `VITE_MAINNET_RPC_URL`, `VITE_MOD_CHAIN_RPC`, `VITE_ADDITIONAL_RPC_URLS`, `VITE_INFURA_PROJECT_ID`, `VITE_ARCHIVE_RPC_URL`, `VITE_ARCHIVE_RPC_URLS`. Set only the ones in use; Netlify variables are not automatically available to GitHub Actions.
- Non-sensitive GitHub repository variables: `VITE_RPC_HEALTH_TIMEOUT_MS` (default `6000`, positive integer milliseconds), `VITE_RPC_MAX_STALE_BLOCKS` (default `16`, non-negative integer), `RPC_HEALTH_STRICT` (default `0`), `RPC_HEALTH_INCLUDE_ARCHIVE` (default `1`). Flags accept only `0` or `1`. These four settings no longer read GitHub secrets.
- The workflow fixes `RPC_EXPECTED_CHAIN_ID=137` and `RPC_HEALTH_MIN_HEALTHY=2`. The local CLI accepts a positive integer minimum, but rejects a malformed or non-mainnet chain ID, including a conflicting `VITE_CHAIN_ID`. Empty settings use defaults; malformed nonempty settings fail before probing endpoints.
- Archive endpoints are optional and cannot satisfy the primary-host minimum. Their probe checks chain ID and current block height only, not historical-state availability. With strict mode off, individual failed/stale endpoints are reported but tolerated if the primary minimum passes. Strict mode fails on any failed/stale endpoint.
- Each endpoint must support HTTP(S) JSON-RPC `eth_chainId` and `eth_blockNumber`. Freshness is relative to the highest returned block, not an independent wall-clock freshness guarantee. The configured timeout applies to each operation; HTTP 429 is reported without throttle retries.
- Output includes hostnames and safe error codes only, never private URL paths, query strings or provider response bodies. HTTP 401/402/403/429 may indicate credentials, access policy, billing or quota issues; check the provider dashboard rather than guessing from the status alone.
- For local checks, export the needed variables before `npm run check:rpc`; the script does not load `.env` automatically. Do not print secrets while troubleshooting.
- If a job has no runner or steps and reports an account billing lock, the failure is before this check. Repository edits cannot unlock GitHub Actions. Resolve the account issue with GitHub; deployed Netlify services and on-chain contracts are not directly stopped by this monitoring failure.

## Rollback plan

- Keep the last known-good deploy in Netlify.
- If a critical bug appears, redeploy the previous build.
