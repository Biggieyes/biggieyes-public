# CORE architektura

Status 2026-08-17: aktualni chapter-aware CORE je nasazeny na Polygon mainnetu. Canonical runtime source je `addresses.master.json`; `addresses.json` a oba frontendove mapy jsou jeho kontrolovany mirror.

Tento dokument popisuje, jak funguje `BIGGI_MASTER/CORE`, jak jsou kontrakty propojené a jak se systém škáluje po chapter/series.

## 1. Přehled vrstev

`CORE` je rozdělený do těchto logických vrstev:

- `BiggiSeriesRegistry`
  centrální source of truth pro series, chapters a vazby na collection adresy
- `BiggiChapterController`
  chapter governance vrstva nad registry, která potvrzuje capy a unlock public mintu
- `BiggiTicketHub`
  ticket sale a redeem vrstva pro VRF collection
- `BiggiMain`
  VRF-backed chapter NFT collection
- `BiggiMain2`
  public chapter NFT collection
- `BiggiVRFRouter`
  jednotný randomness bridge přes Chainlink VRF
- `BiggiCompute`
  čistá helper logika pro bonusy a růst cen
- `BiggiMultiCollectionDistributor`
  split vrstva pro native mint-share flow
- `BiggiCollectionRewards`
  native reward vrstva nad eligible collections
- `BiggiTokenRewards`
  BIGGI token reward vrstva nad eligible collections
- `BiggiNFTRewards`
  NFT reward vrstva pro manual, character a mystery rewards
- `CORE_READERS/*`
  read-only agregační kontrakty pro frontend, backoffice a monitoring

## 2. Hlavní minting flow

### 2.1 VRF chapter flow

1. User mintne ticket v `BiggiTicketHub`.
2. `BiggiTicketHub` vybere native payment a rozdělí ho:
   - `60%` do `BiggiMultiCollectionDistributor`
   - zbytek do `devWallet`
3. Ticket owner provede redeem.
4. `BiggiTicketHub` zavolá `BiggiMain.redeemFromTicketHub(user, ticketId, ticketPriceSnapshot)`.
5. `BiggiMain` požádá `BiggiVRFRouter` o randomness.
6. `BiggiVRFRouter` po callbacku zavolá `BiggiMain.fulfillRandomFromRouter(requestId, randomWord)`.
7. `BiggiMain` vybere volný metadata index, mintne NFT, aktualizuje block/background statistiky a případně mintne character reward NFT.

### 2.2 Public chapter flow

1. `BiggiChapterController` drží chapter config a sleduje, jestli VRF větev chapter dosáhla capů.
2. `BiggiMain2` zůstává zamknutý, dokud `chapterController.isPublicMintUnlocked(chapterId)` nevrátí `true`.
3. Po unlocku může user mintovat přímo přes `mintPublic(idx)` nebo `mintPublicWithBiggi(idx)`.
4. Cena public mintu je ideálně převzatá z VRF chapter price provideru přes controller.

## 3. Propojení kontraktů

### 3.1 Povinné vazby pro VRF větev

- `BiggiTicketHub.mainCollection -> BiggiMain` pro kapitolu 1
- `BiggiTicketHub.chapterMainCollection(chapterId) -> BiggiMain` pro dalsi kapitoly
- `BiggiMain.ticketHub -> BiggiTicketHub`
- `BiggiMain.compute -> BiggiCompute`
- `BiggiMain.vrfRouter -> BiggiVRFRouter`
- `BiggiVRFRouter.main -> BiggiMain` pro default collection nebo `BiggiVRFRouter.approvedMains(BiggiMain) == true` pro dalsi VRF collections

### 3.2 Povinné vazby pro chapter governance

- `BiggiChapterController.registry -> BiggiSeriesRegistry`
- `BiggiSeriesRegistry` drží:
  - `vrfCollection`
  - `publicCollection`
  - `ticketHub`
  pro každý chapter
- `BiggiMain2.chapterController -> BiggiChapterController`

### 3.3 Povinné vazby pro treasury split

`BiggiMultiCollectionDistributor` potřebuje všechny recipienty:

