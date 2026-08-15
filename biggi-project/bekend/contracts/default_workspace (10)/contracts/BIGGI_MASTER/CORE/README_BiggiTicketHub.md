# BiggiTicketHub

Deployment status: deployed on Polygon mainnet as of 2026-06-16. This document describes the live contract behavior and launch-time operations.

## Purpose
Ticket sale and redemption hub for one VRF chapter collection.

## Constructor
```solidity
constructor(address initialOwner, address mainCollection_)
```

## Main wiring
- bound main collection
- distributor for native mint-share forwarding
- optional BIGGI token, sink, treasury deposit mode, and reserve routing
- configurable sale and marketing caps

## Main runtime role
- mints sale and marketing tickets
- stores per-ticket mint price snapshot
- forwards redeem requests into `BiggiMain.redeemFromTicketHub(...)`
- routes native mint-share to distributor
- routes BIGGI inflow to `tokenSink` and/or `reserveAddress`

## BIGGI payment routing
Mainnet-prep wiring uses `tokenSink = BiggiTreasury`, `tokenSinkBps = 10000`, and `tokenSinkDepositMode = true`.

With deposit mode enabled, `mintTicketWithBiggi()` pulls BIGGI from the buyer, approves the sink, and calls `receiveEcosystemBiggi(uint256)` on the sink. `BiggiTreasury` then splits the received BIGGI `34%` to `BiggiTokenRewards`, `33%` to `BiggiReserveV4`, and `33%` to `BiggiDripDistributor`.

With deposit mode disabled, `tokenSink` receives a plain token transfer and no treasury split is triggered.

## Important invariants
- `saleCap + marketingCap` must equal `550`
- `setMainCollection(...)` requires the target main to accept this hub binding
- `setBiggiRate(...)` rejects zero and BIGGI minting rejects a zero computed token payment
- `mintTicket()` distributes only the current ticket price and refunds native overpay
- for treasury deposit mode, `BiggiTreasury.ecosystemBiggiCallers(TicketHub)` must be `true`
