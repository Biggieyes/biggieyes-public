# CORE runbook

Status 2026-06-16: `BIGGI_MASTER/CORE` is deployed on Polygon mainnet. This runbook is now for post-deploy wiring, launch checks, metadata readiness, and public mint activation.

Tento dokument popisuje praktický postup po deployi `CORE` kontraktů.

## 1. Předpoklady

Musíš mít připravené:

- deploy owner adresu
- Polygon mainnet RPC
- Chainlink VRF coordinator adresu
- `keyHash`
- `subId`
- metadata layout pro `BiggiMain`
- metadata layout pro `BiggiMain2`
- URI pro:
  - block metadata
  - rewards metadata
  - character metadata
  - ticket metadata v `BiggiTicketHub`
  - contract URI

## 2. Fáze A: základní VRF větev

Po deployi:

1. deploy `BiggiCompute`
2. deploy `BiggiVRFRouter(vrfCoordinator, owner, keyHash, subId)`
3. deploy `BiggiMain(owner)`
4. deploy `BiggiTicketHub(owner, BiggiMain)`

Wiring:

1. `BiggiTicketHub.setMainCollection(BiggiMain)`
2. `BiggiMain.setModules(BiggiCompute, BiggiVRFRouter)`
3. `BiggiMain.setTicketHub(BiggiTicketHub)`
4. `BiggiVRFRouter.setMain(BiggiMain)`

Kontrola:

- `BiggiTicketHub.mainCollection() == BiggiMain`
- `BiggiMain.ticketHub() == BiggiTicketHub`
- `BiggiVRFRouter.main() == BiggiMain`
- `BiggiVRFRouter.approvedMains(BiggiMain) == true`
- na mainnetu nesmi final strict check bezet s prazdnym nebo nulovym `VRF_ROUTER`

## 3. Fáze B: metadata seed pro BiggiMain

Bez toho VRF redeem nepoběží.

Uděláš:

1. nastavit URI:
   - `BiggiMain.setURI(0, 0, rewardsBaseURI)`
   - `BiggiMain.setURI(1, 0, charactersBaseURI)`
   - block URI category je `3`: `BiggiMain.setURI(3, blockIdx, blockBaseURI)`
   - všech 10 block base URI
2. zavolat `batchSetNFTBackgroundAndBlock(...)` pro všech 550 indexů
3. zkontrolovat:
   - `metadataConfiguredCount()`
   - `isMetadataFullyConfigured()`
   - `isRewardMatrixConsistent()`
   - `assertMetadataConsistency()`

Pokud seed není kompletní, `fulfillRandomFromRouter(...)` může spadnout na `MetadataNotInitialized`.

## 4. Fáze C: ticket nastavení

Nastav v `BiggiTicketHub`:

1. `setDevWallet(...)`
2. `setTicketCaps(saleCap, marketingCap)`
3. `setTicketPrice(...)`
4. `setPriceIncreasePerMint(...)`
5. `setTicketBaseURI(...)`
6. `setContractURI(...)`

Pozor: ticket metadata uz nejsou v `BiggiMain.setURI(2, ...)`. Ticket `tokenURI()` sklada `Biggi_RANDOM_MINT_TICKET.json` z `BiggiTicketHub.ticketBaseURI`.

Volitelné BIGGI flow:

7. `setBiggiToken(...)`
8. `setBiggiRate(...)` - musi byt vetsi nez nula
9. `setTokenSink(...)`
10. `setTokenSinkDepositMode(...)`
11. `setReserveAddress(...)`

Mainnet-prep BIGGI NFT payment flow:

- `setTokenSink(BiggiTreasury, 10000)`
- `setTokenSinkDepositMode(true)`
- `BiggiTreasury.setEcosystemBiggiCaller(BiggiTicketHub, true)`
- `BiggiReserveV4.setNotifyCaller(BiggiTreasury, true)`
- `mintTicket()` distribuuje jen aktualni ticket cenu; native overpay se vraci kupujicimu.

## 5. Fáze D: chapter governance

Deploy:

1. `BiggiSeriesRegistry(owner)`
2. `BiggiChapterController(owner, BiggiSeriesRegistry)`
3. `BiggiMain2(owner)`

Postup:

1. v `BiggiSeriesRegistry.createSeries(name)` vytvořit series
2. v `BiggiSeriesRegistry.createChapter(seriesId)` vytvořit chapter
3. v `BiggiSeriesRegistry.setChapterCollections(chapterId, BiggiMain, BiggiMain2, BiggiTicketHub)`
4. v `BiggiChapterController.configureChapter(...)` nastavit:
   - chapterId
   - seriesId
   - BiggiMain
   - BiggiMain2
   - BiggiTicketHub
   - saleCap
   - marketingCap
   - totalCap
5. v `BiggiMain2.setChapterController(BiggiChapterController, chapterId)`

Kontrola:

- `BiggiChapterController.isChapterStackConsistent(chapterId) == true`
- `BiggiChapterController.isChapterCapConsistent(chapterId) == true`
- `BiggiChapterController.registry() == BiggiSeriesRegistry`
- `BiggiChapterController.getChapterCollections(chapterId)` vraci presne `BiggiMain`, `BiggiMain2`, `BiggiTicketHub`
- `BiggiChapterController.getChapterPriceProvider(chapterId) == BiggiMain`
- `BiggiSeriesRegistry.chapterByCollection(BiggiMain) == chapterId`
- `BiggiSeriesRegistry.chapterByCollection(BiggiMain2) == chapterId`
- `BiggiSeriesRegistry.chapterByCollection(BiggiTicketHub) == chapterId`

