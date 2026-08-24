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
- accepts a 60% native mint share from TicketHub or a whitelisted public collection after every POL-paid mint
- splits that share by `BiggiBpsLib`: CollectionRewards 25%, Reserve 35%, Buyback 20%, Treasury 10%, Community 10%
- therefore CollectionRewards receives 15% of the original POL mint price (`60% * 25%`)
- forwards by calling `receiveMintShare()` on recipients
- stores failed forwards as pending balances with owner retry controls

The forward is attempted in the mint transaction. A failed recipient does not
lose funds: its amount remains in `pending(recipient)` and must be retried. A
BIGGI-paid mint has no native value and therefore does not fund these POL
buckets.

After the isolated-budget CollectionRewards replacement is deployed, its share
is credited to `fundingCollection`, which must be the active chapter's VRF
collection. Before changing chapters, the previous chapter must be inactive and
`pending(CollectionRewards)` must be zero.

## Optional accounting
If registry is configured, the distributor records received volume by chapter and series.
Registry attribution is optional and non-blocking: if the configured registry call fails, the distributor emits `ChapterAttributionFailed` and still forwards the native split to recipients.
