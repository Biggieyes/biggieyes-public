# BiggiEyesMain2

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

## Purpose
Public chapter collection with explicit index minting.

## Constructor
```solidity
constructor(address initialOwner)
```

## Main wiring
- optional distributor for mint-share forwarding
- optional chapter controller and chapter id
- optional external price provider
- optional BIGGI token, sink, treasury deposit mode, and reserve wiring

## Main runtime role
- keeps public mint locked until `BiggiChapterController` unlocks the chapter
- prices public mint either from the chapter VRF-side provider or local block pricing
- mints chapter NFTs by explicit index
- supports both native and BIGGI payment flows

## BIGGI payment routing
Mainnet-prep wiring uses `tokenSink = BiggiTreasury`, `tokenSinkBps = 10000`, and `tokenSinkDepositMode = true`.

With deposit mode enabled, `mintPublicWithBiggi(idx)` pulls BIGGI from the buyer, approves the sink, and calls `receiveEcosystemBiggi(uint256)` on the sink. `BiggiTreasury` then splits the received BIGGI `34%` to `BiggiTokenRewards`, `33%` to `BiggiReserveV4`, and `33%` to `BiggiDripDistributor`.

With deposit mode disabled, `tokenSink` receives a plain token transfer and no treasury split is triggered.

## Important invariant
If a chapter controller is configured, `getChapterCollections(chapterId)` must point back to this public collection.
For treasury deposit mode, `BiggiTreasury.ecosystemBiggiCallers(BiggiMain2)` must be `true`.
`setBiggiRate(...)` rejects zero and BIGGI minting rejects a zero computed token payment.

## Metadata readiness
- Public character URI: `setURI(1, 0, charactersBaseURI)`.
- Public block URI: `setURI(2, blockIdx, blockBaseURI)` for `blockIdx` `1..10`.
- Seed all 550 rows through `batchSetNFTBackgroundAndBlock(...)`.
- Before public mint is opened, `metadataConsistency()` must return `550, true, true` and `assertMetadataConsistency()` must not revert.
