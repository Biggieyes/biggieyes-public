# Trust And Transparency

## Why Trust Matters

NFT ecosystems fail when users cannot verify fairness, treasury behavior, or reward distribution. BIGGIEYES is designed so that trust comes from observable on-chain systems rather than brand promises alone.

## On-Chain Transparency

BIGGIEYES exposes its economic behavior directly on-chain:

- ticket pricing is stored in the main collection
- mint routing is executed by contracts, not spreadsheets
- reserve and treasury balances are queryable
- reward claims are emitted as on-chain events
- token caps are hard-coded

The frontend and reader contracts then surface this state in a user-readable form.

## VRF Fairness

BIGGIEYES uses Chainlink VRF for random NFT assignment after ticket redemption.

### Why this builds trust

- the ticket is burned before random assignment
- request metadata is stored on-chain
- fulfillment returns through a dedicated router path
- users do not need to trust a private reveal script

This is materially stronger than a conventional off-chain reveal process.

## Open-Source Contracts

The repository includes:

- Solidity sources
- compiled artifacts
- ABI inventory
- deployment scripts
- frontend integration code

That allows developers, auditors, and community members to inspect not only what the contracts do in theory, but how the application actually uses them in practice.

## Tokenomics Sustainability

BIGGIEYES improves trust by avoiding purely narrative tokenomics.

### Visible sustainability controls

- BIGGI has a hard maximum supply
- rewards and drip rails have explicit caps
- treasury redistribution is rule-based
- reserve-backed liquidity is separated from treasury logic
- buyback execution is constrained by policy and slippage settings

Because these mechanics are encoded, they can be monitored by any external observer.

## Verifiable Reward Distribution

### Token rewards

Weekly BIGGI rewards are based on:

- NFT ownership
- block-weight rules
- per-token claim-week state
- reward-cap enforcement

### Collection rewards

Collection rewards are based on:

- on-chain ownership completion checks
- one-time claim flags
- actual native-token balances in the reward pool

### Community rewards

Community payouts are based on:

- event creation with locked prize budgets
- winner assignment stored on-chain
- claim state per winner

All three reward systems can therefore be independently verified.

## Address Registry Transparency

The project keeps two visible registry sources in the repo:

- `src/shared/utils/addresses.js`
- `biggi-project/bekend/addresses.json`

This matters because users and developers can confirm exactly which contracts the frontend is expected to use.

## Reader Contracts As Transparency Infrastructure

Reader contracts do not change protocol state. They aggregate it.

This gives BIGGIEYES two benefits:

- lower frontend complexity
- easier third-party auditing and analytics

Readers make it easier for non-technical users to understand the system without hiding the fact that the source of truth is the underlying contracts.

## Operational Honesty

Trust is also built by being explicit about the current stage of the protocol.

In this repository:

- the active public registry is on Polygon Amoy
- governance is still owner-administered in the current implementation
- production hardening still requires multisig ownership and audit discipline

Clear disclosure of current maturity is more credible than overstating decentralization.

## How BIGGIEYES Should Continue Building Trust

1. keep contracts and addresses publicly documented
2. publish deployment manifests and verification links
3. move privileged control to multisig governance
4. expose reserve, treasury, and buyback data in the live UI
5. maintain responsible security disclosure practices

## Summary

BIGGIEYES builds trust through:

- verifiable randomness
- on-chain routing
- open contract sources
- capped tokenomics
- visible reward logic
- reader-based transparency dashboards

That combination creates a stronger trust foundation than a typical NFT launch model where the most important economic behaviors remain off-chain.
