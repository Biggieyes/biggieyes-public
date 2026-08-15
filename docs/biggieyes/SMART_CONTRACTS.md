# Smart Contracts

## Contract Map

| Documentation Name | Implementation Name | Category |
| --- | --- | --- |
| `BiggiEyesMain` | `BiggiEyesMain` | NFT core |
| `BiggiEyesMain2` | `BiggiEyesMain2` | Public NFT collection |
| `BiggiToken` | `BiggiToken` | ERC20 token |
| `Distributor` | `MultiCollectionDistributor` | Revenue routing |
| `Reserve` | `BiggiReserveV4` | Reserve accounting |
| `LiquidityManager` | `BiggiLiquidityManager` | Liquidity operations |
| `LiquidityVault` | `LiquidityVault` | LP custody |
| `BuybackAgent` | `BiggiBuybackAgent` | Market buybacks |
| `Treasury` | `BiggiTreasury` | BIGGI recycling |
| `TokenRewards` | `BiggiTokenRewards` | Weekly holder rewards |
| `CollectionRewards` | `BiggiCollectionRewards` | Set-completion rewards |
| `DripDistributor` | `BiggiDripDistributor` | Drip token accounting |
| `DripLiquidityManager` | `BiggiDripLMToModerator` | Drip conversion rail |
| `CommunityCenter` | `BiggiCommunityCenter` | Community grant claims |
| `VRFRouter` | `BiggiVRFRouter` | Chainlink randomness mediation |
| `Multicall2` | `Multicall2` | Frontend batch-read utility |

## BiggiEyesMain

**Purpose**

Primary ERC721 collection that mints tradable tickets and converts redeemed tickets into random NFTs.

**Responsibilities**

- enforce ticket supply and per-wallet ticket caps
- manage dynamic ticket pricing
- store NFT metadata fields such as block, background, main ID, and pricing context
- maintain pending VRF request state
- finalize random NFT assignment

**Key functions**

- `mintTicket()`
- `mintTicketWithBiggi()`
- `redeemTicketAndMintNFT(uint256 ticketId)`
- `fulfillRandomFromRouter(uint256 requestId, uint256 randomWord)`
- `batchSetNFTBackgroundAndBlock(...)`
- `setModules(address compute_, address vrfRouter_)`

**Interactions**

- calls `Distributor.receiveMintShare()` for native mint routing
- calls `VRFRouter.requestRandomFor()` during redemption
- forwards BIGGI inflows to `Reserve`
- reads trait math from `BiggiCompute`

**Security considerations**

- `nonReentrant` mint and redeem flows
- `whenNotPaused` on user entry points
- only the configured VRF router may fulfill randomness
- one pending redemption per wallet
- invalid or already-burned tickets are rejected

## BiggiEyesMain2

**Purpose**

Secondary ERC721 collection for direct public minting of pre-seeded indices.

**Responsibilities**

- expose public mint flow for deterministic indices
- reuse block prices from the main collection
- maintain its own mint counters and metadata state
- support native and BIGGI paid public minting

**Key functions**

- `batchSetNFTBackgroundAndBlock(...)`
- `mintPublic(uint256 idx)`
- `mintPublicWithBiggi(uint256 idx)`
- `setPriceProvider(address provider_)`

**Interactions**

- reads block prices from `BiggiEyesMain`
- routes revenue into `Distributor`
- forwards BIGGI into `Reserve`

**Security considerations**

- only owner may seed metadata
- only pre-seeded, unminted indices can be minted
- overpayment is refunded in the native mint path

## BiggiToken

**Purpose**

Core ERC20 utility token for rewards, reserve, and drip infrastructure.

**Responsibilities**

- enforce hard max supply
- execute one-time strategic supply distribution
- support permit signatures
- optionally refill token rewards inventory

**Key functions**

