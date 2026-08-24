# CORE runbook

Status 2026-08-18: chapter-aware `BIGGI_MASTER/CORE` je nasazeny na Polygon mainnetu pro pet series. Vsech pet Public deploymentu pouziva opravenou 100-NFT implementaci, je verified a zustava paused. Tento runbook je pro kontrolu wiring, metadata readiness a postupnou aktivaci jednotlivych chapteru.

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

1. pro kapitolu 1 `BiggiTicketHub.setMainCollection(BiggiMain)`, pro dalsi kapitoly `BiggiTicketHub.configureChapter(chapterId, BiggiMain, saleCap, marketingCap, ticketBaseURI)`
2. `BiggiMain.setModules(BiggiCompute, BiggiVRFRouter)`
3. pro dalsi kapitoly nejdriv `BiggiMain.setChapterId(chapterId)`, potom `BiggiMain.setTicketHub(BiggiTicketHub)`
4. pro prvni/default VRF collection `BiggiVRFRouter.setMain(BiggiMain)`, pro dalsi VRF collections `BiggiVRFRouter.setMainApproval(BiggiMain, true)`

Kontrola:

- pro kapitolu 1 `BiggiTicketHub.mainCollection() == BiggiMain`
- pro dalsi kapitoly `BiggiTicketHub.chapterMainCollection(chapterId) == BiggiMain`
- `BiggiMain.ticketHub() == BiggiTicketHub`
- pro default collection `BiggiVRFRouter.main() == BiggiMain`, pro dalsi VRF collections staci `BiggiVRFRouter.approvedMains(BiggiMain) == true`
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
- `BiggiSeriesRegistry.isTicketHubForChapter(BiggiTicketHub, chapterId) == true`

### 5.1 Aktualni 5-series CORE model

Aktualni canonical poradi je:

- series 1 -> chapter 1 -> Original
- series 2 -> chapter 2 -> Universe
- series 3 -> chapter 3 -> Mutant
- series 4 -> chapter 4 -> Apocalipse
- series 5 -> chapter 5 -> Super Hero
- jeden sdileny `BiggiTicketHub` pro vsech pet chapteru; stejnym postupem lze pridat dalsi

Postup pro dalsi chapter bez finalnich obrazku:

1. nasadit `BiggiMain` a `BiggiMain2` pro chapter
2. `BiggiMain.setChapterId(chapterId)`
3. `BiggiTicketHub.configureChapter(chapterId, BiggiMain, 500, 50, ticketBaseURI)`
4. `BiggiMain.setTicketHub(BiggiTicketHub)`
5. `BiggiVRFRouter.setMainApproval(BiggiMain, true)`
6. vytvorit samostatnou series a jeji jediny chapter v registry
7. `BiggiSeriesRegistry.setChapterCollections(chapterId, BiggiMain, BiggiMain2, BiggiTicketHub)`
8. `BiggiChapterController.configureChapter(chapterId, seriesId, BiggiMain, BiggiMain2, BiggiTicketHub, 500, 50, 550)`
9. `BiggiMain2.setChapterController(BiggiChapterController, chapterId)`
10. owner mintne 50 marketing ticketu pres batch nebo jednotlive `mintMarketingTicketForChapter(chapterId, to)`
11. chapter zustane neaktivni az do skutecneho startu prodeje

Kazdy chapter musi mit vlastni `ticketBaseURI` s vlastnim ticket obrazkem. Chapters 1-5 jsou uz nasazene, maji po 50 marketing ticketech a zustavaji neaktivni. Marketing tickety jsou obchodovatelne, ale redeem je blokovany. Finalni obrazky/metadata VRF a Public NFT lze doplnit pozdeji, ale pred `setChapterActive(chapterId, true)` musi projit metadata a wiring gate pro konkretni chapter.

Od 2026-08-24 maji ticket metadata vsech peti chapteru jednotne verejne traits: `Ticket Type`, `Chapter`, `Series` a `Mint Mechanism`. Aktualni Pinata URI jsou v `addresses.core.polygon.json`; transakcni dukaz je v `FOR_SUPPORT/EVIDENCE/ticket-metadata-traits-v2-polygon.json`. Tato migrace menila pouze `BiggiTicketHub.chapterTicketBaseURI(1..5)`. Metadata VRF/Public NFT a on-chain cenova mechanika bloku nebyly zmeneny.

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
11. `batchSetNFTBackgroundAndBlock(...)` pro presne 100 indexu: `mainId=idx`, interni sentinel `background=1`, `blockIdx=((idx-1)/10)+1`
12. zkontrolovat `metadataConsistency() == (100, true, true)` a `assertMetadataConsistency()`

Public nema barevne background klony ani vlastni cenovou krivku. Kazdy z 10 bloku obsahuje 10 unikatnich NFT a cenu vzdy poskytuje sparovana VRF kolekce pres chapter controller.

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

`CollectionRewards` se vztahuje pouze na VRF kolekci kazdeho chapteru. Public kolekce musi zustat z `CollectionRewards` vyloucena.

1. volitelně `setRegistry(BiggiSeriesRegistry)`
2. volitelně `setDistributor(BiggiMultiCollectionDistributor)`
3. volitelně `setRewardsAmounts(...)`

### Token rewards

Deploy `BiggiTokenRewards(BiggiMain, BiggiMain2, BIGGI_TOKEN, owner)` a nastav:

`TokenRewards` se vztahuje na VRF i Public kolekci kazdeho registrovaneho chapteru.

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
