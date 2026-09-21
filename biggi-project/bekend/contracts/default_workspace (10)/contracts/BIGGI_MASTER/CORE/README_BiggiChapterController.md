# BiggiChapterController V2

Deployment status (staged 2026-09-21): V2 is deployed on Polygon mainnet at `0x323B9147e7a18afce6435d742C83d4E867368117`. Public Originals is bound to V2. The previous controller remains at `0x9c084D89c0CB6c8424652d1fa82E83aD9c098288` for deferred chapter bindings.

## Purpose
Owner-controlled chapter configuration layer bound to `BiggiSeriesRegistry`.

## Constructor
```solidity
constructor(address initialOwner, address registry_)
```

## What it stores
- per-chapter sale, marketing, and total caps
- a per-chapter paid-sale threshold for Public mint
- an optional irreversible threshold lock
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
Public mint only unlocks when the registered stack and caps are consistent and:
- `saleMinted >= publicUnlockSaleThreshold`
- the marketing count is not part of the unlock comparison

For Originals, `publicUnlockSaleThreshold == 10` and the threshold is locked. The temporary TicketHub caps remain `0/550`, so the runtime cap check keeps Public mint fail-closed until the launch caps are restored to `500/50`.
