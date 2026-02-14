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
- Default network: Polygon Amoy testnet (chainId 80002).
- Mainnet support can be added by updating addresses and RPC config.
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

## Contributing
See CONTRIBUTING.md.

## Security
See SECURITY.md.

## License
MIT. See LICENSE.
