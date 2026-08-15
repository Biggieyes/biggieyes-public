# CORE-first relationship audit

Status: mainnet prep, no production addresses filled yet. This note is for the deployment mode where CORE mechanics are deployed first and tokenomics is deployed later.

## Scope

Checked relationship:

- `BiggiTicketHub -> BiggiMain -> BiggiVRFRouter`
- `BiggiSeriesRegistry -> BiggiChapterController -> BiggiMain2`
- `BiggiTicketHub + BiggiMain + BiggiMain2` chapter lock/unlock flow
- `BiggiMultiCollectionDistributor` native mint-share routing
- `BiggiCollectionRewards`, `BiggiTokenRewards`, `BiggiNFTRewards`
- CORE readers for frontend visibility

## Main invariant map

### TicketHub and Main

Required wiring:

1. deploy `BiggiMain`
2. deploy `BiggiTicketHub(owner, BiggiMain)`
3. call `BiggiTicketHub.setMainCollection(BiggiMain)`
4. call `BiggiMain.setModules(BiggiCompute, BiggiVRFRouter)`
5. call `BiggiMain.setTicketHub(BiggiTicketHub)`
6. call `BiggiVRFRouter.setMain(BiggiMain)`

Contract guards:

- `BiggiTicketHub.setMainCollection` rejects a main collection that is already bound to a different hub.
- `BiggiMain.setTicketHub` rejects a hub that points to another main collection.
- `BiggiTicketHub.redeemTicket` can only forward to the configured `mainCollection`.
- `BiggiMain.redeemFromTicketHub` can only be called by the configured `ticketHub`.
- `BiggiMain.fulfillRandomFromRouter` can only be called by the configured `vrfRouter`.

Operational rule:

- Native `mintTicket()` requires `TicketHub.distributor != address(0)`.
- Redeem requires `BiggiMain.vrfRouter != address(0)` and seeded Main metadata.
- Marketing tickets can be minted without distributor funding, but redeem still requires VRF + metadata.

### Series, chapter, Main2

Required wiring:

1. deploy `BiggiSeriesRegistry`
2. deploy `BiggiChapterController(owner, BiggiSeriesRegistry)`
3. deploy `BiggiMain2`
4. `SeriesRegistry.createSeries(name)`
5. `SeriesRegistry.createChapter(seriesId)`
6. `SeriesRegistry.setChapterCollections(chapterId, BiggiMain, BiggiMain2, BiggiTicketHub)`
7. `ChapterController.configureChapter(chapterId, seriesId, BiggiMain, BiggiMain2, BiggiTicketHub, saleCap, marketingCap, totalCap)`
8. `BiggiMain2.setChapterController(ChapterController, chapterId)`

Contract guards:

- `SeriesRegistry` prevents reusing the same collection or hub address across different chapters.
- `ChapterController.configureChapter` requires registry mappings to match the supplied `Main`, `Main2`, and `TicketHub`.
- `ChapterController.configureChapter` requires `saleCap + marketingCap == totalCap`.
- `ChapterController.configureChapter` requires direct `BiggiMain <-> BiggiTicketHub` binding.
- `BiggiMain2.setChapterController` requires the selected chapter public collection to be exactly this `BiggiMain2`.
- `BiggiMain2.mintPublic` is locked until `ChapterController.isPublicMintUnlocked(chapterId)` is true.
- Public unlock requires exact cap progress: sale minted, marketing minted, and total minted must all match configured caps.

Operational rule:

- Public mint should not be treated as open until `isPublicMintUnlocked(chapterId) == true`.
- `BiggiMain2` uses the chapter VRF collection as price provider when the chapter controller is active; if stack wiring drifts, price resolution reverts instead of silently falling back.

### Distributor and delayed tokenomics

Important blocker for CORE-first paid sales:

- `BiggiMultiCollectionDistributor.receiveMintShare()` requires all five recipients to be non-zero:
  - `collectionRewards`
  - `reserve`
  - `buybackAgent`
  - `treasury`
  - `communityCenter`
- `TicketHub.mintTicket()` forwards 60% of native payment to distributor and 40% to dev wallet.
- `Main2.mintPublic()` forwards 60% of native payment to distributor and 40% to dev wallet.
- `TicketHub.mintTicket()` distributes only the current ticket price and refunds native overpay.
- Optional distributor registry attribution cannot block native split; a bad registry emits `ChapterAttributionFailed` and recipient routing continues.