- `initialDistribute()`
- `setReserve(address)`
- `setDripDistributor(address)`
- `setTokenRewards(address)`
- `refillRewardsIfBelow(uint256 minBalance, uint256 targetBalance)`
- `remainingMintable()`

**Interactions**

- mints to `Reserve`, `DripDistributor`, and `TokenRewards`
- notifies `DripDistributor` on drip mint
- can be moved from reserve by owner through `transferFromReserveTo`

**Security considerations**

- one-time distribution gate via `distributed`
- cap enforcement on all mint paths
- pausable transfer hook
- owner-controlled minting remains a governance-sensitive power

## Distributor

**Purpose**

Protocol revenue router for approved collections.

**Responsibilities**

- accept mint share inflows from whitelisted collections
- split native value across five destination contracts
- retain failed forwards as pending balances
- support retry and recovery flows

**Key functions**

- `addCollection(address coll)`
- `receiveMintShare()`
- `distribute()`
- `retryPending(address recipient)`
- `retryPendingAmount(address recipient, uint256 amount)`

**Interactions**

- receives native value from `BiggiEyesMain` and `BiggiEyesMain2`
- forwards to `CollectionRewards`, `Reserve`, `BuybackAgent`, `Treasury`, and `CommunityCenter`

**Security considerations**

- only whitelisted collections can trigger routing
- pending accounting prevents silent value loss on failed forwards
- all recipient addresses must be configured before routing

## Reserve

**Purpose**

Accounting vault for BIGGI and native reserves used in liquidity operations.

**Responsibilities**

- receive distributor native inflows
- track BIGGI in waiting and DEX refill buckets
- expose pull interfaces for `LiquidityManager`
- trigger liquidity top-up attempts

**Key functions**

- `receiveMintShare()`
- `notifyBiggiReceived(uint256 amount)`
- `onBiggiMintedToReserve(uint256 amount, bytes32 bucket)`
- `requestTopUpToLM()`
- `lmPullBiggiDexRefill(address to, uint256 amount)`
- `lmPullPolDexRefill(address payable to, uint256 amount)`

**Interactions**

- receives native value from `Distributor`
- receives BIGGI from `BiggiToken`, `BiggiEyesMain`, `BiggiEyesMain2`, and `Treasury`
- serves `LiquidityManager`

**Security considerations**

- only configured distributor can send mint-share native inflows
- only `LiquidityManager` can pull refill assets
- bucket accounting must stay aligned with actual token balances

## LiquidityManager

**Purpose**

Executes protocol-owned liquidity pairing from reserve inventory.

**Responsibilities**

- quote matching BIGGI requirement for a target native amount
- pull BIGGI and native inventory from reserve
- add liquidity through the configured V2 router
- sync LP balances into the vault

**Key functions**

- `executePairing(uint256 requestedPol)`
- `executePairingFromReserve(uint256 requestedPol)`
- `onReserveTopUpRequest()`
- `setAutoTopUpConfig(...)`
- `setSlippageBps(uint256 bps)`

**Interactions**

- pulls assets from `Reserve`
- uses router and factory addresses for DEX operations
- updates `LiquidityVault`

**Security considerations**

- owner or keeper gated manual execution
- reserve-only hook for auto-pairing trigger
- slippage and deadline guards reduce execution risk

## LiquidityVault

**Purpose**

Custody contract for protocol-owned LP tokens.

**Responsibilities**

- hold LP tokens minted by the liquidity manager
- maintain an internal LP accounting map
- allow governance to release LP when needed

**Key functions**

- `setLiquidityManager(address lm)`
- `addWhitelistedPair(address lpPair)`
- `depositLP(address lpPair, uint256 amount)`
- `withdrawToLM(address lpPair, uint256 amount)`
- `releaseLP(address lpPair, uint256 amount, address to)`

**Interactions**

- receives LP from `LiquidityManager`
- syncs actual LP balances after DEX minting

**Security considerations**

