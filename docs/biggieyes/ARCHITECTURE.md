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

The current address registry exported in the frontend and backend mirror points to Polygon mainnet.

| Contract | Address |
| --- | --- |
| `BiggiEyesMain` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| `BiggiEyesMain2` | `0xF82Eb16aFFEae270F808E4bFF1C43f1BB04E4634` |
| `VRFRouter` | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| `BiggiToken` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| `Distributor` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| `Reserve` | `0x2786e46e01a5d229118fEdC102267217C7e94574` |
| `Treasury` | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |
| `BuybackAgent` | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| `CollectionRewards` | `0x5d1273070c9133381C570009768621762F024FB8` |
| `TokenRewards` | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| `DripDistributor` | `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3` |
| `DripLiquidityManager` | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` |
| `LiquidityManager` | `0xfb770C5A5AC6e41C85f076DB7C3434eAcd8e0F19` |
| `LiquidityVault` | `0xFe234394845B601B2c671c0dD631fA6290c02bb9` |
| `CommunityCenter` | `0x81C6E90a991d7D210c43B00B7EB1a5450cc372Ae` |

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
