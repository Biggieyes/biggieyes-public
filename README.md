# BiggiEyes Frontend

Frontend for BiggiEyes (React + Vite) with Netlify functions for chat and IPFS pinning.

## Links
- Whitepaper: docs/whitepaper.md
- Explorer: https://amoy.polygonscan.com
- Roadmap: docs/roadmap.md

## Quickstart
1. npm ci
2. Copy .env.example to .env.local and fill values
3. npm run dev
4. (Optional) netlify dev

## Common scripts
- npm run dev
- npm run build
- npm run lint
- npm run typecheck
- npm run test
- npm run check:abis
- npm run check:contracts
- npm run check:rpc

## Environment
Use .env.local locally. Do not commit secrets.

Frontend:
- VITE_* values for contract addresses and RPC URLs
- VITE_SENTRY_DSN (optional)
- VITE_SENTRY_TRACES_SAMPLE_RATE (optional)

Functions:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- CHAT_OWNER_ADDRESS
- ALLOWED_ORIGIN
- PINATA_* (see docs/README_PINNING.md)
- SENTRY_DSN (optional)
- SENTRY_TRACES_SAMPLE_RATE (optional)

## Deployment (Netlify)
- Build command: npm run build
- Publish dir: dist
- Functions dir: functions
See docs/deployment-checklist.md for full steps.

## Monitoring
Sentry is optional. Set VITE_SENTRY_DSN (frontend) and SENTRY_DSN (functions).
RPC health checks: node scripts/check-rpc-health.mjs

## Docs
- docs/system-spec.md
- docs/testing-strategy.md
- docs/frontend-audit.md
- docs/README_PINNING.md
- docs/abi-audit.md
- docs/deployment-checklist.md

## Chainlink and CRE
- Chainlink file index (full linked list): docs/chainlink-file-index.md
- CRE workflow definition: cre/workflows/biggieyes-vrf-postredeem.workflow.yaml
- CRE simulation script (dry-run or CLI mode): scripts/cre/simulate-cre-workflow.mjs
- CRE evidence outputs: evidence/cre-simulation/
- CRE initialized project (CLI): biggieeyes/
- Successful CLI simulation evidence: evidence/cre-simulation/cre-cli-success-latest.md

Run a local CRE dry-run evidence snapshot:
1. node scripts/cre/simulate-cre-workflow.mjs --dry-run
2. Open the newest file in evidence/cre-simulation/

## Submission
- Submission checklist: submission.md
- Sponsor prize checklist: docs/sponsor-prize-checklist.md
