# Architecture

## Architecture Summary

BIGGIEYES is structured as a modular on-chain system where NFT issuance, randomness, revenue routing, token rewards, liquidity operations, and community funding are separated into dedicated contracts. This reduces coupling, improves auditability, and allows each module to enforce its own access rules and accounting boundaries.

## Canonical Naming

The project brief uses simplified contract names. The codebase and artifacts use the following implementation names:

| Documentation Name | Implementation Name In Repo | Primary Responsibility |
| --- | --- | --- |
| `BiggiEyesMain` | `BiggiEyesMain` | Ticket mint, redeem, VRF NFT assignment |
| `Distributor` | `MultiCollectionDistributor` | Mint revenue split router |
| `Reserve` | `BiggiReserveV4` | Reserve accounting for BIGGI and POL |
| `Treasury` | `BiggiTreasury` | BIGGI routing after buybacks |
| `BuybackAgent` | `BiggiBuybackAgent` | DEX buyback execution |
| `DripLiquidityManager` | `BiggiDripLMToModerator` | Drip asset conversion and downstream allocation |
| `LiquidityVault` | `LiquidityVault` | Protocol LP custody |
| `VRFRouter` | `BiggiVRFRouter` | Chainlink VRF mediation |

## Layered Model

### 1. User Access Layer

- Browser wallet and WalletConnect sessions
- React/Vite frontend panels
- Reader-first data access for transparent snapshots

### 2. NFT Execution Layer

- `BiggiEyesMain` for ticket minting and VRF redemption
- `BiggiEyesMain2` for direct public minting against shared block prices
- metadata seeding through batch NFT info assignment

### 3. Randomness Layer

- `VRFRouter` accepts random requests only from the main collection
- Chainlink VRF V2 Plus coordinator fulfills requests
- fulfillment is routed back to `fulfillRandomFromRouter`

### 4. Distribution Layer

- mint proceeds flow from collections into `Distributor`
- `Distributor` routes native value into collection rewards, reserve, buyback, treasury, and community
- failed forwards are recorded as pending balances and can be retried

### 5. Tokenomics Layer

- `BiggiToken` maintains capped supply and initial strategic allocations
- `TokenRewards` manages weekly holder emissions under a cap
- `Treasury` redistributes BIGGI received from buybacks
- `DripDistributor` tracks drip balances and claimable inventory

### 6. Liquidity And Market Layer

- `Reserve` stores protocol-controlled BIGGI and POL
- `LiquidityManager` pulls from reserve, pairs assets on the DEX, and mints LP
- `LiquidityVault` keeps protocol LP tokens in custody
- `BuybackAgent` buys BIGGI from the market and routes output back to treasury

### 7. Governance And Community Layer

- `CommunityCenter` escrows community event prizes and winner claims
- owner or multisig controls configuration in the current implementation
- keeper proxies and policy contracts harden automated execution paths

## Contract Interaction Topology

```text
User -> BiggiEyesMain -> Distributor -> {CollectionRewards, Reserve, BuybackAgent, Treasury, CommunityCenter}
User -> BiggiEyesMain -> VRFRouter -> Chainlink VRF -> VRFRouter -> BiggiEyesMain
User -> BiggiEyesMain2 -> Distributor

BuybackAgent -> DEX Router -> BIGGI -> Treasury
Treasury -> {TokenRewards, Reserve, DripDistributor}
Reserve -> LiquidityManager -> DEX Router -> LiquidityVault
DripDistributor -> DripLiquidityManager -> DEX Router -> {Reserve, Community / Moderator sink}
TokenRewards -> User
CollectionRewards -> User
CommunityCenter -> User
```

## Current Public Registry In This Repo

The current address registry exported in the frontend and backend mirror points to Polygon Amoy.