Therefore:

- CORE contracts can be deployed before tokenomics.
- Paid native mint should not be opened unless distributor recipient routing is already finalized.
- If tokenomics is intentionally postponed, keep sale closed or do not wire/activate paid mint flows until tokenomics recipient contracts exist.

Safe CORE-first modes:

1. `Preparation mode`: deploy and wire CORE, seed metadata, configure chapter, but do not open paid sale.
2. `Visibility/marketing mode`: allow only owner marketing tickets; do not rely on paid native distribution.
3. `Full paid CORE mode`: deploy enough tokenomics recipient contracts first, even if liquidity funding happens later, then wire distributor and open paid mint.

### Rewards

- `BiggiCollectionRewards` is CORE-native and can be deployed early. If funded through distributor, it needs `setDistributor(BiggiMultiCollectionDistributor)`.
- `BiggiTokenRewards` depends on a real BIGGI token address, so it belongs to the tokenomics phase unless the token is already deployed.
- `BiggiNFTRewards` can be deployed in CORE, but mystery events need `BiggiVRFRouter.setRewardConsumerApproval(BiggiNFTRewards, true)`.

### Readers

- `BiggiMainReader` tolerates missing optional `collectionRewards` and tokenomics treasury route.
- `BiggiChapterSeriesReader` exposes chapter consistency, payment route state, treasury allowlist state, and public unlock data.
- `BiggiMultiCollectionDistributorReaderV2` is useful only after distributor deploy.
- `BiggiNftRewardsReader` is useful only after NFT rewards deploy.

## Recommended deployment stance

For your stated plan, the best mainnet order is:

1. Deploy/wire CORE mechanics.
2. Seed and verify metadata.
3. Create series/chapter and configure `Main`, `TicketHub`, `Main2`.
4. Deploy read layer.
5. Keep paid mint closed until tokenomics recipient contracts are deployed.
6. Deploy tokenomics when liquidity funds are ready.
7. Wire distributor, BIGGI payment sink, treasury allowlists, reserve notify callers.
8. Run final smoke tests.
9. Open paid sale.

## Must-pass checks before opening sale

- `BiggiTicketHub.mainCollection() == BiggiMain`
- `BiggiMain.ticketHub() == BiggiTicketHub`
- `BiggiMain.compute() == BiggiCompute`
- `BiggiMain.vrfRouter() == BiggiVRFRouter`
- `BiggiVRFRouter.approvedMains(BiggiMain) == true`
- `BiggiMain.assertMetadataConsistency() == true`
- `BiggiSeriesRegistry.chapterByCollection(BiggiMain) == chapterId`
- `BiggiSeriesRegistry.chapterByCollection(BiggiMain2) == chapterId`
- `BiggiSeriesRegistry.chapterByCollection(BiggiTicketHub) == chapterId`
- `BiggiChapterController.isChapterStackConsistent(chapterId) == true`
- `BiggiChapterController.isChapterCapConsistent(chapterId) == true`
- If paid native sale is open: distributor has all five recipients and `TicketHub` is whitelisted.
- If public mint is open: `BiggiMain2` is whitelisted in distributor and `isPublicMintUnlocked(chapterId) == true`.
- If BIGGI NFT payments are open: treasury allowlists `TicketHub` and `Main2`, and reserve accepts treasury notify calls.
- If BIGGI NFT payments are open: `biggiPerEth > 0`, because zero rates and zero computed token payments are blocked.

## Post-deploy checker

Use the focused CORE relationship checker after every CORE deploy or rewiring step:

```bash
node scripts/master/runCheckCoreRelationships.js --addresses ./addresses.visibility.polygon.json
```

Polygon mainnet:

```bash
node scripts/master/runCheckCoreRelationships.js --network polygon --addresses ./addresses.visibility.polygon.json --require-code
```

Before opening paid native sale, use strict paid-native mode:

```bash
node scripts/master/runCheckCoreRelationships.js --network polygon --addresses ./addresses.visibility.polygon.json --require-code --strict --expect-paid-native
```

The checker writes a JSON report to:

```text
reports/core-relationships-<network>.json
```

Expected behavior for CORE-first prep:

- warnings about missing distributor/tokenomics are acceptable only while paid mint is closed
- warnings about incomplete metadata are acceptable only before redeem is enabled
- any `issue` in strict paid-native mode means do not open sale
