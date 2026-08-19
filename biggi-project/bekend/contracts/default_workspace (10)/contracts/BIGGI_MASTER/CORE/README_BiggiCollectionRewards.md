# BiggiCollectionRewards

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

## Purpose
Native-token rewards contract for collection completion milestones.

## Constructor
```solidity
constructor(address main_, address owner_)
```

## Reward configuration
- orange reward: `1000 ether`
- block reward: `3000 ether`
- rainbow reward: `10000 ether`

## What it supports
- default-main claims and explicit per-collection claims
- optional registry-based collection eligibility
- distributor-gated named funding functions
- unrestricted plain native funding through `receive()`

## Main runtime role
- pays orange, block, and rainbow rewards
- tracks per-collection claim caps and one-time claims
- exposes preview helpers such as `canClaim*` and `rewardsSnapshot`
