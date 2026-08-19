# CORE Deep Audit - 2026-06-07

Status: lokalni deploy-readiness audit CORE mechaniky. Zadny CORE kontrakt neni podle aktualni dokumentace nasazeny na mainnet.

## Scope

Kontrolovano:

- produkcni CORE kontrakty v `CORE/*.sol`
- CORE knihovny v `CORE_LIBRARY/`
- CORE readery v `CORE_READERS/`
- ABI snapshoty v `CORE_ABI/`
- vazby `TicketHub -> Main -> VRFRouter`
- vazby `SeriesRegistry -> ChapterController -> Main2`
- native mint-share distribuce pres `BiggiMultiCollectionDistributor`
- BIGGI platby za NFT pres `TicketHub` a `Main2`
- collection/token/NFT rewards kompatibilita
- metadata readiness kontroly `BiggiMain` a `BiggiMain2`

## Provedene opravy

1. Odstranen `BiggiCollectionRewards_UPDATED.sol`
   - soubor byl draft mimo produkcni deploy flow
   - definoval `BiggiCollectionRewardsUpdatedDraft`
   - mel jine default reward castky nez produkcni `BiggiCollectionRewards`
   - po odstraneni zustava v CORE jen produkcni `BiggiCollectionRewards.sol`

2. `BiggiTicketHub`
   - `setBiggiRate(0)` nyni revertuje pres `InvalidBiggiRate`
   - `mintTicketWithBiggi()` revertuje, pokud vypoctena BIGGI platba vyjde na nulu
   - `mintTicket()` nyni distribuuje pouze aktualni `ticketPrice`
   - pripadny native overpay se vraci kupujicimu

3. `BiggiMain2`
   - `setBiggiRate(0)` nyni revertuje pres `InvalidBiggiRate`
   - `mintPublicWithBiggi()` revertuje, pokud vypoctena BIGGI platba vyjde na nulu

4. `BiggiMultiCollectionDistributor`
   - optional registry attribution uz neblokuje native distribuci
   - pokud `registry` neni kompatibilni nebo selze `chapterByCollection/getChapterMeta`, split pokracuje
   - emituje se `ChapterAttributionFailed(source, registry, amount)`

5. Test coverage
   - doplneny testy pro nulovou BIGGI sazbu a nulovou BIGGI platbu
   - doplneny test TicketHub overpay refundu
   - doplneny test, ze chybna optional registry adresa nezablokuje distributor

## Hlavni invarianty

### TicketHub/Main/VRF

Stav po kontrole:

- `BiggiTicketHub.setMainCollection` overuje zpetnou vazbu na hub
- `BiggiMain.setTicketHub` overuje zpetnou vazbu na main collection
- `BiggiMain.redeemFromTicketHub` prijima pouze nakonfigurovany hub
- `BiggiMain.fulfillRandomFromRouter` prijima pouze nakonfigurovany VRF router
- pending VRF request lze retryovat po `pendingRetryDelay`
- pri selhani router callbacku zustava pending stav v Main a lze jej obnovit retry/emergency flow

Deploy podminka:

- pred otevrenim redeem musi byt `BiggiMain.assertMetadataConsistency() == true`
- `BiggiVRFRouter` musi byt realne pridan jako consumer k VRF subscription
- `BiggiVRFRouter.approvedMains(BiggiMain) == true`

### Metadata

Stav po kontrole:

- `BiggiMain` a `BiggiMain2` maji matrix-aware metadata kontroly
- `findUnsetIndices()` vraci indexy s nevalidnim metadata stavem
- `metadataConsistency()` vraci `configuredCount`, `fullyConfigured`, `rewardMatrixConsistent`
- `assertMetadataConsistency()` revertuje pri nekompletni konfiguraci
- legacy `mainId` uniqueness helpery v knihovne jsou oznacene jako neplatne pro aktualni 550-item metadata matrix

Deploy podminka:

- pro oba hlavni collection kontrakty musi projit `assertMetadataConsistency()`
- musi byt nastavene vsechny block base URI, character URI, reward URI a contract URI podle zvolene metadata strategie

### Series/Chapter/Main2

Stav po kontrole:

