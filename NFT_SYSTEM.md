# NFT System

## Overview

The BIGGIEYES NFT system is built around a dual-collection architecture:

- `BiggiEyesMain` is the ticket-driven VRF collection
- `BiggiEyesMain2` is the public mint collection

Both collections share the same ten block and main-ID grammar, but only the VRF collection uses colored background variants.

## Collection Roles

| Collection | Mint Model | Assignment Model | Economic Role |
| --- | --- | --- | --- |
| `BiggiEyesMain` | Ticket mint first, redemption second | Chainlink VRF selects an unminted NFT index | Discovery, randomness, narrative entry point |
| `BiggiEyesMain2` | Direct mint of pre-seeded index | Deterministic, user-selected index | Public market extension and inventory expansion |

## Supply Model

### Ticket Supply

`BiggiEyesMain` enforces:

- maximum ticket supply: `550`
- maximum per-wallet ticket count: `10`

Tickets are ERC721 assets, which means they are tradable before redemption. This creates a liquid pre-reveal layer around the collection.

### Main NFT Supply

The VRF collection mints a maximum of `550` NFTs. Randomness selects an unminted index, and the contract linearly probes until it finds an available slot.

### Public NFT Supply

`BiggiEyesMain2` contains exactly `100` indexed NFTs, ten in each block. It has no colored background clones. Metadata for each index must be seeded before users can mint specific indices directly.

## Metadata Model

The shared contract record stores:

- `mainId`
- `blockIdx`
- `background`
- `ticketPrice`
- `blockPrice`
- `finalPrice`
- `minted`

For Public, `background` is only an internal ABI compatibility sentinel and is not an NFT trait. Its mint-time block and final prices are identical and come from the paired VRF block.

## Block Structure

The VRF collection is partitioned across ten blocks using the following internal inventory logic:

```text
total NFTs in block N = 110 - 10 * N
```

This produces:

| Block | NFT Count |
| --- | --- |
| 1 | 100 |
| 2 | 90 |
| 3 | 80 |
| 4 | 70 |
| 5 | 60 |
| 6 | 50 |
| 7 | 40 |
| 8 | 30 |
| 9 | 20 |
| 10 | 10 |

Total supply across all blocks equals `550`.

## Background System

BIGGIEYES uses ten background families:

- ORANGE
- BLACK
- WHITE
- BROWN
- BLUE
- GREEN
- VIOLET
- RED
- PINK
- RAINBOW

Backgrounds apply only to the VRF collection and matter for its rarity signaling and collection reward eligibility. Public has no background variants and is not part of CollectionRewards.

## Ticket Minting

### Native Mint

Users can call `mintTicket()` and pay the current ticket price in native token. The contract:

1. checks supply and wallet limits
2. forwards revenue using the fixed routing model
3. mints a tradable ticket NFT
4. increases the ticket price for the next minter

### BIGGI Mint

Users can call `mintTicketWithBiggi()` if the BIGGI token is configured. The contract:

1. converts the current ticket price into BIGGI using `biggiPerEth`
2. collects BIGGI from the user
3. forwards collected BIGGI into reserve accounting
4. mints a ticket
5. increases the ticket price for the next minter

## Redemption And Random Assignment

Redeeming a ticket is a two-stage flow:

1. the user burns a valid ticket through `redeemTicketAndMintNFT(ticketId)`
2. the main contract requests randomness from `VRFRouter`
3. Chainlink VRF fulfills the request
4. `fulfillRandomFromRouter()` assigns the user a random unminted NFT

The contract also records:

- pending request ID per user
- minter address per request
- request timestamp per request

This makes pending redemptions visible to the frontend and to external monitors.

## Dynamic Pricing

### Ticket Price

Ticket price rises after every ticket mint. This creates scarcity pressure at the entry layer.

### Block Price

Block prices are tracked in the main collection and reused by the public collection as the active mint price oracle.

### Background Effects

During VRF fulfillment:

- the background can increase the current price of its block-family bucket
- the background also contributes a bonus that changes the recorded `finalPrice`

This gives the system a dynamic pricing memory tied to revealed NFT traits.

## Public Collection Mechanics

The public collection requires metadata prepopulation via `batchSetNFTBackgroundAndBlock()`. Once seeded:

1. the user picks a specific NFT index
2. the contract reads the live block price from the main collection
3. the user mints that NFT in native token or BIGGI
4. the same revenue routing logic applies

This creates an expandable market-facing collection without abandoning the main collection as the canonical price source.

## Collection Completion Rewards

`CollectionRewards` uses ownership checks against the main collection to reward completion:

| Reward | Eligibility |
| --- | --- |
| Orange reward | Own every background variant for one main ID in block 1 |
| Block reward | Own all ten main IDs in a block from 1 to 9 |
| Rainbow reward | Own all ten main IDs in block 10 |

This turns ownership depth into a claimable on-chain game mechanic.

## Character Reward NFTs

The main collection also tracks block completion for auxiliary character reward mints. When a block is fully minted, the contract can mint a special character reward token tied to that completed block. This gives the ecosystem an additional collectible layer and a symbolic reward for block closure.

## Why The NFT Model Is Different

BIGGIEYES treats NFTs as economically aware digital assets rather than static media objects:

- entry starts with a tradable ticket
- reveal is provably random
- each NFT stores economic context
- block and background traits feed back into the reward system
- collection completion unlocks native-token rewards
- public collection expansion can inherit the same economic logic

That combination gives BIGGIEYES a stronger post-mint retention model than typical reveal collections.
