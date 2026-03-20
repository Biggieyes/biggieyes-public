# Frontend Integration

## Integration Goals

The frontend is designed to make a multi-contract protocol feel like a single user product while preserving transparency and avoiding unnecessary write-surface complexity.

## 1. Wallet Connection

### Supported connection modes

- injected browser wallets
- WalletConnect sessions for desktop QR and mobile deep links

### Current implementation

- injected provider discovery and chain enforcement live in `src/shared/utils/contract.js`
- WalletConnect session bootstrapping lives in `src/wallet/wc.js`

### Expected flow

1. detect wallet provider
2. request accounts
3. ensure Polygon Amoy or configured chain
4. create signer-backed ethers provider
5. subscribe to account and chain changes

## 2. RPC Providers

### Read path

The app uses:

- configured RPC URLs from environment
- public fallback RPCs
- optional archive RPCs for deeper history access
- optional ethers fallback provider

### Health strategy

`rpcConfig.js` checks:

- chain ID correctness
- block freshness
- latency
- recent rate-limit marks

This lets the UI prefer healthier endpoints while degrading safely during provider instability.

## 3. Contract Read Interactions

### Primary pattern

- use address registry keys from `ADDR`
- use read-only contract factories
- prefer reader contracts for aggregated state

### Common read targets

- main reader for ticket and collection snapshots
- tokenomics reader for cross-contract status
- collection rewards and token rewards readers for claim status
- reserve, treasury, and buyback readers for transparency panels

## 4. Contract Write Interactions

Write flows are limited to explicit user actions such as:

- minting tickets
- minting public NFTs
- redeeming tickets
- claiming BIGGI rewards
- claiming collection rewards
- claiming community event prizes

The frontend should:

1. validate prerequisites locally
2. estimate gas where practical
3. submit through the signer-backed contract factory
4. surface pending, success, and failure states clearly

## 5. Event Listeners And Polling

The frontend combines direct reads with targeted polling.

### Current patterns

- VRF polling utilities for pending redemption state
- reader snapshot refresh loops for tokenomics and rewards
- wallet asset refresh triggers after successful writes

### Why polling is still used

Given public RPC variability and wallet differences, bounded polling is often more reliable than depending entirely on live event subscriptions in the browser.

## 6. UI Panels

### Core user panels

- mint and gallery flows
- VRF status panel
- rewards panel
- user wallet panel
- community center panel

### Transparency panels

- tokenomics dashboard
- reserve and treasury views
- buyback and drip views
- RPC latency and policy status

## 7. Error Handling

The integration layer should distinguish between:

- wallet errors
- RPC availability errors
- contract revert messages
- rate-limited endpoint behavior
- stale data or partial reader failures

The current frontend already includes utilities for RPC retry, error classification, and rate-limit marking.

## 8. Recommended Integration Rules

1. never hardcode contract addresses in components
2. never couple UI logic directly to raw artifact paths
3. use reader contracts for dashboards
4. keep write logic behind one user intent per transaction
5. refresh dependent panels after writes
6. show the active chain and contract addresses in transparency views

## 9. Example Integration Surfaces

| User action | Primary contract path |
| --- | --- |
| Mint ticket | `BiggiEyesMain.mintTicket` or `mintTicketWithBiggi` |
| Redeem ticket | `BiggiEyesMain.redeemTicketAndMintNFT` |
| Mint public NFT | `BiggiEyesMain2.mintPublic` or `mintPublicWithBiggi` |
| Claim weekly BIGGI | `TokenRewards.claim` or `claimWithCollections` |
| Claim collection reward | `CollectionRewards.claimOrangeReward`, `claimBlockReward`, `claimRainbowReward` |
| Claim community prize | `CommunityCenter.claim` |

## 10. Operational Transparency In The UI

The frontend should continue exposing:

- contract addresses
- chain ID
- current RPC endpoint or health summary
- reserve, treasury, and buyback balances
- pending VRF state
- claim eligibility reasons

This approach makes the interface itself part of the protocol trust model.
