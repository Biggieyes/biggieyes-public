# CORE deploy pořadí

Status 2026-06-16: CORE is deployed on Polygon mainnet. This document remains useful as deploy-order/runbook history; use `MAINNET_CONTRACT_RECORDS.md` for live addresses.

Tento dokument popisuje doporučené pořadí deploye `BIGGI_MASTER/CORE`.

## 1. Minimalní VRF visibility launch

Použij, pokud chceš spustit jen hlavní VRF chapter flow bez public větve a bez plného core reward stacku.

Pořadí:

1. `BiggiCompute`
2. `BiggiVRFRouter`
3. `BiggiMain`
4. `BiggiTicketHub`

Potom wiring:

1. `BiggiTicketHub.setMainCollection(BiggiMain)`
2. `BiggiMain.setModules(BiggiCompute, BiggiVRFRouter)`
3. `BiggiMain.setTicketHub(BiggiTicketHub)`
4. `BiggiVRFRouter.setMain(BiggiMain)`

## 2. Chapter governance stack

Použij, pokud chceš přidat chapter-aware registry a public branch.

Pořadí:

1. `BiggiSeriesRegistry`
2. `BiggiChapterController`
3. `BiggiMain2`

Potom wiring:

1. v `BiggiSeriesRegistry` vytvořit series a chapter
2. v `BiggiSeriesRegistry.setChapterCollections(...)` zapsat:
   - `BiggiMain`
   - `BiggiMain2`
   - `BiggiTicketHub`
3. v `BiggiChapterController.configureChapter(...)` zapsat chapter capy
4. v `BiggiMain2.setChapterController(BiggiChapterController, chapterId)`

Volitelně:

5. `BiggiMain2.setPriceProvider(...)` jen pokud nechceš číst cenu přes chapter controller

## 3. Treasury split stack

Použij, pokud už chceš zapojit treasury routing.

Pořadí:

1. `BiggiMultiCollectionDistributor`

Potom wiring:

1. `setCollectionRewards(...)`
2. `setReserve(...)`
3. `setBuybackAgent(...)`
4. `setTreasury(...)`
5. `setCommunityCenter(...)`
6. volitelně `setRegistry(BiggiSeriesRegistry)`
7. `addCollection(BiggiTicketHub)`
8. případně `addCollection(BiggiMain2)`, pokud má i public branch posílat native mint-share

Potom propojit source kontrakty:

1. `BiggiTicketHub.setDistributor(BiggiMultiCollectionDistributor)`
2. `BiggiMain2.setDistributor(BiggiMultiCollectionDistributor)`

BIGGI NFT payment routing, pokud je uz nasazena tokenomika:

1. `BiggiTicketHub.setTokenSink(BiggiTreasury, 10000)`
2. `BiggiTicketHub.setTokenSinkDepositMode(true)`
3. `BiggiMain2.setTokenSink(BiggiTreasury, 10000)`
4. `BiggiMain2.setTokenSinkDepositMode(true)`
5. `BiggiTreasury.setEcosystemBiggiCaller(BiggiTicketHub, true)`
6. `BiggiTreasury.setEcosystemBiggiCaller(BiggiMain2, true)`
7. `BiggiReserveV4.setNotifyCaller(BiggiTreasury, true)`

### 3.1 Pridani dalsiho chapteru po mainnet deployi

Sdilene tokenomics kontrakty se kvuli dalsimu chapteru nenasazuji znovu. V aktualnim CORE modelu se pro dalsi chapter nasadi novy collection pair (`BiggiMain`, `BiggiMain2`) a pouzije se existujici centralni `BiggiTicketHub`:

1. `BiggiMain.setChapterId(chapterId)`
2. `BiggiTicketHub.configureChapter(chapterId, newMain, saleCap, marketingCap, ticketBaseURI)`
3. `BiggiMain.setTicketHub(BiggiTicketHub)`
4. `BiggiMain.setModules(BiggiCompute, BiggiVRFRouter)`
5. `BiggiVRFRouter.setMainApproval(newMain, true)`
6. `BiggiMain2.setDistributor(BiggiMultiCollectionDistributor)`
7. `BiggiMain2.setPriceProvider(newMain)`
8. `BiggiSeriesRegistry.createSeries(seriesName)`
9. `BiggiSeriesRegistry.createChapter(seriesId)`
10. `BiggiSeriesRegistry.setChapterCollections(chapterId, newMain, newMain2, BiggiTicketHub)`
11. `BiggiChapterController.configureChapter(chapterId, seriesId, newMain, newMain2, BiggiTicketHub, saleCap, marketingCap, totalCap)`
12. `BiggiMain2.setChapterController(BiggiChapterController, chapterId)`
13. `BiggiMultiCollectionDistributor.addCollection(BiggiTicketHub)` jen pokud jeste neni allowlisted
14. `BiggiMultiCollectionDistributor.addCollection(newMain2)`
15. volitelne `BiggiMultiCollectionDistributor.addCollection(newMain)`, pokud bude VRF collection posilat native primo do distributoru
16. `BiggiTreasury.setEcosystemBiggiCaller(BiggiTicketHub, true)` jen jednou pro sdileny hub a `BiggiTreasury.setEcosystemBiggiCaller(newMain2, true)`, pokud jsou zapnute BIGGI platby za NFT
17. `BiggiReserveV4.setNotifyCaller(BiggiTicketHub, true)` jen jednou pro sdileny hub a `BiggiReserveV4.setNotifyCaller(newMain2, true)`, pokud je zapnuty strict notify mode
18. `BiggiDripDistributor.setCollection(newMain, true)` a `setCollection(newMain2, true)`, pokud tyto kolekce maji ovlivnovat per-mint drip accounting
19. nastavit unikatni `ticketBaseURI` a ticket obrazek pro tento chapter
20. pred prodejem mintnout 50 marketing ticketu pres `BiggiTicketHub.mintMarketingTicketForChapter(chapterId, to)`
21. pri startu prodeje zavolat `BiggiTicketHub.setChapterActive(chapterId, true)`; tim se otevre placeny mint i redeem vsech 550 ticketu