- `SeriesRegistry` brani prirazeni stejne collection/hub adresy do jine chapter
- `ChapterController.configureChapter` overuje registry mapping, capy a primou vazbu `Main <-> TicketHub`
- `BiggiMain2.setChapterController` overuje, ze chapter public collection je prave tento `Main2`
- public mint je zamceny, dokud `isPublicMintUnlocked(chapterId)` neni true
- `Main2` bere cenu z chapter VRF collection, pokud je chapter controller aktivni

Deploy podminka:

- chapter musi byt vytvorena v registry
- registry musi obsahovat presne `BiggiMain`, `BiggiMain2`, `BiggiTicketHub`
- `isChapterStackConsistent(chapterId) == true`
- `isChapterCapConsistent(chapterId) == true`

### Native mint-share distributor

Stav po kontrole:

- distributor vyzaduje whitelist source collection
- distributor vyzaduje vsech 5 recipientu pred distribuci
- split je 25% collection rewards, 35% reserve, 20% buyback, 10% treasury, 10% community
- rounding remainder jde do treasury
- failed recipient transfer jde do `pending`
- owner muze retryovat pending castky
- optional registry attribution nemuze zastavit split

Deploy podminka:

- pred native paid mintem musi byt nastaveno:
  - `collectionRewards`
  - `reserve`
  - `buybackAgent`
  - `treasury`
  - `communityCenter`
  - whitelist `TicketHub`
  - whitelist `Main2`, pokud se ma otevrit public native mint

### BIGGI NFT platby

Stav po kontrole:

- `TicketHub.mintTicketWithBiggi()` a `Main2.mintPublicWithBiggi()` berou BIGGI podle `biggiPerEth`
- nulova sazba je blokovana
- nulova vypoctena token platba je blokovana
- pri `tokenSinkDepositMode == true` se BIGGI posila pres sink call `receiveEcosystemBiggi`
- pri treasury sinku ma byt route `34% token rewards / 33% reserve / 33% drip`

Deploy podminka:

- `BIGGI` token address musi byt realny token
- `biggiPerEth > 0`
- pokud se pouziva treasury sink:
  - `tokenSink == BiggiTreasury`
  - `tokenSinkBps == 10000`
  - `tokenSinkDepositMode == true`
  - `BiggiTreasury.setEcosystemBiggiCaller(TicketHub, true)`
  - `BiggiTreasury.setEcosystemBiggiCaller(Main2, true)`
  - `BiggiReserveV4.setNotifyCaller(BiggiTreasury, true)`

## Lokalni vysledek

CORE kod je po provedene lokalni kontrole konzistentni a pripraveny na finalni mainnet konfiguraci.

Spustene kontroly:

- `npm run compile:master` - OK
- `npm run test:master` - OK, `64 passing`
- `node scripts/tools/compareAbiToSource.js` - OK, `25` CORE kontraktu, `0` issues
- `node scripts/tools/compareTokenomicAbi.js` - OK, `44` tokenomic kontraktu, `0` issues, `0` processing errors
- `npx hardhat test test/master/library-consistency.smoke.test.js --config hardhat.biggi-master.cjs` - OK, `6 passing`
- `npm run gate:master:local` - exit code `0`; hardhat report bez `issues`, pouze neblokujici warnings ke starym lokalnim/reference adresam bez kodu

Mainnet deploy zustava zavisly na externich hodnotach:

- Polygon RPC
- deploy owner / final Safe
- Chainlink VRF coordinator
- VRF keyHash
- VRF subscription id
- VRF funding a consumer approval
- final metadata base URI
- final tokenomics recipient adresy
- final BIGGI token/treasury/reserve konfigurace, pokud budou BIGGI platby aktivni

## Povinne kontroly pred otevrenim sale

Spustit:

```bash
npm run compile:master
npm run test:master
node scripts/tools/compareAbiToSource.js
node scripts/tools/compareTokenomicAbi.js
```

Po deployi na Polygon:

```bash
npm run validate:master:polygon:strict
npm run check:master:core:polygon -- --require-code --strict --expect-paid-native
```

Pokud paid native sale jeste nema byt aktivni, nepouzivat `--expect-paid-native`.

## Verdikt

Lokalni CORE audit: GO.

Mainnet opening: GO az po doplneni externich hodnot, metadata URI, VRF subscription/consumer nastaveni a strict post-deploy relationship checku.
