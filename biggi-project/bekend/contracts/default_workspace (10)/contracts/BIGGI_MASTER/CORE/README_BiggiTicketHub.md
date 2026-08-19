# BiggiTicketHub

Deployment status (verified 2026-08-17): the current chapter-aware contract is deployed on Polygon mainnet at `0x7b7e561173f498C8274b821090Da64E8ee653f6A`. The previous address is historical and must not be used by runtime configuration.

## Purpose
Central ticket sale and redemption hub for VRF chapter collections.

## Constructor
```solidity
constructor(address initialOwner, address mainCollection_)
```

## Main wiring
- default chapter 1 `mainCollection`
- per-chapter `chapterMainCollection(chapterId)` for additional VRF collections
- distributor for native mint-share forwarding
- optional BIGGI token, sink, treasury deposit mode, and reserve routing
- configurable sale and marketing caps per chapter

## Main runtime role
- mints sale and marketing tickets
- supports chapter-specific minting with `mintTicketForChapter(...)` and `mintTicketWithBiggiForChapter(...)`
- mints the 50 marketing tickets through `mintMarketingTicketForChapter(chapterId, to)` as a functional part of the chapter's 550 tickets
- keeps paid mint and redemption closed until the owner calls `setChapterActive(chapterId, true)`
- stores per-ticket mint price snapshot
- stores per-ticket chapter id and forwards redeem requests into that chapter's `BiggiMain.redeemFromTicketHub(...)`
- routes native mint-share to a chapter-aware distributor when available
- routes BIGGI inflow to `tokenSink` and/or `reserveAddress`

## Central multi-series marketing ticket mode
The current Polygon topology uses one central `BiggiTicketHub` for five deployed chapters and can add more:

- chapter 1: Original
- chapter 2: Universe
- chapter 3: Mutant
- chapter 4: Apocalipse
- chapter 5: Super Hero
- each chapter keeps its own `saleCap`, `marketingCap`, `ticketBaseURI`, and ticket id range
- every chapter must use a different `ticketBaseURI`
- prelaunch marketing tickets are minted with `mintMarketingTicketForChapter(chapterId, to)`

All five chapters currently have `saleCap=500`, `marketingCap=50`, 50 minted marketing tickets, and `active=false`. Final NFT artwork/metadata for future chapters remains intentionally unset until each chapter is prepared for activation.

Before chapter activation, marketing tickets are tradeable ERC-721 tokens but cannot yet be redeemed. At the collection sale start, `setChapterActive(chapterId, true)` opens paid mint and makes those 50 tickets redeemable like the other 500. Final VRF/Public NFT artwork can be uploaded later, but each chapter's distinct ticket metadata and ticket image must exist before its marketing tickets are minted.

## BIGGI payment routing
Mainnet-prep wiring uses `tokenSink = BiggiTreasury`, `tokenSinkBps = 10000`, and `tokenSinkDepositMode = true`.

With deposit mode enabled, `mintTicketWithBiggi()` pulls BIGGI from the buyer, approves the sink, and calls `receiveEcosystemBiggi(uint256)` on the sink. `BiggiTreasury` then splits the received BIGGI `34%` to `BiggiTokenRewards`, `33%` to `BiggiReserveV4`, and `33%` to `BiggiDripDistributor`.

With deposit mode disabled, `tokenSink` receives a plain token transfer and no treasury split is triggered.

## Important invariants
- `saleCap + marketingCap` must equal `550`
- every chapter's `saleCap + marketingCap` must equal `550`
- paid mint and redemption require explicit chapter activation
- marketing tickets are never permanently excluded from redemption
- `setMainCollection(...)` / `setChapterMainCollection(...)` require the target main to accept this hub binding
- `ticketCount` tracks current ERC-721 ownership and is updated on transfers and burns
- `chapterTicketCount` preserves the `MAX_PER_WALLET` limit independently for each chapter
- `setBiggiRate(...)` rejects zero and BIGGI minting rejects a zero computed token payment
- `mintTicket()` distributes only the current ticket price and refunds native overpay
- for treasury deposit mode, `BiggiTreasury.ecosystemBiggiCallers(TicketHub)` must be `true`
