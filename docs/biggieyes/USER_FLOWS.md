# User Flows

## 1. Minting A Ticket

### Goal

Acquire a tradable ticket in the main BIGGIEYES collection.

### Preconditions

- user wallet is connected
- wallet is on Polygon Amoy or the configured deployment chain
- collection is not paused
- ticket supply is not exhausted
- user has not exceeded the per-wallet limit

### Flow

1. The frontend reads the current ticket price from the main reader or main contract.
2. The user selects payment in POL or BIGGI.
3. The frontend prepares the appropriate transaction:
   - `mintTicket()` for native payment
   - `mintTicketWithBiggi()` for token payment
4. The user signs and broadcasts the transaction.
5. The contract checks limits and payment sufficiency.
6. Revenue is routed through the protocol.
7. A ticket NFT is minted to the user.
8. The next ticket price is updated on-chain.

### Success result

- the wallet holds a ticket ERC721
- the dashboard can discover the ticket through reader lookup

### Common failure states

- insufficient funds
- wrong network
- paused contract
- wallet already holds the maximum number of tickets
- ticket supply sold out

## 2. Redeeming An NFT

### Goal

Burn a ticket and receive a random BIGGIEYES NFT.

### Preconditions

- user owns a valid ticket
- no other redemption is already pending for that wallet
- final NFT supply is not exhausted
- VRF router is configured and funded

### Flow

1. The user opens the redeem panel and selects a ticket.
2. The frontend submits `redeemTicketAndMintNFT(ticketId)`.
3. The contract verifies ticket ownership and pending state.
4. The ticket is burned immediately.
5. `VRFRouter` requests a random word from Chainlink VRF.
6. The frontend enters a pending state and polls for fulfillment.
7. Once VRF completes, the router calls `fulfillRandomFromRouter`.
8. The main contract selects a random unminted NFT index and mints the NFT to the user.
9. Metadata and pricing context are recorded on-chain.

### Success result

- the ticket disappears from the wallet
- the wallet receives a final BIGGIEYES NFT
- the UI refreshes ticket, gallery, and VRF status panels

### Common failure states

- user tries to redeem a ticket they do not own
- ticket is already redeemed
- user already has a pending redemption
- VRF fulfillment is delayed by oracle or subscription issues

## 3. Claiming Token Rewards

### Goal

Claim weekly BIGGI rewards for eligible NFTs.

### Preconditions

- wallet holds one or more eligible NFTs
- the token rewards contract is active
- the tokens selected have not already been claimed this week

### Flow

1. The frontend reads reward status from `TokenRewards` or its reader.
2. The user selects eligible token IDs.
3. The frontend submits:
   - `claim(tokenIds)` for main collection claims
   - `claimWithCollections(collections, tokenIds)` for multi-collection claims
4. The contract checks token ownership and weekly claim status.
5. Reward units are calculated from block weights.
6. BIGGI is paid out from existing contract balance first.
7. If needed and still under cap, additional BIGGI is minted.

### Success result

- BIGGI is transferred to the user wallet
- token last-claim week is updated on-chain
- the dashboard reflects the new claim status

### Common failure states

- no eligible tokens
- token was already claimed this week
- collection is not allowed in the mixed claim path
- rewards cap would be exceeded

## 4. Completing Collection Rewards

### Goal

Claim native-token rewards for completing a milestone set.

### Preconditions

- user satisfies the ownership condition for orange, block, or rainbow reward
- reward has not already been consumed globally where applicable
- the collection rewards contract has enough native balance

### Flow

1. The frontend checks eligibility using `canClaimOrange`, `canClaimBlock`, or `canClaimRainbow`.
2. The user submits the corresponding claim transaction.
3. The contract re-checks the ownership condition against the main collection.
4. The contract checks payout availability and uniqueness rules.
5. Native value is transferred directly to the user.
6. Reward state is marked as claimed on-chain.

### Success result

- native reward is transferred to the user wallet
- reward counters update in the UI

### Common failure states

- set is incomplete
- reward already claimed globally
- contract reward pool is underfunded

## 5. Participating In The Token Ecosystem

### Goal

Take part in the broader BIGGI economic loop rather than only holding NFTs.

### Participation paths

1. Use BIGGI to mint tickets or public NFTs.
2. Hold NFTs and claim weekly BIGGI rewards.
3. Track buyback, reserve, and treasury status in the tokenomics dashboard.
4. Follow community campaigns funded through `CommunityCenter`.
5. Observe how mint activity routes into reserve, treasury, and reward rails.

### User-visible outcomes

- BIGGI utility is tied to actual protocol activity
- holder rewards are visible and verifiable
- treasury and reserve state can be monitored in real time
- community participation is backed by on-chain allocations

### Why this matters

The user is not only buying an NFT. The user is entering a protocol where collectible activity, token utility, and community funding are structurally linked.
