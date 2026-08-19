# BiggiMultiCollectionDistributor

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

## Purpose
Whitelisted mint-share distributor for core and tokenomic sinks.

## Constructor
```solidity
constructor(address initialOwner)
```

## Required recipients
- collection rewards
- reserve
- buyback agent
- treasury
- community center

## Main runtime role
- accepts native mint-share value from whitelisted collections
- splits value by `BiggiBpsLib` basis-point constants
- forwards by calling `receiveMintShare()` on recipients
- stores failed forwards as pending balances with owner retry controls

## Optional accounting
If registry is configured, the distributor records received volume by chapter and series.
Registry attribution is optional and non-blocking: if the configured registry call fails, the distributor emits `ChapterAttributionFailed` and still forwards the native split to recipients.
