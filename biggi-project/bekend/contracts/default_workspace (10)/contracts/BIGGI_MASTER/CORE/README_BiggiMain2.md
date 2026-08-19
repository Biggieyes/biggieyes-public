# BiggiEyesMain2

Deployment status: corrected 100-NFT implementation is live on Polygon for all five chapters as of 2026-08-18. All five Public contracts remain paused and all chapters remain inactive.

## Purpose
Public chapter collection with explicit index minting.

Each chapter Public collection has exactly 100 NFTs: ten NFTs in each of ten blocks. Public has no colored background clones. Its block price is always read from the paired VRF collection.

## Constructor
```solidity
constructor(address initialOwner)
```

## Main wiring
- optional distributor for mint-share forwarding
- optional chapter controller and chapter id
- legacy-compatible external price-provider pointer; production pricing does not fall back to it
- optional BIGGI token, sink, treasury deposit mode, and reserve wiring

## Main runtime role
- keeps public mint locked until `BiggiChapterController` unlocks the chapter
- prices public mint only from the paired chapter VRF collection through `BiggiChapterController`
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
Public has no standalone `100..1000` base-price curve. Without a valid chapter controller and paired VRF price provider, price resolution reverts.

## Metadata readiness
- Public character URI: `setURI(1, 0, charactersBaseURI)`.
- Public block URI: `setURI(2, blockIdx, blockBaseURI)` for `blockIdx` `1..10`.
- Seed all 100 rows through `batchSetNFTBackgroundAndBlock(...)` using `mainId=idx`, `background=1` as an internal PUBLIC sentinel, and `blockIdx=((idx-1)/10)+1`.
- Before public mint is opened, all ten block URIs must be non-empty, `metadataConsistency()` must return `100, true, true`, and `assertMetadataConsistency()` must not revert.
