# BiggiTicketHub

## Purpose
Ticket layer for one chapter. Holds ticket sale, marketing tickets, ticket ownership, payment routing and redeem entry into the VRF collection.

## Preserved from original logic
- native mint
- BIGGI mint
- 60/40 distributor/dev split
- reserve forwarding for BIGGI payments
- dynamic ticket price growth
- per-wallet ticket limit

## Logic change level
MINOR LOGIC CHANGE

### Changed
- Added explicit `saleCap` and `marketingCap` so chapter exhaustion can be checked for public unlock.
- Ticket price snapshot is stored per ticket and passed to VRF main on redeem.

## Deployment notes
1. Deploy `BiggiEyesMain`
2. Deploy `BiggiTicketHub(initialOwner, mainAddress)`
3. Set `ticketHub` in main
4. Configure distributor, BIGGI, reserve, sink, caps, URIs