Operacni helper:

```bash
npm run configure:chapter-tokenomics:polygon -- --execute
```

Skript `scripts/master/configureChapterTokenomics.js` je defaultne dry-run. Pred `--execute` musi byt v env nastaveny minimalne `REGISTRY`, `CHAPTER_CONTROLLER`, `SERIES_ID`, `CHAPTER_ID`, `MAIN`, `MAIN2`, `TICKET_HUB`, `DISTRIBUTOR`, `SALE_CAP`, `MARKETING_CAP`.

## 4. Reward stack

### 4.1 Collection rewards

Pořadí:

1. `BiggiCollectionRewards`

Constructor:

```solidity
constructor(address main_, address owner_)
```

Potom wiring:

1. `setMain(BiggiMain)` pokud constructor neukazuje na cílový main
2. volitelně `setRegistry(BiggiSeriesRegistry)`
3. `setDistributor(BiggiMultiCollectionDistributor)` pokud se má funding brát přes distributor
4. volitelně `setRewardsAmounts(...)`

### 4.2 Token rewards

Pořadí:

1. `BiggiTokenRewards`

Constructor:

```solidity
constructor(address mainNFT_, address main2NFT_, address biggiToken_, address owner_)
```

Potom wiring:

1. `setTreasure(...)`
2. volitelně `setRegistry(BiggiSeriesRegistry)`
3. fallback nebo rozšíření:
   `setCollectionAllowed(...)`
4. volitelně `setUnitReward(...)`
5. volitelně `setBlockWeights(...)`
6. ve finální tokenomice volitelně `setEmissionController(BiggiTokenRewardsEmissionController, true)`

Poznámka: `BiggiTokenRewards` je core kontrakt, ale dynamický emisní controller patří do tokenomické fáze. Bez controlleru zůstává původní model `rarityUnits * unitReward`; po zapnutí controlleru zůstává rarity výpočet v core a controller pouze omezuje týdenní tokenový budget.

### 4.3 NFT rewards

Pořadí:

1. `BiggiNFTRewards`

Potom wiring:

1. `setMainContract(BiggiMain)`
2. `setAllowedMainCollection(BiggiMain2, true)` pokud public větev smí vytvářet character rewards nebo jiné reward eventy
3. volitelně `setRegistry(BiggiSeriesRegistry)`
4. `setVrfRouter(BiggiVRFRouter)`
5. na `BiggiVRFRouter`:
   `setRewardConsumerApproval(BiggiNFTRewards, true)`

## 5. Read vrstva

### 5.1 BiggiMainReader

Pořadí:

1. `BiggiMainReader(BiggiMain, BiggiTicketHub, BiggiCollectionRewards)`

### 5.2 BiggiChapterSeriesReader

Pořadí:

1. `BiggiChapterSeriesReader(BiggiChapterController, BiggiSeriesRegistry)`

### 5.3 BiggiMultiCollectionDistributorReaderV2

Pořadí:

1. `BiggiMultiCollectionDistributorReaderV2(BiggiMultiCollectionDistributor)`

### 5.4 BiggiNftRewardsReader

Pořadí:

1. `BiggiNftRewardsReader(BiggiNFTRewards)`

## 6. Doporučené pořadí pro plný CORE launch

1. `BiggiCompute`
2. `BiggiVRFRouter`
3. `BiggiMain`
4. `BiggiTicketHub`
5. `BiggiSeriesRegistry`
6. `BiggiChapterController`
7. `BiggiMain2`
8. `BiggiMultiCollectionDistributor`
9. `BiggiCollectionRewards`
10. `BiggiTokenRewards`
11. `BiggiNFTRewards`
12. `BiggiMainReader`
13. `BiggiChapterSeriesReader`
14. `BiggiMultiCollectionDistributorReaderV2`
15. `BiggiNftRewardsReader`

## 7. Důvod toho pořadí

- `BiggiMain` potřebuje až post-deploy napojit `Compute`, `VRFRouter` a `TicketHub`
- `BiggiTicketHub` potřebuje znát `BiggiMain`
- `BiggiChapterController` potřebuje `BiggiSeriesRegistry`
- `BiggiMain2` potřebuje chapter controller až po vytvoření chapter v registry
- reward a distributor vrstva má být až po deployi core minting větve, protože se váže na jejich adresy
- readery mají smysl až po zafixování write adres
