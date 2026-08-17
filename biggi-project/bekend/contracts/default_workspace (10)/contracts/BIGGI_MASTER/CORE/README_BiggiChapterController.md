# BiggiChapterController

Deployment status (verified 2026-08-17): the current chapter-aware controller is deployed on Polygon mainnet at `0x9c084D89c0CB6c8424652d1fa82E83aD9c098288` and validates all five deployed chapter pairs against the shared registry and TicketHub.

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
- VRF collection and `BiggiTicketHub` are directly bound for the specific chapter
- chapter-specific ticket hub caps match the controller caps

## Main runtime role
- exposes `isPublicMintUnlocked(chapterId)` for `BiggiMain2`
- exposes `getChapterPriceProvider(chapterId)` for chapter price routing
- exposes chapter mint progress snapshots

## Central TicketHub rule
For chapter-aware hubs, the controller reads `chapterMainCollection`, `chapterSaleCap`, `chapterMarketingCap`, and `chapterTotalMinted` for the configured chapter. Chapter 1 remains backward-compatible with older hub getters.

## Important invariant
Public mint only unlocks when:
- `saleMinted == saleCap`
- `marketingMinted == marketingCap`
- `totalMinted == totalCap`
