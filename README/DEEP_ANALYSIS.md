# Deep Technical Analysis - Current Frontend State

Last verified: 2026-06-16

This document captures the current technical state of the BiggiEyes frontend after the Polygon mainnet migration. It replaces the old January analysis that referenced historical configuration and missing reader setup.

## Architecture

- Frontend: React 19, Vite, ethers v6.
- Wallets: injected providers and WalletConnect.
- Serverless: Netlify Functions.
- Chain: Polygon mainnet, `chainId 137`.
- Read layer: deployed mainnet readers plus direct read-only fallbacks where needed.
- Write layer: signer-backed ethers contracts with mainnet chain enforcement.

## Main Data Flows

### NFT Flow

1. User mints a ticket through `BiggiTicketHub`.
2. User redeems a ticket through `BiggiTicketHub`.
3. `BiggiMain` and `BiggiVrfRouter` handle VRF-driven assignment.
4. Final NFT data is read by Gallery and LiveStats from mainnet contracts/readers.

### Public Collection Flow

1. User mints through `BiggiMain2`.
2. Public collection state and pricing are read through mainnet-aware contract helpers.
3. Gallery resolves owned NFTs and metadata using mainnet-scoped caches.

### Rewards Flow

- Token rewards: `BiggiTokenRewards` plus `TOKEN_REWARDS_READER`.
- NFT rewards: `BiggiNftRewards` plus `NFT_REWARDS_READER`.
- Collection rewards: `BiggiCollectionRewards`.
- Distributor state: `BiggiMultiCollectionDistributor` plus `MCD_READER_V2`.

### Tokenomics Flow

- Token: `BIGGI`.
- Revenue routing: `DISTRIBUTOR`, `TREASURY`, `RESERVE`, `BUYBACK_AGENT`.
- DEX data: configured `PAIR` and tokenomics readers.
- Liquidity views: `LM_READER` and `LIQUIDITY_BRANCH_USER_READER`.

## Mainnet Reader Coverage

The frontend currently has deployed reader addresses for:

- main/core state
- distributor state
- token rewards
- NFT rewards
- reserve/treasury state
- buyback state
- full tokenomics summary
- tokenomics system addon state
- system state
- liquidity manager state
- liquidity branch user state

The reader layer is configured and validated by runtime smoke checks.

## Cache Policy

On-chain and metadata caches must be scoped by active chain and contract address. Current cache keys include mainnet context so old testnet metadata is not reused in the mainnet UI.

## Security Notes

- Private keys are never stored or used by the frontend.
- Users sign transactions only through their wallet provider.
- Server-only secrets must stay in Netlify/Supabase/Pinata server environments.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, Pinata secrets, or deployment keys through `VITE_*` variables.

## Operational Risks

- Public RPCs can rate-limit and may not provide full historical data.
- IPFS gateways can rate-limit; the UI must keep gateway fallback behavior.
- Netlify Functions need production secret hygiene and monitoring.
- A third-party smart-contract audit remains separate from this frontend analysis.

## Validation

Latest validation passed:

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
