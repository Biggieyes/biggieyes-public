# Tokenomics

## BIGGI Token Summary

BIGGI is the utility and accounting token of the BIGGIEYES ecosystem. It connects NFT activity, protocol-owned liquidity, treasury recycling, drip mechanics, and holder rewards into a unified economic layer.

| Parameter | Current Implementation |
| --- | --- |
| Token name | `Biggi Token` |
| Symbol | `BIGGI` |
| Standard | ERC20 + ERC20Permit + burnable + pausable |
| Max supply | `1,000,000,000 BIGGI` |
| Core cap source | `BiggiCapsLib` |

## Supply Allocation

The current implementation hard-codes the strategic supply caps in `BiggiCapsLib`:

| Allocation Bucket | Amount | Share Of Max Supply | Primary Use |
| --- | --- | --- | --- |
| Reserve initial allocation | `600,000,000 BIGGI` | 60% | Liquidity reserve, refill bucket, market support |
| Drip distributor cap | `200,000,000 BIGGI` | 20% | Drip accounting and post-buyback recycling |
| Token rewards cap | `200,000,000 BIGGI` | 20% | Weekly NFT holder rewards |

The `initialDistribute()` function in `BiggiToken` mints these allocations once and transfers them directly to `Reserve`, `DripDistributor`, and `TokenRewards`.

## Revenue Distribution Model

### Gross Mint Revenue

Collections forward 60% of native mint proceeds into `Distributor`. The remaining 40% is forwarded to the development wallet.

### Distributor Split

The distributor uses fixed basis-point logic:

| Destination | Share Of Distributor Inflow | Effective Share Of Gross Mint |
| --- | --- | --- |
| `CollectionRewards` | 25% | 15% |
| `Reserve` | 35% | 21% |
| `BuybackAgent` | 20% | 12% |
| `Treasury` | 10% | 6% |
| `CommunityCenter` | 10% | 6% |

This means each mint contributes to collector rewards, market support, treasury accumulation, and community spending from the first transaction onward.

## Ticket Pricing

`BiggiEyesMain` starts with:

- initial ticket price: `0.001 POL`
- per-mint multiplier parameter: `10033`

In the current price library, the next ticket price is computed as:

```text
nextTicketPrice = currentTicketPrice * 10033 / 10000
```

This produces approximately `+0.33%` growth per minted ticket and creates a predictable upward price curve across the ticket supply.

## Block Pricing

The main collection maintains ten block price buckets. These prices are used in two ways:

- as the reference valuation stored on randomly redeemed NFTs
- as the direct public mint price source for `BiggiEyesMain2`

Each block price is independently mutable by the owner in the current implementation, which allows staged pricing updates while keeping the price source on-chain.

## BIGGI-Paid Mint Flow

When users mint with BIGGI rather than native value:

1. the collection converts the native-denominated mint price into BIGGI using `biggiPerEth`
2. BIGGI is pulled from the user wallet
3. an optional `tokenSink` can receive part of the transfer
4. the remainder is forwarded to `Reserve`
5. `Reserve` records the intake in the DEX refill bucket

This route ties token demand directly to mint activity and replenishes protocol inventory used for liquidity operations.

## Treasury Recycling

`BuybackAgent` acquires BIGGI on the DEX and sends it to `Treasury` through `buybackDepositAndSplit()`.

The current treasury split is:

| Destination | Share Of Buyback BIGGI |
| --- | --- |
| `TokenRewards` | 34% |
| `Reserve` | 33% |
| `DripDistributor` | 33% |

This structure makes buybacks productive rather than purely cosmetic. Acquired BIGGI is immediately redirected into holder rewards, liquidity support, and drip accounting.

## Weekly Holder Rewards

`TokenRewards` distributes BIGGI on a per-token, per-week basis.

### Core Parameters

| Parameter | Current Default |
| --- | --- |
| Unit reward | `1 BIGGI` |
| Claim cadence | one claim per token per week |
| Reward cap | `200,000,000 BIGGI` |
| Fallback payout logic | transfer from existing balance first, mint only if needed and still under cap |

### Block Weight Schedule

| Block | Weight | Reward Per Eligible Token Per Week At Current Default |
| --- | --- | --- |
| 1 | 10 | 10 BIGGI |
| 2 | 20 | 20 BIGGI |
| 3 | 30 | 30 BIGGI |
| 4 | 40 | 40 BIGGI |
| 5 | 50 | 50 BIGGI |
| 6 | 60 | 60 BIGGI |
| 7 | 70 | 70 BIGGI |
| 8 | 80 | 80 BIGGI |
| 9 | 90 | 90 BIGGI |
| 10 | 100 | 100 BIGGI |

This makes rarer, deeper-block assets economically more valuable in the weekly reward system.

## Collection Rewards

Collection rewards are paid in the native gas token and are funded by the distributor inflow.

### Current Reward Buckets

| Reward Type | Current Default | Eligibility Model |
| --- | --- | --- |
| Orange reward | `1,000 POL` | Own all backgrounds for a given main ID in block 1 |
| Block reward | `3,000 POL` | Own all ten main IDs in a specific block from 1 to 9 |
| Rainbow reward | `10,000 POL` | Own all ten main IDs in block 10 |

These are current implementation defaults and should be treated as configurable protocol parameters rather than immutable economic promises.

## Drip Economics

The drip system is a secondary recycling rail:

- `DripDistributor` tracks available BIGGI inventory and mint-based accounting
- `DripLiquidityManager` claims BIGGI, sells a configurable share to native value, and routes proceeds downstream
- the current contract supports reserve and moderator/community-style sinks

The drip path allows the protocol to convert token inventory into ecosystem activity without collapsing the treasury and reserve roles into one contract.

## Liquidity Support

`Reserve` stores:

- native token received from distributor inflows
- BIGGI earmarked for DEX refill and reserve accounting

`LiquidityManager` then:

1. quotes a matching BIGGI amount for requested native value
2. pulls both assets from `Reserve`
3. adds liquidity to the configured V2-style router
4. sends minted LP directly into `LiquidityVault`

This creates a protocol-owned liquidity loop rather than depending solely on external LP providers.

## Sustainability Model

BIGGIEYES is designed around four sustainability levers:

1. hard caps on strategic BIGGI allocation buckets
2. visible routing of mint revenue into operational modules
3. treasury recycling of buyback-acquired BIGGI
4. reserve-controlled liquidity operations rather than uncontrolled emissions

The protocol does not rely on indefinite uncapped inflation. Reward emissions are bounded, and multiple sinks serve the same strategic goal of supporting holder retention and market structure.

## Governance Implications

The current implementation retains owner-controlled parameters such as:

- ticket price and ticket price growth
- block prices
- reward amounts and unit rewards
- slippage and automation thresholds
- collection allowlists and recipient addresses

The long-term path should move these controls into multisig or governance-approved parameter modules to preserve flexibility while reducing centralization risk.
