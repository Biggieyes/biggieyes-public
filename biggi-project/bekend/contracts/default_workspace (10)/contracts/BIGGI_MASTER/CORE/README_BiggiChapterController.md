# BiggiChapterController

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

## Purpose
Owner-controlled chapter configuration layer bound to `BiggiSeriesRegistry`.

## Constructor
```solidity
constructor(address initialOwner, address registry_)
```

## What it stores
- per-chapter sale, marketing, and total caps
- the fact that a chapter has been configured

## What it verifies
- registry metadata matches the chapter being configured
- VRF collection and `BiggiTicketHub` are directly bound to each other
- ticket hub caps match the controller caps

## Main runtime role
- exposes `isPublicMintUnlocked(chapterId)` for `BiggiMain2`
- exposes `getChapterPriceProvider(chapterId)` for chapter price routing
- exposes chapter mint progress snapshots

## Important invariant
Public mint only unlocks when:
- `saleMinted == saleCap`
- `marketingMinted == marketingCap`
- `totalMinted == totalCap`
