# BIGGIEYES Whitepaper

## 1. Executive Summary

BIGGIEYES is a Polygon-native Web3 ecosystem that combines NFT ticket minting, verifiable randomness, dynamic pricing, protocol-owned liquidity, token rewards, collection completion incentives, treasury recycling, and community distribution into one transparent on-chain architecture.

The protocol is designed around a simple thesis: NFT ecosystems become stronger when mint revenue is routed into visible economic rails rather than disappearing into opaque off-chain operations. BIGGIEYES therefore turns every mint into a contributor to rewards, reserve strength, buybacks, treasury inventory, and community programs.

In the current implementation, the protocol is deployed and integrated through a Polygon Amoy address registry, with architecture, readers, and frontend components structured for Polygon mainnet expansion.

## 2. Vision Of The BiggiEyes Ecosystem

The long-term vision of BIGGIEYES is to become a collectible protocol where users do not merely buy NFTs; they enter a live economic system. Tickets, VRF reveals, BIGGI rewards, public collection expansion, buybacks, reserve management, and community allocations all reinforce one another.

BIGGIEYES is therefore designed as:

- a fair collectible entry system
- a transparent on-chain tokenomics engine
- a modular NFT protocol able to support multiple collections
- a community ecosystem with visible reward logic

## 3. Problems In The NFT Market

The NFT market has repeatedly suffered from a familiar set of structural weaknesses:

- reveal systems that are difficult to verify
- mint proceeds routed to centralized wallets with little public accountability
- poor post-mint utility for collectors
- token systems detached from actual product activity
- weak liquidity support after the initial launch cycle
- community initiatives funded inconsistently or opaquely

These weaknesses lead to short-lived speculation instead of durable network effects.

## 4. The BiggiEyes Solution

BIGGIEYES addresses these weaknesses by combining NFT and tokenomics rails into one protocol loop:

1. a user mints a ticket
2. the ticket is redeemed into a VRF-assigned NFT
3. mint revenue is routed on-chain into reward, reserve, buyback, treasury, and community buckets
4. BIGGI circulates back through weekly claims, treasury recycling, reserve operations, and drip mechanics
5. collection completion unlocks additional native-token rewards

This model aligns collector participation with protocol health.

## 5. BiggiVerse Narrative And World Concept

BiggiVerse is the narrative frame of the protocol. Each NFT belongs to a block and a background family, making the collection feel like a layered world rather than a flat set of images. Tickets represent entry into that world. Redeeming a ticket is a narrative reveal event, not just a mint transaction.

The BiggiVerse concept matters for strategy because it supports:

- progression through ticket-to-NFT transformation
- clear rarity and category structures through blocks and backgrounds
- collectible completion logic
- future expansion through additional collections that still inherit the same world grammar

## 6. NFT Architecture

BIGGIEYES uses a dual-collection model:

- `BiggiEyesMain` is the ticket and VRF collection
- `BiggiEyesMain2` is the public mint collection

The main collection enforces a maximum of 550 tickets and 550 final NFTs. The public collection supports another indexed set of up to 550 NFTs with owner-seeded metadata. Each NFT stores:

- block index
- background code
- main ID
- ticket price at mint
- block price at mint
- final price after background bonus logic

This architecture separates discovery and randomness from direct public inventory access.

## 7. Chainlink VRF Randomness System

Randomness is handled by a dedicated `VRFRouter` that connects `BiggiEyesMain` to Chainlink VRF V2 Plus. The flow is:

1. a user redeems a valid ticket
2. the ticket is burned
3. `BiggiEyesMain` requests randomness through `VRFRouter`
4. Chainlink fulfills the request
5. the router calls `fulfillRandomFromRouter` on the main contract
6. the contract assigns the user a random unminted NFT index

This design gives the protocol verifiable fairness while keeping request metadata visible on-chain.

## 8. Dynamic Mint Pricing Mechanism

BIGGIEYES uses two pricing layers.

### Ticket pricing

Ticket price starts at `0.001 POL` in the current implementation and increases after each mint. The current multiplier parameter approximates a `+0.33%` step per ticket.

### Block pricing

The main collection maintains ten block prices. These block prices are recorded as economic context for revealed NFTs and also serve as the live mint price source for the public collection.

Trait logic can further influence the system through background-based price boosts and background-based price bonuses.

## 9. Tokenomics Of The BIGGI Token

BIGGI is the protocol utility token. In the current implementation the hard supply cap is `1,000,000,000 BIGGI`.

### Strategic cap allocation

| Bucket | Amount | Share |
| --- | --- | --- |
| Reserve initial allocation | 600,000,000 BIGGI | 60% |
| Drip distributor cap | 200,000,000 BIGGI | 20% |
| Token rewards cap | 200,000,000 BIGGI | 20% |

The token contract supports:

- EIP-2612 permit approvals
- pausable transfer behavior
- one-time strategic distribution
- controlled reward refills

