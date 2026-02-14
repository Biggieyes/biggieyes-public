# Overview

BiggiEyes is a gamified on-chain NFT experience built around verifiable randomness, dynamic pricing, and transparent tokenomics. The frontend reads live state from contracts and shows a unified UI for minting, redeeming, rewards, and ecosystem stats.

## Core user flow
1. Mint a ticket.
1. Redeem the ticket to trigger VRF.
1. VRF selects the final NFT from IPFS.
1. The NFT appears in the user gallery and the UI refreshes live stats.

## Dynamic pricing
- A base price is shown for reference.
- A live price is read from contracts and changes with demand.
- Users can always see both values for transparency.

## Tokenomics visibility
The app surfaces live data for:
- Rewards pools and claims.
- Buyback and DRIP flows.
- Liquidity, reserve, and treasury balances.
- On-chain snapshots via reader contracts.

## Network
- Default: Polygon Amoy testnet (chainId 80002).
- Mainnet support can be enabled by updating address configs.

## Trust signals
- Open source client and serverless code.
- Explicit risk disclosure in docs/RISK_DISCLOSURE.md.
- Clear separation of public and private configuration.
