# BIGGIEYES

BIGGIEYES is a Polygon-based Web3 NFT ecosystem that combines ticket minting, verifiable randomness, multi-collection NFT issuance, on-chain tokenomics, automated liquidity management, and community reward rails into a single transparent protocol stack.

The repository contains the frontend application, address registry, deployment scripts, contract artifacts, reader contracts, and protocol documentation for the BIGGIEYES ecosystem. The current public registry in this repo targets Polygon mainnet as the active deployment environment.

## Key Features

- NFT ticket minting with either native gas token or BIGGI token settlement
- Chainlink VRF-powered redemption for fair NFT assignment
- Dual-collection architecture with a VRF collection and a public collection
- Dynamic ticket pricing plus block-based public mint pricing
- Fixed on-chain revenue routing into rewards, reserve, buybacks, treasury, and community pools
- BIGGI tokenomics with capped supply, treasury redistribution, and weekly holder rewards
- Liquidity reserve, liquidity manager, and liquidity vault for protocol-owned LP custody
- Buyback automation with policy guardrails and treasury split logic
- Collection completion rewards and community event payouts
- Reader-first frontend integration for high transparency and low RPC overhead

## Ecosystem Overview

| Layer | Main Components | Role |
| --- | --- | --- |
| NFT Core | `BiggiEyesMain`, `BiggiEyesMain2`, `VRFRouter` | Ticket minting, redemption, public mints, metadata assignment |
| Distribution | `Distributor`, `CollectionRewards`, `CommunityCenter` | Routes mint revenue to protocol sinks and community programs |
| Tokenomics | `BiggiToken`, `TokenRewards`, `Treasury`, `Reserve` | BIGGI supply, weekly rewards, reserve accounting, treasury routing |
| Market Operations | `BuybackAgent`, `DripDistributor`, `DripLiquidityManager` | Buybacks, drip accounting, token-to-native recycling |
| Liquidity | `LiquidityManager`, `LiquidityVault` | Reserve pairing, LP minting, LP custody |
| Read Layer | Readers, frontend hooks, transparency services | Snapshot aggregation, dashboards, operational monitoring |

## Documentation Map

### Core Protocol

- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TOKENOMICS.md](./TOKENOMICS.md)
- [NFT_SYSTEM.md](./NFT_SYSTEM.md)
- [SMART_CONTRACTS.md](./SMART_CONTRACTS.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [TRUST_AND_TRANSPARENCY.md](./TRUST_AND_TRANSPARENCY.md)

### Frontend And Developer Docs

- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [GLOSSARY.md](./GLOSSARY.md)

### Strategy And Narrative

- [WHITEPAPER.md](./WHITEPAPER.md)
- [LITEPAPER.md](./LITEPAPER.md)
- [ROADMAP.md](./ROADMAP.md)
- [INVESTOR_OVERVIEW.md](./INVESTOR_OVERVIEW.md)
- [PITCH_DECK.md](./PITCH_DECK.md)

### Operational References

- [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)
- [USER_FLOWS.md](./USER_FLOWS.md)
- [VISUAL_DIAGRAM_PROMPTS.md](./VISUAL_DIAGRAM_PROMPTS.md)

### Marketing Materials

- [WEBSITE_DESCRIPTION.md](./WEBSITE_DESCRIPTION.md)
- [SOCIAL_MEDIA_SUMMARY.md](./SOCIAL_MEDIA_SUMMARY.md)
- [ELEVATOR_PITCH.md](./ELEVATOR_PITCH.md)

## Repository Notes

- Frontend stack: React 19, Vite, ethers v6, WalletConnect, Netlify functions
- Chain environment in current repo registry: Polygon mainnet (`chainId 137`)
- Canonical frontend address map: `src/shared/utils/addresses.js`
- Backend mirror of deployed addresses: `biggi-project/bekend/addresses.json`
- Contract artifacts and sources: `biggi-project/bekend`

## Quick Start

```bash
npm ci
cp .env.example .env.local
npm run dev
```

For environment details, deployment order, and contract wiring, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
