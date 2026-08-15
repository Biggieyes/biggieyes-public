# BIGGIEYES Litepaper

## Vision

BIGGIEYES is building an NFT ecosystem where collectibles, token utility, liquidity, and community rewards are connected by transparent on-chain rules.

Instead of launching NFTs as isolated media assets, BIGGIEYES treats every mint as part of a larger economic loop:

- users mint tickets
- tickets redeem into provably random NFTs
- mint value is routed into reserve, rewards, treasury, buybacks, and community pools
- BIGGI returns to the ecosystem through weekly rewards and treasury recycling

## NFT System

BIGGIEYES uses two NFT collections.

### Main collection

- users mint tradable tickets
- tickets can be redeemed into NFTs
- Chainlink VRF determines which NFT index is assigned

### Public collection

- users mint pre-seeded NFT indices directly
- block pricing is inherited from the main collection
- the same economic routing logic still applies

This gives the ecosystem both a fair reveal mechanic and a scalable expansion layer.

## Token Economy

BIGGI is the ecosystem utility token.

### Current supply framework

- max supply: 1,000,000,000 BIGGI
- reserve allocation: 600,000,000 BIGGI
- drip allocation cap: 200,000,000 BIGGI
- token rewards allocation cap: 200,000,000 BIGGI

### Why BIGGI matters

BIGGI links:

- token-paid NFT minting
- weekly rewards for NFT holders
- buyback recycling
- treasury redistribution
- drip-based ecosystem activity

## Ecosystem Components

| Component | Role |
| --- | --- |
| `BiggiEyesMain` | ticket minting and VRF redemption |
| `VRFRouter` | Chainlink randomness mediation |
| `Distributor` | mint revenue routing |
| `Reserve` | reserve accounting and liquidity source |
| `Treasury` | BIGGI recycling after buybacks |
| `BuybackAgent` | DEX buyback execution |
| `TokenRewards` | weekly BIGGI rewards |
| `CollectionRewards` | completion rewards in native token |
| `LiquidityManager` | reserve-backed liquidity pairing |
| `LiquidityVault` | protocol LP custody |
| `CommunityCenter` | community event prizes and claims |

## Sustainability Model

BIGGIEYES is designed to be more sustainable than a one-time NFT launch because mint revenue is distributed into multiple visible sinks:

- rewards keep holders engaged
- reserve strengthens liquidity operations
- buybacks recycle value into BIGGI
- treasury redistributes acquired BIGGI
- community funding supports ecosystem growth

The token model is also capped, which reduces inflation risk relative to open-ended emissions.

## Revenue Routing

### Gross mint split

- 60% goes to the protocol distributor
- 40% goes to the development wallet

### Distributor split

- 25% to collection rewards
- 35% to reserve
- 20% to buyback agent
- 10% to treasury
- 10% to community center

This makes the protocol economics observable from the first mint onward.

## Rewards

### Token rewards

NFT holders can claim BIGGI weekly. Reward size depends on the block of the NFT, with higher blocks earning higher weights.

### Collection rewards

Collectors can unlock native-token payouts by completing on-chain ownership milestones such as:

- all backgrounds for one main ID in the orange block
- all ten main IDs in a block
- full rainbow block completion

## Roadmap

### Near term

- harden deployment, monitoring, and verification
- finalize mainnet-ready governance standards
- improve analytics and transparency dashboards

### Mid term

- expand the collection ecosystem
- strengthen community reward programs
- mature reserve and liquidity operations

### Long term

- move toward governance-based parameter control
- expand BiggiVerse into a broader collectible protocol

## Why BIGGIEYES Matters

BIGGIEYES is not trying to be only an NFT drop, only a reward token, or only a DeFi wrapper. It combines all three into a protocol where NFTs generate economic activity, tokenomics are transparent, and community growth is funded by visible on-chain flows.
