# BiggiSeriesRegistry

Deployment status (verified 2026-08-17): the current shared-hub registry is deployed on Polygon mainnet at `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058` and contains five series with one chapter each.

## Purpose
Canonical owner-managed registry for series, chapters, and bound collection addresses.

## Constructor
```solidity
constructor(address initialOwner)
```

## What it stores
- series metadata and series count
- chapter metadata and chapter count
- VRF collection, public collection, and ticket hub per chapter
- token and collection reward eligibility flags

## Main runtime role
- creates series and chapters
- binds chapter collections and hub addresses
- exposes lookup by chapter id and by collection address
- acts as the source of truth for chapter-aware core wiring

## Central TicketHub rule
- `chapterByCollection(...)` is only a unique reverse lookup for VRF and public collection addresses.
- A `ticketHub` can be shared by multiple chapters, so it is not written into `chapterByCollection`.
- Use `getChapterCollections(chapterId)` or `isTicketHubForChapter(ticketHub, chapterId)` to validate a chapter's hub.