- only whitelisted pairs are supported
- only liquidity manager can move LP in operations
- owner release authority should be multisig controlled

## BuybackAgent

**Purpose**

Swaps native value for BIGGI and recycles acquired tokens into treasury.

**Responsibilities**

- receive mint-share native value
- enforce buyback timing and quota rules
- execute DEX swaps
- approve and forward BIGGI into treasury
- report post-buyback amounts into the drip rail

**Key functions**

- `receiveMintShare()`
- `buybackAllToTreasury()`
- `buybackAmountToTreasury(uint256 amount)`
- `setRouter(address router_)`
- `setPolicy(address policy_)`
- `toggleAutoBuyback(bool enabled)`

**Interactions**

- receives native value from `Distributor`
- uses DEX router for swaps
- deposits BIGGI into `Treasury`
- notifies `DripLiquidityManager`

**Security considerations**

- policy-controlled cooldown and daily quota
- fallback forwarding to treasury if swap path fails
- keeper role is configurable and should be restricted

## Treasury

**Purpose**

Central routing contract for BIGGI acquired through buybacks.

**Responsibilities**

- receive BIGGI pulled from `BuybackAgent`
- split buyback-acquired BIGGI to rewards, reserve, and drip
- hold native value forwarded from distributor
- seed historical totals for dashboard continuity

**Key functions**

- `buybackDepositAndSplit(uint256 amount)`
- `depositPolFromDistributor()`
- `setBuybackAgent(address b)`
- `setTokenRewards(address r)`
- `setReserve(address r)`
- `setDripDistributor(address d)`

**Interactions**

- receives BIGGI from `BuybackAgent`
- forwards BIGGI to `TokenRewards`, `Reserve`, and `DripDistributor`

**Security considerations**

- only configured buyback agent may invoke buyback split
- treasury retains rescue powers and therefore requires strong governance control

## TokenRewards

**Purpose**

Weekly BIGGI reward distributor for eligible NFT holders.

**Responsibilities**

- calculate per-token rewards using block weight tables
- enforce one claim per token per week
- pay from existing balance first and mint only when necessary
- keep reward minting under a hard cap

**Key functions**

- `claim(uint256[] calldata tokenIds)`
- `claimWithCollections(address[] calldata collections, uint256[] calldata tokenIds)`
- `setUnitReward(uint256 newUnit)`
- `setBlockWeights(uint8[11] calldata weights)`
- `setCollectionAllowed(address coll, bool allowed)`

**Interactions**

- reads ownership and `blockOf()` from collection contracts
- receives BIGGI from treasury and token minting paths

**Security considerations**

- reentrancy protection on claims
- strict cap on minted reward output
- invalid or non-owned tokens are skipped or rejected depending on path

## CollectionRewards

**Purpose**

Native-token reward pool for set completion milestones.

**Responsibilities**

- pay orange, block, and rainbow completion rewards
- track one-time global payout conditions
- expose view helpers for frontend eligibility previews

**Key functions**

- `claimOrangeReward(uint256 mainId)`
- `claimBlockReward(uint16 blockIdx)`
- `claimRainbowReward()`
- `canClaimOrange(address user, uint256 mainId)`
- `rewardsSnapshot(address user)`

**Interactions**

- receives native value from `Distributor`
- checks ownership conditions against `BiggiEyesMain`

**Security considerations**

- claims are globally bounded by reward flags and counters
- payout depends on contract native balance
- owner can adjust reward amounts and distributor wiring

## DripDistributor

**Purpose**

BIGGI accounting pool for drip availability and claimable balances.

**Responsibilities**

- store BIGGI inventory dedicated to drip logic
- track mint-based drip accrual
- expose claim functions to the drip manager
- keep inventory under a hard cap

**Key functions**

- `notifyMint(uint256 mintedCount)`
- `notifyTokenMint(uint256 amount)`
- `depositTokens(uint256 amount)`
- `claim(uint256 amountRequested)`
- `claimTo(address to, uint256 amountRequested)`

