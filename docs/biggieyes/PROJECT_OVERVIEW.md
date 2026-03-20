# Project Overview

## Executive Snapshot

BIGGIEYES is an on-chain NFT and tokenomics protocol built around a simple product loop:

1. Users mint collectible tickets.
2. Tickets are redeemed into provably random NFTs through Chainlink VRF.
3. Mint revenue is routed into reward pools, reserve liquidity, treasury, buybacks, and community programs.
4. BIGGI token flows back to holders and ecosystem participants through weekly rewards, collection rewards, treasury routing, and drip distribution.

The result is an NFT system that is not only collectible, but economically connected to protocol liquidity and long-term ecosystem participation.

## What BIGGIEYES Solves

Most NFT launches separate collectibles from protocol economics. Mint proceeds disappear into team wallets, randomness is opaque, and post-mint holder utility is weak. BIGGIEYES addresses this through:

- verifiable assignment using Chainlink VRF
- on-chain routing of mint revenue into visible protocol buckets
- a capped utility token tied to reward and liquidity rails
- multi-collection expansion without breaking the core economic model
- reader contracts and dashboards that make protocol state easy to inspect

## Protocol Design Principles

| Principle | BIGGIEYES Implementation |
| --- | --- |
| Fairness | Chainlink VRF handles random NFT assignment after ticket redemption |
| Transparency | Contracts expose accounting state; readers aggregate snapshots for the frontend |
| Sustainability | Mint flows and buyback flows are split across reserve, treasury, rewards, drip, and community pools |
| Scalability | Dual collection architecture and reader contracts reduce coupling between user interfaces and core state |
| Verifiability | Address registries, ABI inventory, and emitted events make protocol actions auditable |

## Ecosystem Modules

### NFT Layer

- `BiggiEyesMain` manages ticket minting, redemption, and VRF-based NFT assignment.
- `BiggiEyesMain2` supports a public mint collection with pre-seeded metadata and shared price references.
- `VRFRouter` mediates Chainlink VRF requests and fulfillment callbacks.

### Revenue Distribution Layer

- `Distributor` accepts mint share inflows from approved collections and splits them into fixed recipients.
- `CollectionRewards` pays native-token rewards for collection completion.
- `CommunityCenter` manages event-based community allocations and claimable prizes.

### BIGGI Tokenomics Layer

- `BiggiToken` is the capped ERC20 utility token.
- `TokenRewards` issues weekly BIGGI rewards to eligible NFT holders.
- `Treasury` receives buyback-acquired BIGGI and redistributes it to rewards, reserve, and drip rails.
- `Reserve` stores BIGGI and native assets earmarked for liquidity operations.

### Market Operations Layer

- `BuybackAgent` swaps native value for BIGGI through a DEX and forwards acquired tokens to the treasury.
- `DripDistributor` accounts for drip token availability and claimable balances.
- `DripLiquidityManager` converts drip inventory into native value and routes proceeds into ecosystem sinks.

### Liquidity Layer

- `LiquidityManager` pairs reserve inventory into DEX liquidity.
- `LiquidityVault` stores LP tokens under protocol custody.

## Current Implementation Footprint

The current repo includes:

- a live address registry for Polygon Amoy
- frontend integration for the NFT, VRF, rewards, tokenomics, community, and liquidity panels
- reader contracts for frontend snapshots
- deployment and wiring scripts for buyback, reserve, treasury, distributor, and liquidity branches
- tests for wallet integration, VRF polling, reward readers, and tokenomics normalization

## Deployment Context

| Item | Value |
| --- | --- |
| Primary chain target | Polygon |
| Current repo deployment registry | Polygon Amoy |
| Chain ID | `80002` |
| Canonical address sources | `src/shared/utils/addresses.js`, `biggi-project/bekend/addresses.json` |
| Frontend stack | React, Vite, ethers v6 |
| Automation dependencies | Chainlink VRF, upkeep-style keeper proxies, Uniswap V2 style router/pair infrastructure |

## Why The Architecture Matters

BIGGIEYES is not a single mint contract with a token attached. It is a protocol composed of interlocking accounting modules:

- collections generate inflow
- the distributor routes inflow
- reserve and liquidity modules strengthen market structure
- treasury and buyback modules recycle value into BIGGI
- reward modules return value to holders and ecosystem participants
- community modules route value toward governance and social engagement

That modular structure is the basis for future collection expansion, governance hardening, and on-chain economic experimentation.
