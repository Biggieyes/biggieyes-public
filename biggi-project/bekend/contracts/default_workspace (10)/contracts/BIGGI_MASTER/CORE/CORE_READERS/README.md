# BIGGI Core Readers

Deployment status: deployed on Polygon mainnet as of 2026-06-16. Canonical reader addresses are in `addresses.master.json` and `MAINNET_CONTRACT_RECORDS.md`.

Read-only contracts for core collection, chapter, distributor, and NFT reward state.

## Files
- `BiggiChapterSeriesReader.sol` - Chapter and series read aggregation. Also exposes `paymentRouteSnapshot(collection, treasury)` and `chapterPaymentSnapshot(chapterId, treasury)` so the frontend can validate TicketHub/Main2 BIGGI payment routing, `tokenSinkDepositMode`, treasury allowlists, and `ecosystemTreasuryRouteOk`.
- `BiggiMainReader.sol` - Main collection/ticket/reward read aggregation. Keeps the existing `getFrontendSnapshot()` and adds `getTicketHubFrontendSnapshot(user, treasury)` for ticket limits, user ticket count, POL/BIGGI price, pause state, and treasury route readiness.
- `BiggiMultiCollectionDistributorReaderV2.sol` - Multi-collection distributor read aggregation.
- `BiggiNftRewardsReader.sol` - NFT rewards read aggregation.

## Frontend Readiness

Primary frontend calls:

- `BiggiMainReader.getFrontendSnapshot()` for main mint prices, block counts, background counts, ticket price, and reward counters.
- `BiggiMainReader.getTicketHubFrontendSnapshot(user, treasury)` for TicketHub caps, user ticket count, BIGGI price, and `ecosystemTreasuryRouteOk`.
- `BiggiChapterSeriesReader.globalSnapshot()`, `seriesSnapshot(seriesId)`, and `chapterSnapshot(chapterId)` for series/chapter routing and mint progress.
- `BiggiChapterSeriesReader.chapterPaymentSnapshot(chapterId, treasury)` for TicketHub/Main2 payment route health.
- `BiggiMultiCollectionDistributorReaderV2.fullSnapshot(source, pendingRecipient)` for distributor received/pending totals and recipient wiring.
- `BiggiNftRewardsReader.getStatus()`, `getEvent(eventId)`, and `rewardInfo(rewardId)` for NFT reward UI.

Payment route snapshots are defensive: unsupported or legacy collection addresses return zero/false fields instead of reverting.