- `collectionRewards`
- `reserve`
- `buybackAgent`
- `treasury`
- `communityCenter`

Whitelisted source collections pak posílají native mint-share do distributoru přes `receiveMintShare()`.

Centralni `BiggiTicketHub` pouziva `receiveMintShareForChapter(chapterId)`, pokud ho distributor podporuje, aby zustalo presne chapter accounting.

### 3.4 Reward vazby

- `BiggiCollectionRewards`
  - defaultně pracuje nad `defaultMain`
  - volitelně používá `registry`
- `BiggiTokenRewards`
  - zná `mainNFT`, `main2NFT`, `biggi`
  - volitelně používá `registry`
  - fallback allowlist: `allowedCollections`
- `BiggiNFTRewards`
  - může být vázaný na `mainContract`
  - může mít `allowedMainCollections`
  - volitelně používá `registry`
  - pro mystery randomness používá `BiggiVRFRouter`

Aktuální dosažitelnost jednotlivých větví a mainnet omezení jsou ověřena v
[`NFT_REWARDS_CONSISTENCY_AUDIT_2026-08-28_CS.md`](NFT_REWARDS_CONSISTENCY_AUDIT_2026-08-28_CS.md).

### 3.5 Final-gate kontrolni invarianty

Aktualni `scripts/master/checkMasterStatus.js` v strict modu kontroluje tyto prime vazby:

- `BiggiMain.ticketHub == BiggiTicketHub`
- pro kapitolu 1 `BiggiTicketHub.mainCollection == BiggiMain`
- pro dalsi kapitoly `BiggiTicketHub.chapterMainCollection(CHAPTER_ID) == BiggiMain`
- `BiggiMain.compute == BiggiCompute`
- `BiggiMain.vrfRouter == BiggiVRFRouter`, pokud je router v manifestu nastaven
- na non-local siti musi byt `VRF_ROUTER` v strict checku nastaven
- `BiggiVRFRouter.main == BiggiMain` nebo `BiggiVRFRouter.approvedMains(BiggiMain) == true`
- `BiggiVRFRouter.approvedRewardConsumers(BiggiNFTRewards) == true`, pokud je NFT rewards v manifestu
- `BiggiMain2.chapterController == BiggiChapterController`
- `BiggiMain2.chapterId == CHAPTER_ID`
- `BiggiMain2.priceProvider == BiggiMain`
- `BiggiMain2.distributor == BiggiMultiCollectionDistributor`
- `BiggiMain2.BIGGI == BIGGI_TOKEN`
- `BiggiMain2.reserveAddress == BiggiReserveV4`
- `BiggiChapterController.registry == BiggiSeriesRegistry`
- `BiggiChapterController.getChapterCollections(CHAPTER_ID)` vraci `BiggiMain`, `BiggiMain2`, `BiggiTicketHub`
- `BiggiChapterController.getChapterPriceProvider(CHAPTER_ID) == BiggiMain`
- `BiggiChapterController.isChapterStackConsistent(CHAPTER_ID) == true`
- `BiggiChapterController.isChapterCapConsistent(CHAPTER_ID) == true`
- `BiggiSeriesRegistry.chapterByCollection(BiggiMain/Main2) == CHAPTER_ID`
- `BiggiSeriesRegistry.isTicketHubForChapter(BiggiTicketHub, CHAPTER_ID) == true`
- registry eligibility: token rewards pro `BiggiMain` a `BiggiMain2`, collection rewards jen pro `BiggiMain`
- `BiggiMultiCollectionDistributor` ma vsechny recipienty nastavene a whitelistuje `BiggiMain`, `BiggiMain2`, `BiggiTicketHub`
- `BiggiCollectionRewards.defaultMain == BiggiMain`, `distributor == BiggiMultiCollectionDistributor`, `registry == BiggiSeriesRegistry`
- `BiggiTokenRewards.registry == BiggiSeriesRegistry`, `treasure == BiggiTreasury`, allowed collections sleduji registry
- finalni tokenomika muze zapnout `BiggiTokenRewards.emissionController == BiggiTokenRewardsEmissionController`
- `BiggiNFTRewards.mainContract == BiggiMain`, `registry == BiggiSeriesRegistry`, `allowedMainCollections(BiggiMain/Main2) == true`