**Interactions**

- receives BIGGI from token initial distribution and treasury
- is controlled operationally by `DripLiquidityManager`

**Security considerations**

- only whitelisted collections can notify mints
- only configured treasury and drip manager can use privileged flows
- effective availability is bounded by real token balance

## DripLiquidityManager

**Purpose**

Converts drip BIGGI inventory into native value and routes it into ecosystem sinks.

**Responsibilities**

- update `tokensPerMint` after buybacks
- claim BIGGI from `DripDistributor`
- sell a configurable share through the DEX
- forward native output to reserve and community-style sinks

**Key functions**

- `dripOnBuy(uint256 biggiBought)`
- `setDripDistributor(address d)`
- `setReserve(address r)`
- `setModeratorCenter(address m)`
- `setShares(uint16 reserveBps_, uint16 moderatorBps_)`

**Interactions**

- called by `BuybackAgent`
- claims from `DripDistributor`
- uses DEX router for token sales
- forwards native value to reserve and moderator/community receiver

**Security considerations**

- only buyback agent may trigger the main drip execution path
- swap slippage and deadline parameters must be monitored
- downstream receiver failures may lead to partial execution

## CommunityCenter

**Purpose**

Community prize and grant contract with owner-curated event creation and user claims.

**Responsibilities**

- receive community allocations from distributor
- lock event prize budgets on creation
- allow winners to claim assigned amounts
- expose event status for frontend displays

**Key functions**

- `depositFromDistributor()`
- `createEvent(...)`
- `claim(uint256 eventId)`
- `getEvent(uint256 eventId)`
- `getEventWinners(uint256 eventId)`

**Interactions**

- receives native value from `Distributor`
- pays native value directly to assigned winners

**Security considerations**

- owner decides winners in the current governance model
- duplicate winners in a single event are rejected
- locked prize accounting prevents over-withdrawal

## VRFRouter

**Purpose**

Dedicated Chainlink VRF gateway between the main collection and the VRF coordinator.

**Responsibilities**

- accept randomness requests only from the configured main contract
- store request metadata for debug and UI support
- forward fulfilled randomness back to the main collection

**Key functions**

- `setMain(address main_)`
- `setVrfParams(...)`
- `requestRandomFor(address minter, uint256 ticketId)`
- `rawFulfillRandomWords(...)`

**Interactions**

- receives requests from `BiggiEyesMain`
- interacts with Chainlink VRF V2 Plus coordinator
- calls back into `BiggiEyesMain.fulfillRandomFromRouter`

**Security considerations**

- only the main collection may request randomness
- only Chainlink coordinator may trigger fulfillment path through the base consumer logic

## Auxiliary Contracts

### Reader Contracts

- `BiggiMainReader`
- `BiggiTokenomikReader`
- `BiggiMultiCollectionDistributorReader`
- `BiggiReserveTreasuryReader`
- `BiggiBuybackReader`

These contracts are read-only aggregation layers used to simplify frontend queries and external analytics.

### Multicall2

The official BIGGIEYES Polygon mainnet batch-read utility is:

| Network | Name | Address | Purpose |
| --- | --- | --- | --- |
| Polygon mainnet | `MULTICALL2` / `Multicall2` | `0x70bc315E4E5548e54F358Abf4515C1bB1551687b` | Aggregates multiple frontend and analytics contract reads into a single RPC call. |

This contract is used by the BIGGIEYES frontend read layer and protocol dashboards to reduce RPC overhead when collecting live state from deployed contracts. It does not custody protocol funds and is not a governance, treasury, rewards, minting, or upgrade authority.

### Automation Contracts

- buyback upkeep proxy
- liquidity keeper proxy
- drip keeper proxy
- policy contract
- master tokenomics config registry

These contracts coordinate operational execution and address bundling, but they do not replace the underlying primary contracts as the source of truth.
