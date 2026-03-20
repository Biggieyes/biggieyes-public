# BiggiMultiCollectionDistributor

Role: chapter-aware distributor for TicketHub/Public/VRF sources.

Preserved:
- original split BPS
- whitelist-based callers
- pending retry flow

Updated:
- optional `registry` integration
- accounting now tracks `receivedBySeries` and `receivedByChapter`
- attribution works for TicketHub too because registry maps `ticketHub -> chapterId`

Logic change: **MINOR LOGIC CHANGE**
- routing percentages were not changed
- only attribution/accounting layer was extended
