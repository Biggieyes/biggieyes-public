# BIGGI Mainnet README for Moderators

This document is an onboarding note for moderators and community team members who do not need to read Solidity, but do need to understand the real mainnet flow.

## One sentence

BIGGI is a chapter-based NFT and tokenomic system where a ticket unlocks the main NFT through on-chain randomness, the public collection opens only after chapter completion, and part of revenue feeds reserve, rewards, buyback, treasury, and community branches.

## What makes BIGGI different

BIGGI is not a single plain mint. It combines:

1. a ticket layer
2. a VRF reveal layer
3. chapter progression
4. public unlock only after chapter completion
5. collectible set logic with rewards
6. tokenomic and community branches

## Simplified user flow

1. the user buys a ticket
2. the ticket price grows over time
3. the user redeems the ticket
4. `BiggiMain` requests randomness through `BiggiVRFRouter`
5. a specific main NFT is minted after callback
6. after chapter completion, `BiggiMain2` unlocks
7. collectors may complete sets and claim rewards

## Core contracts in plain words

`BiggiTicketHub`:

- sells tickets
- stores ticket ownership
- calls `BiggiMain` on redeem

`BiggiMain`:

- main mystery collection
- mints after VRF callback

`BiggiMain2`:

- public chapter collection
- unlocks only after chapter completion

`BiggiVrfRouter`:

- Chainlink VRF bridge

`BiggiSeriesRegistry` and `BiggiChapterController`:

- chapter wiring and unlock rules

`BiggiMultiCollectionDistributor`:

- routes part of native collection revenue into downstream branches

## How money flows

In native payment flows, part of collection revenue is routed into downstream branches such as:

- collection rewards
- reserve
- buyback
- treasury
- community

This means revenue does not stop in a single wallet. It feeds several live branches of the ecosystem.

Payment in `BIGGI` token follows a different route than native coin, but it still feeds the reserve-side system.

## What the BIGGI token does

`BiggiToken`:

- has a global cap
- performs initial distribution into reserve, drip, rewards, and marketing branches
- allows additional bounded minting only through the supply authority branch

Important truth:

- BIGGI is not uncapped
- but part of supply is intentionally reserved as controlled refill budget for critical scenarios

## Main tokenomic branches

`BiggiReserveV4`:

- reserve-side POL and BIGGI accounting

`BiggiTreasury`:

- receives part of native inflow
- receives BIGGI from buybacks and splits it further

`BiggiBuybackAgent`:

- receives native share
- buys BIGGI on the DEX
- routes it into treasury

`BiggiLiquidityManager` and `BiggiLiquidityVault`:

- manage the liquidity branch

`BiggiSupplyController`, `BiggiSupplyGuardian`, `BiggiDexReserveGuard`:

- handle refill and defensive logic

## Community vs moderator branch

`BiggiCommunityCenter`:

- events, grants, and community payouts

`ModeratorCenter`:

- moderator referral slots
- weekly allocation
- payout based on referral and sales activity

They are separate contracts with separate responsibilities.

## What a moderator does

A moderator:

- explains the ticket -> reveal -> public mint flow
- helps users understand chapter progression
- works with referral identity or referral flow
- brings community into the ecosystem

A moderator does not:

- choose who receives which NFT
- control VRF
- control treasury
- promise guaranteed profit or guaranteed rewards

## What moderators should say truthfully

Correct:

- BIGGI is a cap-bounded system
- part of supply may be minted later only inside defined refill branches
- buyback is an ecosystem mechanic, not a price guarantee
- rewards depend on rules, holdings, and enabled branches

Incorrect:

- no new BIGGI can ever be minted again
- buyback guarantees price growth
- admins can freely assign mystery NFTs
- every user is guaranteed to win something

## What moderators should remember most

1. a ticket is not the final NFT
2. reveal is driven by VRF randomness
3. the public collection unlocks only after chapter completion
4. mint revenue feeds multiple economic branches
5. BIGGI tokenomics is cap-bounded but includes controlled refill branches
6. moderators explain and grow the community, but do not control randomness, treasury, or payout authority

## Related document

For the direct moderator payout logic:

- `README_ModeratorCenter_CS.md`
