# Security Model

## Goals
- Keep private keys and service secrets off the client.
- Make critical data verifiable on chain.
- Limit abuse of public endpoints.

## Key handling
- Wallet private keys never leave the wallet.
- Service keys (Supabase service role, Pinata, NFT.Storage) are server-only env vars.
- Client env vars (VITE_*) are public by design.

## Threat model
- RPC outages or stale data: use multiple RPCs and health checks.
- VRF delays: UI shows pending state, no unsafe fallback.
- IPFS availability: use gateway fallback and retries.
- Abuse of pin endpoints: rate limit with Redis or gateway rules.

## Recommended controls
- Use ALLOWED_ORIGIN to restrict function calls.
- Enable Redis rate limiting with REDIS_URL.
- Rotate secrets and run secret scanning in CI.
- Use multisig for admin roles and document ownership.

## Logging and monitoring
- Serverless functions should log errors without leaking secrets.
- Avoid storing personal data beyond what is required for chat moderation.