## 4. Co je source of truth

### Adresní a chapter source of truth

Primární source of truth pro chapter topologii je:

- `BiggiSeriesRegistry`

Primární source of truth pro unlock public mintu je:

- `BiggiChapterController`

### Frontend/read source of truth

Frontend by neměl skládat vše přímo z write kontraktů. K tomu slouží:

- `BiggiMainReader`
- `BiggiChapterSeriesReader`
- `BiggiMultiCollectionDistributorReaderV2`
- `BiggiNftRewardsReader`

Frontend payment health data:

- `BiggiMainReader.getTicketHubFrontendSnapshot(user, treasury)` vraci TicketHub caps, user ticket count, POL/BIGGI cenu a `ecosystemTreasuryRouteOk`.
- `BiggiChapterSeriesReader.chapterPaymentSnapshot(chapterId, treasury)` vraci TicketHub/Main2 route stav pro BIGGI NFT platby vcetne `tokenSinkDepositMode` a treasury allowlistu.
- `BiggiReserveTreasuryReader.ecosystemBiggiRouteSnapshot(...)` v tokenomice potvrzuje, ze treasury split recipients a reserve notify caller jsou pripravene.

## 5. Škálovatelnost

### Jak systém škáluje dobře

#### Horizontálně po chapters

Každý chapter může mít:

- jednu VRF collection (`BiggiMain` instance)
- jednu public collection (`BiggiMain2` instance)
- jeden `BiggiTicketHub` zaznam v registry; aktualni CORE model muze pouzit sdileny centralni hub pro vice chapters

To znamená, že projekt roste po chapter bez potřeby přepisovat core reward a treasury vrstvu.

#### Sdílené systémové vrstvy

Tyto kontrakty mohou obsluhovat více chapters:

- `BiggiSeriesRegistry`
- `BiggiChapterController`
- `BiggiMultiCollectionDistributor`
- `BiggiCollectionRewards`
- `BiggiTokenRewards`
- `BiggiNFTRewards`
- readery

To snižuje počet systémových deployů při růstu kolekce.

#### Registry-driven integrace

Rewards a distributor nemusí být natvrdo svázané jen s jednou collection adresou. Přes registry lze přidávat další eligible collections bez změny samotné reward architektury.

### Aktualni 5-series CORE model

Aktualni Polygon deployment obsahuje:

- 5 samostatnych series: Original, Universe, Mutant, Apocalipse a Super Hero
- kazda series ma presne 1 chapter
- kazdy chapter ma vlastni `BiggiMain` VRF collection
- kazdy chapter ma vlastni `BiggiMain2` public collection
- vsechny chapters sdili jeden centralni chapter-aware `BiggiTicketHub`
- `BiggiSeriesRegistry.chapterByCollection(...)` mapuje jen VRF/Public collection adresy
- sdileny hub se overuje pres `BiggiSeriesRegistry.isTicketHubForChapter(ticketHub, chapterId)`
- registry/controller model dovoluje pridat dalsi series bez noveho centralniho TicketHubu

Marketing tickety pro budouci chapters se razi pres:

```solidity
BiggiTicketHub.mintMarketingTicketForChapter(chapterId, to)
```

Kazdy chapter ma vlastni `ticketBaseURI` a vlastni ticket obrazek. Prvnich 50 marketing ticketu je plnohodnotnou soucasti celkoveho supply 550. Vsech pet chapteru ma techto 50 ticketu vyrazenych a zustava `active=false`; tickety jsou obchodovatelne, ale placeny mint i redeem jsou zavrene. Pri startu konkretniho chapteru owner zavola `setChapterActive(chapterId, true)`. Finalni obrazky/metadata VRF a Public NFT se doplni pred aktivaci daneho chapteru.

### Kde jsou limity

#### Více deployů při růstu

Chapter škálování je horizontální, ne vertikální.

To je architektonicky správně, ale znamená:

- více kontraktů na chapter
- více wiring kroků
- vyšší nároky na deploy disciplínu

#### Distributor jako chokepoint

`BiggiMultiCollectionDistributor` je sdílená treasury split vrstva.

