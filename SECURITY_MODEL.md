# Security Model

## Security Posture

BIGGIEYES uses a modular security model built around contract isolation, role-based permissions, explicit routing boundaries, and operational guardrails for randomness, liquidity, and buyback automation.

The protocol is secured by layered controls:

- `onlyOwner`, `onlyMain`, `onlyReserve`, `onlyTreasury`, and similar call gates
- reentrancy guards on payout-sensitive paths
- pausable user entry points on critical contracts
- explicit caps on BIGGI issuance and reward rails
- DEX slippage, cooldown, and quota controls
- reader contracts that isolate read traffic from state mutation

## Trust Boundaries

| Boundary | Control |
| --- | --- |
| User -> collection mint | price checks, supply checks, reentrancy guards |
| Main collection -> VRF | only configured main can request randomness |
| VRF -> main fulfillment | only router or coordinator path can fulfill |
| Collection -> distributor | whitelist enforced on routing entry points |
| Reserve -> liquidity manager | only configured liquidity manager may pull assets |
| Buyback -> treasury | only configured buyback agent may deposit and split |
| Drip -> drip manager | only configured drip manager may claim drip balances |
| Treasury / vault / admin controls | owner authority, recommended multisig governance |

## Access Control Model

### Owner-Level Controls

Owner powers currently include:

- setting contract counterparties
- adjusting prices and rewards
- changing swap paths, slippage, and keeper addresses
- seeding metadata and historical counters
- pausing and unpausing sensitive flows
- releasing LP or rescuing stranded tokens

Because these powers are significant, production governance should use a multisig rather than an EO A.

### Role-Specific Controls

| Role | Key Permissions |
| --- | --- |
| Main collection | request randomness from VRF router |
| Whitelisted collection | send mint share into distributor |
| Reserve | trigger liquidity manager auto-pairing |
| Liquidity manager | pull reserve assets for pairing |
| Buyback agent | deposit buyback-acquired BIGGI into treasury |
| Treasury | top up drip distributor |
| Drip manager | claim drip balances |
| Keeper | trigger automation on configured proxy paths |

## Contract-Level Protections

### Reentrancy Protection

The protocol uses `ReentrancyGuard` on high-risk paths such as:

- NFT mint and redeem flows
- reward claims
- liquidity operations
- community prize withdrawals
- distributor retry logic

### Pause Controls

Pause logic exists where user-facing or automation-sensitive execution needs a hard stop:

- collections
- token contract
- reserve
- token rewards
- drip distributor
- community center

This allows the protocol to fail closed during operational incidents.

### Cap Enforcement

`BiggiCapsLib` defines hard economic ceilings:

- total BIGGI supply cap
- drip distributor cap
- token rewards cap

`TokenRewards` also prevents reward minting beyond its assigned cap, even when its balance is depleted.

## Randomness Security

BIGGIEYES uses Chainlink VRF V2 Plus for post-redeem randomness.

### Security properties

- redemption burns the ticket before randomness is requested
- the VRF router stores request metadata on-chain
- fulfillment returns through a dedicated callback path
- the main collection only accepts fulfillment from the configured router

### Residual considerations

- stalled or underfunded VRF subscriptions can delay mint completion
- monitoring should alert on old pending request timestamps
- mainnet operations should track subscription balance and callback failure rates

## DEX And Liquidity Security

### Buybacks

`BuybackAgent` enforces:

- optional policy-driven minimum interval
- policy-driven daily native quota
- configurable slippage and deadlines
- fallback forwarding to treasury if swap execution fails

### Liquidity Pairing

`LiquidityManager` enforces:

- owner or keeper gating for direct execution
- reserve-only trigger hook for auto-topup logic
- vault destination for LP custody
- whitelisted pair tracking in `LiquidityVault`

### Drip Conversion

`DripLiquidityManager` enforces:

- only-buyback-agent entry into the main drip hook
- configurable sell percentage
- configurable reserve/community split

## Accounting Security

### Distributor Pending Balances

If a recipient cannot receive routed native value, `Distributor` records the amount as pending rather than losing it. This prevents silent accounting drift and gives governance a recovery path.

### Reserve Bucket Integrity

`Reserve` keeps separate counters for waiting BIGGI and DEX refill BIGGI. The contract checks actual token balances when notified, which reduces the chance of phantom accounting.

### Weekly Claim Integrity

`TokenRewards` prevents multiple claims for the same token in the same week by recording `tokenLastClaimWeek`.

### Community Prize Integrity

`CommunityCenter` reserves prize value at event creation and reduces locked balances on claims. This prevents overspending against future prize obligations.

## Frontend Security Model

The frontend follows a read-heavy model:

- read-only providers are preferred for dashboard and reader calls
- signer-backed providers are used only for write paths
- Polygon mainnet network enforcement is implemented for wallet sessions
- wallet-add and wallet-switch flows update stale RPC metadata where possible
- RPC failover logic prioritizes healthy endpoints and de-prioritizes rate-limited ones

## Operational Risks

### Key Risks

- owner key compromise
- RPC endpoint degradation
- DEX liquidity shortfall or extreme slippage
- stale keeper infrastructure
- misconfigured contract counterparties during deployment

### Mitigations

- multisig ownership for production
- deployment manifests and address registry verification
- Sentry and health monitoring for frontend and serverless functions
- alerting on VRF delay, reserve depletion, buyback failure rate, and keeper inactivity

## Recommended Production Hardening

1. move all owner roles to a multisig
2. verify all contracts on the target explorer
3. publish deployment manifests including transaction hashes and parameters
4. implement incident runbooks for VRF, RPC, liquidity, and buyback failures
5. add continuous monitoring for pending VRF requests and automation liveness
6. conduct dedicated audits on tokenomics rails and DEX interaction paths

## Transparency As A Security Control

BIGGIEYES treats transparency as part of the security model:

- addresses are exported in both frontend and backend registries
- reader contracts expose normalized snapshots
- reward rules are encoded on-chain
- supply caps are hard-coded
- mint routing is event-driven and observable

That transparency shortens the distance between an incident and the evidence needed to diagnose it.
