# Frontend Integration

Last verified: 2026-06-16

This document records how the frontend is currently wired to the Polygon mainnet protocol. It intentionally avoids planned or historical testnet behavior.

## Active Network

- Active chain: Polygon mainnet.
- Required chain ID: `137`.
- Native currency label in UI: `POL`.
- Explorer: `https://polygonscan.com`.
- Testnet address files and Amoy/Mumbai/Sepolia references are not part of the active frontend path.

## Wallet Connection

Supported modes:

- injected browser wallets
- WalletConnect desktop QR and mobile deep links

Current implementation:

- injected provider, signer provider, chain enforcement, and contract factories: `src/shared/utils/contract.js`
- WalletConnect bootstrap: `src/wallet/wc.js`
- chain metadata: `src/config/chains.js`

Expected write flow:

1. user selects a write action
2. frontend confirms a wallet provider and active account
3. frontend enforces Polygon mainnet
4. signer-backed contract factory is created
5. transaction is estimated where practical
6. transaction status is displayed until mined or failed

## RPC Providers

Read RPCs come from:

- `VITE_JSON_RPC_URL`
- `VITE_POLYGON_RPC_URL`
- `VITE_MOD_CHAIN_RPC`
- `VITE_ADDITIONAL_RPC_URLS`
- built-in public fallbacks

Current built-in public fallbacks:

- `https://polygon.drpc.org`
- `https://polygon-bor-rpc.publicnode.com`

`https://polygon-rpc.com` is intentionally filtered because runtime smoke testing observed HTTP 401 responses from that endpoint.

The app normally uses the first healthy static JSON-RPC provider. ethers `FallbackProvider` is opt-in only:

```env
VITE_ENABLE_ETHERS_FALLBACK_PROVIDER=1
```

## Read Interactions

The frontend prefers reader contracts and snapshot services:

- `MAIN_READER` for ticket and collection state
- `MCD_READER_V2` for distributor/rewards routing state
- `TOKEN_REWARDS_READER` and token rewards service for claim preview
- `NFT_REWARDS_READER` and NFT rewards service for assigned reward state
- `RESERVE_TREASURY_READER`, `BUYBACK_READER`, `BIGGI_TOKENOMICS_READER`, and system readers for tokenomics panels
- direct DRIP, LM, reserve, treasury, token, and pair reads where no separate reader is configured

Reads must import factories from `src/shared/utils/contract.js` and addresses from `src/shared/utils/addresses.js`.

## Write Interactions

Current user-facing write paths:

| User action | Contract path used by frontend |
| --- | --- |
| Mint ticket with native token | `BiggiTicketHub.mintTicket` |
| Mint ticket with BIGGI | `BiggiTicketHub.mintTicketWithBiggi` where supported |
| Redeem ticket | `BiggiTicketHub.redeemTicket` |
| Mint public NFT | `BiggiMain2.mintPublic` |
| Mint public NFT with BIGGI | `BiggiMain2.mintPublicWithBiggi` |
| Claim weekly token rewards | `BiggiTokenRewards.claim` or `claimWithCollections` |
| Claim collection block reward | `BiggiCollectionRewards.claimBlockReward` |
| Claim collection orange reward | `BiggiCollectionRewards.claimOrangeReward` |
| Claim collection rainbow reward | `BiggiCollectionRewards.claimRainbowReward` |
| Claim assigned NFT reward | `BiggiNftRewards.claim` |
| Claim community event reward | `BiggiCommunityCenter.claim` |

Write logic must stay behind explicit UI actions. Components should receive callbacks from the app shell/services rather than instantiating write contracts ad hoc.

## Gallery And Metadata

The gallery is mainnet-scoped:

- session cache includes chain ID and contract address
- memory cache is split for `MAIN` and `MAIN2`
- token URI, metadata, and image caches are versioned after mainnet migration
- old testnet cache payloads are ignored

Primary file: `src/components/Gallery.jsx`.

## LiveStats

LiveStats reads current mainnet data and avoids stale fallback images:

- active cache scope includes chain ID and collection contract
- last minted cache is accepted only when chain ID and contract address match the current deployment
- if on-chain supply is zero or unavailable, the UI uses placeholders instead of old cached NFT metadata

Primary file: `src/components/LiveStats.jsx`.

## Rewards

Rewards UI combines three rails:

- token rewards: weekly BIGGI claim preview and claim action
- collection rewards: block, orange, and rainbow claim checks/actions
- NFT rewards: assigned reward visibility and claim state

Primary files:

- `src/features/rewards/REWARDSPanel.jsx`
- `src/shared/services/tokenRewardsService.js`
- `src/shared/services/collectionRewardsService.js`
- `src/shared/services/nftRewardsService.js`

## Error Handling

The integration layer distinguishes:

- wallet rejection and missing wallet
- wrong chain
- RPC rate limit or unavailable endpoint
- contract revert
- stale or partial reader response
- missing optional address with configured fallback

User-facing errors should be actionable. Console-only errors are acceptable only for low-level diagnostics already surfaced through UI state.

## Required Checks

Run after address, ABI, RPC, or integration changes:

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