## 6. Fáze E: public branch nastavení

V `BiggiMain2` nastav:

1. `setDevWallet(...)`
2. volitelně `setDistributor(...)`
3. volitelně `setBiggiToken(...)`
4. volitelně `setBiggiRate(...)` - musi byt vetsi nez nula
5. optional `setTokenSink(...)`
6. optional `setTokenSinkDepositMode(...)`
7. optional `setReserveAddress(...)`
8. `setContractURI(...)`
9. `setURI(1, 0, charactersBaseURI)` pro public character metadata
10. `setURI(2, blockIdx, blockBaseURI)` pro vsech 10 public block base URI
11. `batchSetNFTBackgroundAndBlock(...)`
12. zkontrolovat `metadataConsistency()` a `assertMetadataConsistency()`

Mainnet-prep BIGGI public payment flow:

- `setTokenSink(BiggiTreasury, 10000)`
- `setTokenSinkDepositMode(true)`
- `BiggiTreasury.setEcosystemBiggiCaller(BiggiMain2, true)`
- `BiggiReserveV4.setNotifyCaller(BiggiTreasury, true)`

Poznámka:

- pokud je `chapterController` nastavený, public mint je řízený přes `isPublicMintUnlocked(chapterId)`

## 7. Fáze F: distributor a rewards

### Distributor

Deploy `BiggiMultiCollectionDistributor(owner)` a nastav:

1. `setCollectionRewards(...)`
2. `setReserve(...)`
3. `setBuybackAgent(...)`
4. `setTreasury(...)`
5. `setCommunityCenter(...)`
6. volitelně `setRegistry(BiggiSeriesRegistry)`
7. `addCollection(BiggiTicketHub)`
8. případně `addCollection(BiggiMain2)`

Poznamka: `setRegistry(...)` je volitelna ucetni atribuce pro series/chapter. Pokud registry call selze, distributor emituje `ChapterAttributionFailed`, ale native split do recipientu pokracuje.

Potom:

1. `BiggiTicketHub.setDistributor(BiggiMultiCollectionDistributor)`
2. případně `BiggiMain2.setDistributor(BiggiMultiCollectionDistributor)`

### Collection rewards

Deploy `BiggiCollectionRewards(BiggiMain, owner)` a nastav:

1. volitelně `setRegistry(BiggiSeriesRegistry)`
2. volitelně `setDistributor(BiggiMultiCollectionDistributor)`
3. volitelně `setRewardsAmounts(...)`

### Token rewards

Deploy `BiggiTokenRewards(BiggiMain, BiggiMain2, BIGGI_TOKEN, owner)` a nastav:

1. `setTreasure(...)`
2. volitelně `setRegistry(BiggiSeriesRegistry)`
3. případně `setCollectionAllowed(...)`

### NFT rewards

Deploy `BiggiNFTRewards(owner)` a nastav:

1. `setMainContract(BiggiMain)`
2. případně `setAllowedMainCollection(BiggiMain2, true)`
3. volitelně `setRegistry(BiggiSeriesRegistry)`
4. `setVrfRouter(BiggiVRFRouter)`
5. na routeru:
   `setRewardConsumerApproval(BiggiNFTRewards, true)`

## 8. Fáze G: readery

Deploy:

1. `BiggiMainReader(BiggiMain, BiggiTicketHub, BiggiCollectionRewards)`
2. `BiggiChapterSeriesReader(BiggiChapterController, BiggiSeriesRegistry)`
3. `BiggiMultiCollectionDistributorReaderV2(BiggiMultiCollectionDistributor)`
4. `BiggiNftRewardsReader(BiggiNFTRewards)`

## 9. Minimální smoke testy

### VRF větev

1. mint ticket
2. redeem ticket
3. ověřit:
   - vznik pending requestu v `BiggiMain`
   - VRF callback dokončí mint
   - `biggiMinted` se zvýší

### Chapter governance

1. ověřit registry vazby
2. ověřit `chapterMintProgress(chapterId)`
3. ověřit unlock public mintu až po dosažení capů

### Distributor

1. poslat native flow z whitelisted source
2. zkontrolovat split
3. zkontrolovat `pending` při failu recipienta

### Rewards

1. ověřit eligibility přes registry
2. ověřit `canClaim*`
3. ověřit payout a claim tracking

## 10. Nejčastější chyby

- `BiggiMain` bez seeded metadata
- `BiggiTicketHub` a `BiggiMain` nejsou vzájemně provázané
- `BiggiVRFRouter.main` neukazuje na správný main
- `BiggiMain2` má chapter controller, ale chapter v registry neukazuje na tento public contract
- distributor nemá nastavené všechny recipienty
- rewards kontrakty běží bez správně nastavené registry nebo bez explicit allowlistu

- `tokenSinkDepositMode` is enabled, but treasury does not allowlist `BiggiTicketHub` or `BiggiMain2`
- treasury sends reserve split, but `BiggiReserveV4.notifyCallers(BiggiTreasury)` is not enabled

## 11. Doporučené pravidlo

Nasazovat po vrstvách:

1. nejdřív funkční VRF chapter
2. potom chapter governance
3. potom public branch
4. potom treasury split a rewards
5. nakonec readery a monitorovací vrstvu

To je nejstabilnější cesta, protože každá další vrstva navazuje na adresy a invarianty předchozí vrstvy.