| Contract | Address |
| --- | --- |
| `BiggiEyesMain` | `0x3430f378032Cead7A82f38047e906C1E3cAFc703` |
| `BiggiEyesMain2` | `0xf511267b2A08Cd2f94ACc0eF74c4Eb1Ac799980B` |
| `VRFRouter` | `0x53cC9F2BD094f10D2cB477caE44aCBa32175db0B` |
| `BiggiToken` | `0xD4D0fa17f2955Eb3fF8D03ea0cD7A2f0a06E6d0E` |
| `Distributor` | `0xc8382527D0cb095fDa284547EA91eC352E7C75Cd` |
| `Reserve` | `0xa283f6D745cd858133f7a3AE6A2ea97D7b8FA54f` |
| `Treasury` | `0x42f4d7091e2a23CD855b880de1676290f3E57fe4` |
| `BuybackAgent` | `0x06fC8552119d8B46e8dd19C54c81b9E3bDEfa266` |
| `CollectionRewards` | `0xa708E016dEC7B6a5b3da640c0d995895979cE332` |
| `TokenRewards` | `0x5Fc30c88CeA11f397ccc73d6bec020e7779D9cca` |
| `DripDistributor` | `0x2B835CFbF11AD44fd1A977D1781195674771ECa6` |
| `DripLiquidityManager` | `0xD32fC50c153Ab47F68763c739A2deA8b5Da81373` |
| `LiquidityManager` | `0x87f542886FC133C68F1b0ae7737Ecb4f8F647e6C` |
| `LiquidityVault` | `0xD775DaBBa9246694F3F570D9CEC769B1b37808f5` |
| `CommunityCenter` | `0x1aa66c77B3c7ec1eC704308a182C7f43a8744702` |

## Revenue Routing Model

### Gross Mint Flow

1. A collection accepts user payment.
2. The collection forwards 60% of gross native mint value to `Distributor`.
3. The remaining 40% is forwarded to the configured development wallet.
4. `Distributor` splits its share into protocol buckets.

### BIGGI Payment Flow

When a collection accepts BIGGI instead of native value:

1. BIGGI is transferred from the user to the collection.
2. A configurable `tokenSink` may absorb part of the flow.
3. The remainder is forwarded to `Reserve`.
4. `Reserve` records the amount into the refill bucket through notification.

## Collection Architecture

### VRF Collection

`BiggiEyesMain` is the discovery collection. Users mint tickets, redeem them, and receive a random unminted NFT index. The contract tracks:

- ticket count per wallet
- current ticket price
- block and background mint counts
- metadata assignment for each NFT index
- pending VRF requests and timestamps

### Public Collection

`BiggiEyesMain2` is a deterministic mint collection. Metadata is pre-seeded by the owner, and users mint specific indices at the current block price exposed by the main collection. This allows BIGGIEYES to expand inventory without duplicating the main pricing oracle logic.

## Reader Strategy

Frontend reads are intentionally biased toward reader and snapshot contracts:

- `BiggiMainReader` exposes aggregated collection state and ticket lookup helpers
- `BiggiTokenomikReader` exposes a normalized cross-contract tokenomics snapshot
- specialized readers expose reserve, treasury, buyback, distribution, and NFT reward views

This reduces RPC round-trips and keeps the UI aligned with a stable read model even as the underlying system spans many contracts.

## Operational Architecture

| Operational Function | Contract Or Service |
| --- | --- |
| Randomness | Chainlink VRF through `VRFRouter` |
| Buyback automation | `BuybackAgent` plus upkeep proxy and policy guards |
| Liquidity automation | `LiquidityManager`, reserve trigger, liquidity keeper proxy |
| Drip automation | `DripDistributor`, `DripLiquidityManager`, drip keeper proxy |
| Frontend monitoring | reader snapshots, RPC health checks, transparency hooks |

## Design Tradeoffs

### Benefits

- modular contracts simplify reasoning and verification
- fixed routing percentages make the treasury model predictable
- reader contracts lower frontend complexity
- reserve and treasury separation improves accounting clarity

### Tradeoffs

- more contracts increase deployment and wiring complexity
- automation paths depend on external infrastructure and RPC health
- current governance remains owner-centric until multisig or DAO control is formalized

For visual diagrams of the full topology and flows, see [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md).