To je výhodné pro accounting a governance, ale zároveň je to kritický systémový bod pro všechny native inflows.

#### Manual wiring

Systém je modulární, ale není plně self-discovering.

Po deployi je potřeba udělat několik explicitních setter kroků, jinak kontrakty nejsou funkční.

## 6. Praktický provozní pohled

Minimální VRF chapter stack:

- `BiggiCompute`
- `BiggiVRFRouter`
- `BiggiMain`
- `BiggiTicketHub`

Rozšířený chapter stack:

- `BiggiSeriesRegistry`
- `BiggiChapterController`
- `BiggiMain2`

Plný core stack:

- chapter stack
- `BiggiMultiCollectionDistributor`
- `BiggiCollectionRewards`
- `BiggiTokenRewards`
- `BiggiNFTRewards`
- readery

## 7. BIGGI NFT Treasury Routing

Finalni mainnet-prep wiring pro NFT platby v BIGGI:

1. `BiggiTicketHub.mintTicketWithBiggi()` nebo `BiggiMain2.mintPublicWithBiggi(idx)` vybere BIGGI od usera.
2. `tokenSink = BiggiTreasury`, `tokenSinkBps = 10000`, `tokenSinkDepositMode = true`.
3. Core kontrakt approve-ne treasury a zavola `BiggiTreasury.receiveEcosystemBiggi(amount)`.
4. Treasury musi mit allowlist:
   - `ecosystemBiggiCallers(BiggiTicketHub) == true`
   - `ecosystemBiggiCallers(BiggiMain2) == true`
5. Treasury splitne BIGGI:
   - `34%` do `BiggiTokenRewards`
   - `33%` do `BiggiReserveV4`
   - `33%` do `BiggiDripDistributor`
6. `BiggiReserveV4.notifyCallers(BiggiTreasury) == true`, jinak reserve notify ve strict modu revertne.

Pokud `tokenSinkDepositMode == false`, `tokenSink` dostane pouze plain ERC20 transfer a treasury split se nespusti.

## 8. Dynamicke TokenRewards emise

`BiggiTokenRewards` zustava core zdroj pro rarity jednotky. NFT block weighty tedy porad urcuji pomer naroku mezi uzivateli.

Tokenomicka faze muze zapnout `BiggiTokenRewardsEmissionController`, ktery:

- vezme `units` vypocitane v core kontraktu
- spocita tydenni unit reward podle aktualniho budgetu
- omezi claim na zbyvajici tydenni budget
- nikdy nezvysi claim nad legacy limit `units * unitReward`
- pri prekroceni budgetu revertne, takze claim stav NFT se neoznaci jako vyplaceny

Controller neprevadi ani nemintuje tokeny. Vyplata zustava v `BiggiTokenRewards`.

Strict gate navic kontroluje:

- `BiggiTicketHub.tokenSink == BiggiTreasury`
- `BiggiTicketHub.tokenSinkBps == 10000`
- `BiggiTicketHub.tokenSinkDepositMode == true`
- `BiggiMain2.tokenSink == BiggiTreasury`
- `BiggiMain2.tokenSinkBps == 10000`
- `BiggiMain2.tokenSinkDepositMode == true`
- `BiggiTreasury.ecosystemBiggiCallers(BiggiTicketHub/BiggiMain2) == true`
- `BiggiReserveV4.notifyCallers(BiggiTreasury) == true`

## 9. Navazující NFT Rewards dokumentace

- `NFT_REWARDS_CONSISTENCY_AUDIT_2026-08-28_CS.md`
- `NFT_REWARDS_V2_DEPLOYMENT_RUNBOOK_CS.md`

## 10. Shrnutí

`CORE` není monolitický NFT kontrakt. Je to modulární chapter-based systém, kde:

- sale je oddělený od mint finalize logiky
- randomness je oddělená do routeru
- chapter governance je oddělená do registry/controller vrstvy
- rewards a treasury flow jsou znovupoužitelné napříč chapters
- read vrstva je oddělená od write vrstv

To je dobrý základ pro růst na více chapters a více collection větví, pokud se drží přísné deploy pořadí a wiring pravidla.
