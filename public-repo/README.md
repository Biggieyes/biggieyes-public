# BiggiEyes

BiggiEyes is a gamified on-chain NFT experience with verifiable randomness, dynamic pricing, and a transparent tokenomics dashboard. The app reads live data directly from contracts and provides a unified UI for minting, redeeming, rewards, liquidity, treasury, and community features.

## Why users can trust this
- Verifiable randomness: NFT outcomes are driven by VRF, not by the UI.
- On-chain transparency: prices, mint counts, and rewards are read from contracts.
- Open source: client and serverless code are fully visible.
- Clear risk disclosure: see docs/RISK_DISCLOSURE.md.

## Product highlights
- Ticket mint -> redeem -> VRF -> NFT flow.
- Dynamic block pricing with visible base vs live price.
- Live dashboards for rewards, buyback, liquidity, reserve, and treasury.
- IPFS backed media with gateway fallback.
- Optional live chat with moderation tools.

## Status and networks
- Active network: Polygon mainnet (chainId 137).
- Mainnet addresses and RPC configuration are already wired through the shared registry.
- No financial advice. Read legal/TERMS.md and docs/RISK_DISCLOSURE.md.

## Quickstart
1. Install dependencies: `npm ci`
1. Start the app: `npm run dev`
1. Run Netlify functions locally: `npm run dev:netlify`

## Environment
- Copy `.env.example` to `.env.local` and fill the values you need.
- Do not commit secrets or service keys.

## Deployment (Netlify)
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `functions`
- Full checklist: docs/DEPLOYMENT.md

## Chainlink and CRE
- Chainlink file index (full linked list): docs/chainlink-file-index.md
- CRE workflow definition: cre/workflows/biggieyes-vrf-postredeem.workflow.yaml
- CRE simulation script (dry-run or CLI mode): scripts/cre/simulate-cre-workflow.mjs
- CRE evidence outputs: evidence/cre-simulation/
- CRE initialized project (CLI): ../biggieeyes/
- Successful CLI simulation evidence: evidence/cre-simulation/cre-cli-success-latest.md

Run a local CRE dry-run evidence snapshot:
1. `node scripts/cre/simulate-cre-workflow.mjs --dry-run`
2. Open the newest file in `evidence/cre-simulation/`

## Submission
- Submission checklist: submission.md
- Sponsor prize checklist: docs/sponsor-prize-checklist.md

## Contributing
See CONTRIBUTING.md.

## Security
See SECURITY.md.

## License
MIT. See LICENSE.