## 10. Revenue Distribution Model

The native mint routing model is encoded in the protocol rather than managed off-chain.

### Gross mint routing

- 60% of gross mint value is forwarded to `Distributor`
- 40% is forwarded to the development wallet

### Distributor routing

| Destination | Share Of Distributor Flow | Effective Share Of Gross Mint |
| --- | --- | --- |
| Collection rewards | 25% | 15% |
| Reserve | 35% | 21% |
| Buyback agent | 20% | 12% |
| Treasury | 10% | 6% |
| Community center | 10% | 6% |

Because this logic is on-chain, users can inspect protocol revenue behavior directly.

## 11. Liquidity Architecture

BIGGIEYES uses a reserve-first liquidity model.

`Reserve` stores:

- native value routed from mints
- BIGGI routed from token-paid mints and treasury flows

`LiquidityManager` then:

1. quotes the required BIGGI amount for a target native amount
2. pulls both assets from reserve
3. adds liquidity on the configured V2-style DEX
4. routes LP into `LiquidityVault`

`LiquidityVault` keeps LP custody under protocol control, allowing the ecosystem to build protocol-owned liquidity over time.

## 12. Buyback Mechanism

The buyback system is executed by `BuybackAgent`. It receives native value from `Distributor`, swaps for BIGGI through the DEX router, and forwards acquired BIGGI into `Treasury`.

The module supports:

- configurable router and swap path
- configurable keeper
- cooldowns and quotas through `Policy`
- fallback forwarding behavior if swap execution fails

This makes buybacks functional infrastructure rather than symbolic marketing activity.

## 13. Token Rewards System

`TokenRewards` distributes BIGGI to NFT holders on a weekly basis.

The current implementation:

- tracks one claim per token per week
- uses block-weighted units from 10 to 100
- pays from existing BIGGI balance first
- mints only when needed and only within the rewards cap

This means deeper-block NFTs can earn more weekly BIGGI, creating a transparent utility premium tied to collection structure.

## 14. Collection Rewards System

`CollectionRewards` pays native-token rewards for ownership milestones.

### Current reward logic

- Orange reward: complete all background variants for a main ID in block 1
- Block reward: complete all ten main IDs in a block from 1 to 9
- Rainbow reward: complete all ten main IDs in block 10

This gives collectors long-term progression targets beyond mint and reveal.

## 15. Multi-Collection Ecosystem

The protocol is designed from the start for more than one NFT contract. `Distributor`, `TokenRewards`, and reader contracts support multi-collection logic. The public collection already demonstrates this approach by sharing economic context with the main collection while remaining operationally separate.

Future collections can therefore be added without rebuilding the revenue and reward rails from scratch.

## 16. Smart Contract Architecture

The protocol is intentionally modular:

- NFT issuance is separate from randomness
- revenue routing is separate from treasury and reserve storage
- buybacks are separate from treasury splits
- liquidity execution is separate from LP custody
- community claims are separate from collection rewards

This lowers coupling, improves observability, and simplifies the mental model for audits and integrations.

## 17. Security Considerations

The security model uses:

- role-based permissions
- reentrancy guards
- pausable entry points
- hard supply caps
- explicit automation guardrails
- reader-first frontend design

The largest governance risk in the current implementation is privileged owner control over configuration. For production operation, multisig governance is the recommended baseline.

## 18. Scalability Strategy

BIGGIEYES scales through modularity rather than monolithic feature growth.

The strategy includes:

- reader contracts for aggregated state access
- multi-collection compatibility in reward logic
- reserve and treasury separation for accounting clarity
- frontend lazy loading and RPC failover
- address registries that make migration and redeployment explicit

This reduces operational friction as the protocol expands.

## 19. Governance Model

The current implementation is owner-administered. That is appropriate for an early-stage protocol still finalizing its parameters and deployment posture, but the intended governance direction is:

- multisig control over privileged contracts
- public deployment manifests
- transparent parameter update process
- eventual governance logic around economic policy and ecosystem expansion

The community center and reward modules create a foundation for governance-aware community coordination later.

## 20. Future Ecosystem Expansion

Future expansion can include:

- new collections attached to the same routing rails
- richer BiggiVerse lore and campaign layers
- partner collections and branded collaborations
- improved treasury and reserve analytics
- broader governance-driven community programs

The protocol design already anticipates this path by separating product modules from economic infrastructure.

## 21. Conclusion

BIGGIEYES proposes a different model for NFT ecosystems. Instead of treating NFT minting as an isolated product event, it treats every mint as an on-chain economic input. Fair randomness, visible routing, capped tokenomics, reserve-backed liquidity, weekly rewards, set completion incentives, and community allocations all work together.

That architecture gives BIGGIEYES a stronger foundation for sustainability, transparency, and long-term ecosystem growth than a conventional reveal collection or isolated utility token could provide on its own.
