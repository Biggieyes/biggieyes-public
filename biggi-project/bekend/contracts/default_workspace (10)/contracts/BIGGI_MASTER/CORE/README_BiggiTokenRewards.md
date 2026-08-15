# BiggiTokenRewards

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

## Purpose
Weekly BIGGI token rewards across eligible VRF and public collections.

## Constructor
```solidity
constructor(address mainNFT_, address main2NFT_, address biggiToken_, address owner_)
```

## Reward model
- per-token weekly claim tracking
- per-block weight table
- optional `BiggiTokenRewardsEmissionController` hook for dynamic weekly budgets
- payout from contract balance first, then mint the remainder
- global mint cap enforced by `BiggiCapsLib.TOKEN_REWARDS_CAP`

Default mode is unchanged: `amount = rarityUnits * unitReward`.

If `emissionControllerEnabled == true`, `BiggiTokenRewards` still computes rarity units from NFT block weights, but the external controller can reduce the claim amount according to the current weekly budget. The controller cannot increase a claim above the default `rarityUnits * unitReward` amount.

## Eligibility model
- optional registry-based validation
- fallback allowlist-based validation through `allowedCollections`

## Main runtime role
- calculates weekly claim units from owned NFTs
- transfers or mints BIGGI rewards after optional dynamic budget approval
- records aggregate weekly distribution counters
