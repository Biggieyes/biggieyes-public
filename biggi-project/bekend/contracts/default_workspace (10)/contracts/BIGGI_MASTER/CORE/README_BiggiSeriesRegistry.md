# BiggiSeriesRegistry

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

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
