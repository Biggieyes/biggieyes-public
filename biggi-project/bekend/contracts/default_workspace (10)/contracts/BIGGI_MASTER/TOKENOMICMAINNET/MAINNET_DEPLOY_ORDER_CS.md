# MAINNET_DEPLOY_ORDER_CS

Historicky/genericky runbook pro uplny mainnet deploy `BIGGI_MASTER`. Aktualni produkcni stack uz je nasazeny: 58/58 manifest kontraktu ma bytecode a verifikovany source. CORE pouziva jeden centralni `BiggiTicketHub` a pet chapter paru `BiggiMain` + `BiggiMain2`; live adresy a aktualni wiring jsou v `../MAINNET_CONTRACT_RECORDS.md`, `../CORE/CORE_MAINNET_REAL_DATA.md` a `../CORE/CORE_RUNBOOK_CS.md`.

Tento dokument nepouzivej jako pokyn k opakovanemu deployi nebo `initialDistribute()`. Pro dalsi chapter se nasazuje jen novy collection par a zapoji se do existujiciho Hubu, registry, controlleru, distributoru a jedne sdilene tokenomiky.

Pouzivej ho spolu s:

- [scripts/master/README.md](../../../../scripts/master/README.md)
- `scripts/master/.env.polygon.example`

## 1. Release gate pred deployem

Pred jakymkoli mainnet deployem musi byt splneno vsechno niz:

1. freeze branch / commit, ze ktereho se nasazuje
2. vyplneny finalni `.env` pro Polygon mainnet
3. potvrzeny finalni `SAFE` / `EXPECT_OWNER`
4. potvrzeny finalni `DEV_WALLET`
5. potvrzena jedna a jen jedna liquidity cesta:
   - doporuceno `keeper_proxy`
   - alternativne `automation`
   - nikdy ne obe soucasne
6. potvrzene finalni adresy:
   - `PAIR`
   - `QUOTE_TOKEN`
   - `ROUTER`
   - `FACTORY`
   - `WETH`
   - potvrdit, ze `PAIR` obsahuje `BIGGI_TOKEN` i `QUOTE_TOKEN`
   - pro deploy-only fazi muze mit `PAIR` rezervy `0/0`
   - pred aktivaci buybacku, dripu, liquidity keeperu a public token market flow musi mit `PAIR` pocatecni likviditu
7. pokud je aktivni VRF branch:
   - `VRF_COORDINATOR`
   - `VRF_KEY_HASH`
   - `VRF_SUB_ID`
   - finalni subscription ma pridany consumer
8. pokud je aktivni buyback branch:
   - finalni `BUYBACK_ROUTER`
   - finalni `POLICY` parametry
9. spustene a zelene:

```bash
npm run compile:master
npm run test:master
npm run validate:master:polygon
npm run validate:master:polygon:strict
npm run gate:master:local
npm run preflight:master:polygon -- --expect-liquidity-path keeper_proxy --expect-owner 0xYOUR_SAFE
```

10. doporucene navic pred ostrym deployem:

```bash
npm run test:master:fork
```

11. pred otevrenim redeem / public mint flow musi byt `MAIN` metadata plne nahrana a potvrzena:
   - strict `check:master` / `preflight:master` s adresami musi projit
   - `MAIN.metadataConsistency()` musi vratit `configuredCount=550`, `fullyConfigured=true`, `rewardMatrixConsistent=true`
   - `MAIN.assertMetadataConsistency()` nesmi revertovat

## 2. Kriticke env hodnoty, ktere nesmi chybet

Minimalne zkontrolovat:

- `LIQUIDITY_PATH`
- `EXPECT_LIQUIDITY_PATH`
- `EXPECT_OWNER`
- `DEV_WALLET`
- `SALE_CAP`
- `MARKETING_CAP`
- `STRICT_NOTIFY_CALLERS=1`
- `CIRCUIT_BREAKER_ENABLED=1`
- `TOKEN_REWARDS_EMISSION_ENABLED=1`
- `TOKEN_REWARDS_TARGET_WEEKLY_UNITS`
- `TOKEN_REWARDS_MIN_WEEKLY_BUDGET`
- `TOKEN_REWARDS_WEAK_WEEKLY_BUDGET`
- `TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET`
- `TOKEN_REWARDS_STRONG_WEEKLY_BUDGET`
- `TOKEN_REWARDS_MAX_WEEKLY_BUDGET`
- `TOKEN_REWARDS_BALANCE_BUDGET_BPS`
- `TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD`
- `TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD`

Pravidla:

1. `LIQUIDITY_PATH` musi byt stejny jako `EXPECT_LIQUIDITY_PATH`
2. `DEV_WALLET` nesmi zustat omylem na deploy EOA, pokud ma jit revenue na multisig nebo jinou finalni adresu
3. `EXPECT_OWNER` musi byt finalni Safe / multisig, ne deployer
4. TokenRewards emission hodnoty musi odpovidat realne ekonomice startu. Default je bezpecny start, ale pred launch je potreba potvrdit cilove tydenni jednotky a budget tiers.

## 3. Presne deploy poradi kontraktu

### Faze A - knihovny a collection core

1. `BiggiNamesLib`
2. `BiggiNamesLib2`
3. `BiggiSeriesRegistry`
4. `BiggiChapterController`
5. `BiggiTicketHub` jako jediny centralni hub
6. `BiggiCompute`
7. `BiggiMultiCollectionDistributor`
8. pro kazdy chapter samostatny `BiggiMain`
9. pro kazdy chapter samostatny `BiggiMain2`
10. `BiggiCollectionRewards`
11. `BiggiVRFRouter`; muze byt sdileny, ale kazdy `BiggiMain` musi byt explicitne schvaleny

### Faze B - tokenomics core

12. `BiggiToken`
13. `BiggiReserveV4`
14. `BiggiTreasury`
15. `BiggiDripDistributor`
16. `BiggiTokenRewards`
17. `BiggiTokenRewardsEmissionController`
18. `BiggiMasterTokenomicsConfig`

### Faze C - supply a reserve ochrana

19. potvrdit nebo vytvorit `PAIR` a `QUOTE_TOKEN`
20. deploy-only rezim povoluje prazdny `PAIR`; pred aktivaci keepers/buyback/drip musi byt doplnena pocatecni likvidita
21. `BiggiSupplyController`
22. `BiggiSupplyGuardian`
23. `BiggiDexReserveGuard`

### Faze D - optional buyback / community branch

24. `BiggiPolicy` pokud je aktivni buyback branch
25. `BiggiCommunityCenter` pokud je aktivni buyback branch
26. `BiggiBuybackAgent` pokud je aktivni buyback branch

### Faze E - liquidity branch

27. `LiquidityVault`
28. `BiggiLiquidityManager`
29. `BiggiLiquidityOrchestrator` pouze pro `keeper_proxy`
30. `BiggiLiquidityKeeperProxy` pouze pro `keeper_proxy`
31. `LiquidityAutomation` pouze pro `automation`

### Faze F - helper / reader / upkeep branch

32. `DripKeeperProxy`
33. `BiggiBuybackUpkeepProxy`
34. `BiggiNFTRewards`
35. core readery:
   - `BiggiMainReader`
   - `BiggiMultiCollectionDistributorReaderV2`
   - `BiggiChapterSeriesReader`
   - `BiggiNftRewardsReader`
36. tokenomic readery:
   - `BiggiReserveTreasuryReader`
   - `BiggiSupplyControllerReader`
   - `BiggiSupplyGuardianReader`
   - `BiggiDexReserveGuardReader`
   - `BiggiSystemReader`
   - `BiggiTokenomicsSystemAddonReader`
   - `BiggiTokenRewardsReader`
   - `BiggiBuybackReader` pokud je aktivni `BUYBACK_AGENT`
   - `BiggiLiquidityBranchUserReader` pokud je aktivni liquidity branch
   - `BiggiLiquidityHelperReader` pokud je aktivni liquidity branch a `ROUTER`
   - `BiggiTokenomikReader` pokud je aktivni `ROUTER` a `PAIR`
37. `Multicall2`

Poznamka: `scripts/master/deployMasterStack.js` umi tokenomic reader vrstvu nasadit pres `DEPLOY_TOKENOMIC_READERS=1` nebo individualni `DEPLOY_*_READER` flagy. Local deploy ji nasazuje automaticky.

## 4. Povinne wiring po deployi

### Collection + distributor wiring

Kroky pro `TicketHub` se provadi jednou na centralnim kontraktu; kroky pro `Main` a `Main2` se opakuji pro kazdy chapter. Aktualni chaptery jsou Original, Universe, Mutant, Apocalipse a Super Hero.

1. `Main.setModules(compute, vrfRouter)`
2. `Main.setTicketHub(ticketHub)`
3. `TicketHub.setDistributor(distributor)`
4. pro chapter 1 `TicketHub.setMainCollection(main)`; pro dalsi chaptery `TicketHub.configureChapter(...)` nebo odpovidajici chapter settery
5. `TicketHub.setTicketCaps(saleCap, marketingCap)` pro chapter 1 a `setChapterTicketCaps(...)` pro dalsi chaptery
6. `TicketHub.setDevWallet(devWallet)`
7. `Main2.setDistributor(distributor)`
8. `Main2.setPriceProvider(main)`
9. `Main2.setDevWallet(devWallet)`
10. `Registry.createSeries(...)` pro kazdou serii
11. `Registry.createChapter(seriesId)` pro kazdy chapter
12. `Registry.setChapterCollections(chapterId, main, main2, ticketHub)`
13. `ChapterController.configureChapter(...)`
14. `Main2.setChapterController(chapterController, chapterId)`
15. `CollectionRewards.setRegistry(registry)`
16. `CollectionRewards.setDistributor(distributor)`
17. `Distributor.addCollection(ticketHub)` pouze jednou
18. `Distributor.addCollection(main2)` pro kazdy chapter
19. `Distributor.addCollection(main)` pro kazdy chapter, pokud se pouziva jeho native distribution flow
20. `Distributor.setRegistry(registry)`
21. `Distributor.setCollectionRewards(collectionRewards)`
22. `Distributor.setReserve(reserve)`
23. `Distributor.setTreasury(treasury)`
24. `TicketHub.setTokenSink(treasury, 10000)` pouze jednou na centralnim Hubu
25. `TicketHub.setTokenSinkDepositMode(true)`
26. `Main2.setTokenSink(treasury, 10000)`
27. `Main2.setTokenSinkDepositMode(true)`

### Buyback / community wiring

1. `Distributor.setBuybackAgent(buybackAgent)` pokud buyback branch existuje
2. `Distributor.setCommunityCenter(communityCenter)` pokud community branch existuje
3. `CommunityCenter.setDistributor(distributor)` pokud community branch existuje
4. `Policy.setBuybackAgent(buybackAgent)` pokud policy existuje
5. `BuybackAgent.setDistributor(distributor)` pokud buyback branch existuje
6. `BuybackAgent.setTreasury(treasury)` pokud buyback branch existuje
7. `BuybackAgent.setPolicy(policy)` pokud policy existuje
8. `BuybackAgent.setRouter(buybackRouter)` pokud buyback branch existuje
9. `BuybackAgent.setDripLM(dripLm)` pokud existuje
10. `BuybackAgent.setFallbacks(...)`

### DripLM / moderator wiring

Tato vetev je soucast plne tokenomicke podstaty. `deployMasterStack.js` ji umi od ted nasadit automaticky:

1. pokud `MODERATOR_CENTER` neni dodany a `DEPLOY_MODERATOR_CENTER=1` nebo `DEPLOY_BUYBACK_BRANCH=1`, nasadi `ModeratorCenter`
2. pokud `DRIP_LM` neni dodany a `DEPLOY_DRIP_LM=1` nebo `DEPLOY_BUYBACK_BRANCH=1`, nasadi `BiggiDripLMToModerator`
3. `BiggiDripLMToModerator` vyzaduje `BUYBACK_ROUTER` nebo `ROUTER`; na mainnetu musi jit o realny DEX router
4. `DripDistributor.setDripLM(dripLm)`
5. `DripDistributor.setTokensPerMintOperator(dripLm)`
6. `DripDistributor.setCollection(main, true)`
7. `DripDistributor.setCollection(main2, true)`
8. `DripLM.setRouter(buybackRouter || router)`
9. `DripLM.setDripDistributor(dripDistributor)`
10. `DripLM.setReserve(reserve)`
11. `DripLM.setBuybackAgent(buybackAgent)` pokud existuje
12. `DripLM.setModeratorCenter(moderatorCenter)`
13. `ModeratorCenter.setMultiCollection(dripLm)`
14. `DripLM.setSellPct(DRIP_LM_SELL_PCT)` default `70`
15. `DripLM.setSlippageBps(DRIP_LM_SLIPPAGE_BPS)` default podle `LIQ_SLIPPAGE_BPS`
16. `DripLM.setTxDeadlineSec(DRIP_LM_TX_DEADLINE_SEC)` default podle `BUYBACK_FALLBACK_DEADLINE_SEC`
17. `DripLM.setShares(DRIP_LM_RESERVE_SHARE_BPS, DRIP_LM_MODERATOR_SHARE_BPS)` default `5000/5000`

### Token initial wiring a initial distribution

Na aktualnim Polygon deploymentu je tato sekce dokoncena: `distributed=true`, supply je `1,200,000,000 BIGGI` a reserve je locknuta. `initialDistribute()` znovu nevolat.

1. `BiggiToken.setReserve(reserve)`
2. `BiggiToken.setDripDistributor(dripDistributor)`
3. `BiggiToken.setTokenRewards(tokenRewards)`
4. `BiggiToken.setMarketingSupport(marketingSupportFinal)`
5. `BiggiToken.setSupplyController(supplyController)`
6. `BiggiToken.setSupplyGuardian(supplyGuardian)`
7. `BiggiToken.initialDistribute()`

Pozor:

1. po `initialDistribute()` se `reserveAddr` lockne
2. finalni reserve adresa proto musi byt nastavena pred timto krokem

### Reserve / treasury / drip wiring

1. `Reserve.setDistributor(distributor)`
2. `Reserve.setLiquidityManager(liquidityManager)` pokud liquidity branch existuje
3. `Reserve.setNotifyCaller(ticketHub, true)`
4. `Reserve.setNotifyCaller(main2, true)`
5. `Reserve.setNotifyCaller(distributor, true)`
6. `Reserve.setNotifyCaller(treasury, true)`
7. `Reserve.setNotifyCallerCheck(true)`
8. `Treasury.setDistributor(distributor)`
9. `Treasury.setBuybackAgent(buybackAgent)` pokud existuje
10. `Treasury.setTokenRewards(tokenRewards)`
11. `Treasury.setReserve(reserve)`
12. `Treasury.setDripDistributor(dripDistributor)`
13. `Treasury.setEcosystemBiggiCaller(ticketHub, true)`
14. `Treasury.setEcosystemBiggiCaller(main2, true)`
15. `DripDistributor.setTreasury(treasury)`
16. `DripDistributor.setDripLM(dripLm)` pokud existuje
17. `TokenRewards.setRegistry(registry)`
18. `TokenRewards.setTreasure(treasury)`
19. `TokenRewardsEmissionController.setTokenRewards(tokenRewards)`
20. `TokenRewardsEmissionController.setTreasury(treasury)`
21. `TokenRewardsEmissionController.setTargetWeeklyUnits(TOKEN_REWARDS_TARGET_WEEKLY_UNITS)`
22. `TokenRewardsEmissionController.setBudgetConfig(...)`
23. `TokenRewardsEmissionController.setInflowThresholds(...)`
24. `TokenRewards.setEmissionController(tokenRewardsEmissionController, TOKEN_REWARDS_EMISSION_ENABLED)`

Pozor: `BiggiTreasury` je pro BIGGI split fail-closed. `buybackDepositAndSplit`, `ownerDepositAndSplit` a `receiveEcosystemBiggi` reverteruji, dokud nejsou nastavene vsechny tri cile `tokenRewards`, `reserveAddr` a `dripDistributor`. Tyto kroky proto musi byt hotove pred aktivaci buybacku a pred zapnutim BIGGI plateb za NFT.

Pozor: dynamicky TokenRewards controller zachovava rarity pomery, ale omezuje tydenni emise podle budgetu. Pokud velky claim prekroci zbyvajici tydenni budget, claim revertne a tokeny zustanou claimovatelne pro mensi claim nebo dalsi tyden.

### Liquidity wiring

1. `Vault.setLiquidityManager(liquidityManager)`
2. `Vault.addWhitelistedPair(pair)`
3. `LM.setRouter(router)`
4. `LM.setFactory(factory)`
5. `LM.setReserve(reserve)`
6. `LM.setLiquidityVault(vault)`

Pro `keeper_proxy`:

1. `LM.setKeeper(orchestrator)`
2. `Orchestrator.setReserve(reserve)`
3. `Orchestrator.setLM(liquidityManager)`
4. `Orchestrator.setKeeper(liquidityKeeperProxy)`
5. `LiquidityKeeperProxy.setStrategy(...)`
6. `LiquidityKeeperProxy.setLimits(...)`

Pro `automation`:

1. `LM.setKeeper(liquidityAutomation)`
2. `LiquidityAutomation.setLM(liquidityManager)`
3. `LiquidityAutomation.setLimits(...)`
4. `LiquidityAutomation.setMinInterval(...)`

### Helper / upkeep / rewards wiring

1. `DripKeeperProxy.setDripLM(dripLm)` pokud existuje
2. `DripKeeperProxy.setKeeper(...)`
3. `BuybackUpkeepProxy.setAgent(buybackAgent)` pokud existuje
4. `BuybackUpkeepProxy.setThreshold(...)`
5. `BuybackUpkeepProxy.setPaused(false)`
6. `NFTRewards.setMainContract(main)` pokud existuje
7. `NFTRewards.setVrfRouter(vrfRouter)` pokud existuje
8. `NFTRewards.setRegistry(registry)` pokud existuje
9. `NFTRewards.setAllowedMainCollection(main2, true)` pokud existuje
10. `VRFRouter.setRewardConsumerApproval(nftRewards, true)` pokud existuje
11. tokenomic readery musi byt nasazene proti finalnim adresam ve write vrstve:
    - `RESERVE_TREASURY_READER.reserve == RESERVE`
    - `RESERVE_TREASURY_READER.treasury == TREASURY`
    - `SUPPLY_CONTROLLER_READER.controller == SUPPLY_CONTROLLER`
    - `SUPPLY_GUARDIAN_READER.guardian == SUPPLY_GUARDIAN`
    - `DEX_RESERVE_GUARD_READER.guard == DEX_RESERVE_GUARD`
    - `SYSTEM_READER.token == BIGGI_TOKEN`
    - `TOKENOMICS_SYSTEM_ADDON_READER.masterConfig == MASTER_CONFIG`
    - `BIGGI_TOKENOMICS_READER` immutables odpovidaji `BIGGI_TOKEN`, `ROUTER`, `PAIR`, `DISTRIBUTOR`, `BUYBACK_AGENT_EFFECTIVE`, `RESERVE`, `LIQUIDITY_MANAGER`, `LIQUIDITY_VAULT`, `DRIP_DISTRIBUTOR`, `TOKEN_REWARDS`
    - `TOKEN_REWARDS_READER.tokenRewards == TOKEN_REWARDS`
    - `TOKEN_REWARDS_READER.getStatus().emissionController == TOKEN_REWARDS_EMISSION_CONTROLLER` pokud je controller nasazeny

### Finalni config snapshot

1. `SupplyController.snapshotBaseline()`
2. `SupplyController.setAllowedCaller(dexReserveGuard, true)`
3. `DexReserveGuard.snapshotBaseline()`
4. `DexReserveGuard.refreshPriceAnchor()` pokud `DEX_GUARD_PRICE_CHECK_ENABLED=1` nebo `DEX_GUARD_REFRESH_PRICE_ANCHOR=1`
5. `DexReserveGuard.quoteOracleStatus()` musi byt validni, pokud `DEX_GUARD_REQUIRE_QUOTE_ORACLE=1`
6. `MasterConfig.setCore(...)`
7. `MasterConfig.setRewards(...)`
8. `MasterConfig.setPumpBranch(...)`
9. `MasterConfig.setLiquidityBranch(...)`
10. `MasterConfig.setSupplyController(...)`
11. `MasterConfig.setSupplyGuardian(...)`
12. `MasterConfig.setDexReserveGuard(...)`
13. `MasterConfig.setCollections(...)`

## 5. Povinny post-deploy check

Bezprostredne po deployi:

```bash
dry-run konfigurace:
npm run configure:master:polygon

aplikace konfigurace po kontrole dry-runu:
npm run configure:master:polygon:execute

CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
npm run preflight:master:polygon -- --addresses ./addresses.master.json --require-code --expect-liquidity-path keeper_proxy --expect-owner 0xYOUR_SAFE
```

`configureMasterEssence.js` je idempotentni post-deploy serizovac. Nenasazuje nove kontrakty a defaultne neposila transakce. Porovnava live stav s kanonickym zapojenim projektu a pri `--execute` aplikuje jen chybejici/mismatch settery.

Soucast strict checku je novy launch gate pro `MAIN` metadata:

- `MAIN.metadataConsistency()`
- `MAIN.assertMetadataConsistency()`

Pokud metadata nejsou kompletni nebo reward matice nedava smysl, strict checker failne a flow se nema poustet ven.

Pokud pouzivas jinou liquidity cestu, zmen `EXPECT_LIQUIDITY_PATH`.

Rucne potvrdit minimalne:

1. `MAIN2.devWallet == DEV_WALLET`
2. `TICKET_HUB.devWallet == DEV_WALLET`
3. `BUYBACK.distributor == DISTRIBUTOR` pokud buyback branch existuje
4. `TREASURY.buybackAgent == BUYBACK_AGENT` pokud buyback branch existuje
5. `TOKEN.reserveLocked == true`
6. `RESERVE.notifyCallerCheck == true`
7. `LM.keeper` odpovida zvolene liquidity ceste
8. `TICKET_HUB.tokenSink == TREASURY`, `tokenSinkBps == 10000`, `tokenSinkDepositMode == true`
9. `MAIN2.tokenSink == TREASURY`, `tokenSinkBps == 10000`, `tokenSinkDepositMode == true`
10. `TREASURY.ecosystemBiggiCallers(TICKET_HUB/MAIN2) == true`
11. `RESERVE.notifyCallers(TREASURY) == true`
12. `TOKEN_REWARDS.emissionController == TOKEN_REWARDS_EMISSION_CONTROLLER`
13. `TOKEN_REWARDS.emissionControllerEnabled == true`
14. `TOKEN_REWARDS_EMISSION_CONTROLLER.previewWeek(currentWeek)` vraci nenulovy `budget` a `unitReward`

## 6. Ownership handoff na multisig

Deploy nesmi koncit tak, ze owner zustane na deploy EOA.

1. vygeneruj batch:

```bash
npm run batch:ownership -- --addresses ./addresses.master.json --to 0xYOUR_SAFE --out ./ownership-transfer-batch.json
```

2. spust `txs` z aktualniho ownera / deployera
3. pockej na potvrzeni transfer tx
4. spust `acceptOwnershipTxs` z ciloveho Safe

Pozor:

1. `Ownable2Step` kontrakty bez druhe faze nezmeni ownera finalne
2. zejmena `RESERVE`, `LIQUIDITY_ORCHESTRATOR` a `LIQUIDITY_KEEPER_PROXY` musi dostat `acceptOwnership()`

Pak spust finalni strict owner check:

```bash
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_OWNER=0xYOUR_SAFE EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

## 7. Finalni go-live checklist

Pred otevrenim systemu pro uzivatele potvrdit:

1. source code je verifikovany na exploreru
2. ulozeny `addresses.master.json`
3. ulozeny deploy tx hashe
4. ulozeny ownership batch json
5. VRF subscription je funded a consumeri jsou spravne pridani
6. upkeepy jsou zaregistrovane a funded
7. `BUYBACK_AGENT` a `COMMUNITY_CENTER` nejsou na produkci prazdne, pokud ma byt branch aktivni
8. dev revenue routuje na finalni `DEV_WALLET`, ne na deploy EOA
9. nejsou soucasne aktivni `LIQUIDITY_KEEPER_PROXY` i `LIQUIDITY_AUTOMATION`
10. finalni smoke scenar probehl na fork / stagingu:
   - redeem / mint
   - drip
   - reserve notify
   - buyback share flow
   - treasury split
   - BIGGI NFT payment through treasury ecosystem split
   - TokenRewards claim pres `emissionController` pro nizkou, stredni a vysokou raritu

## 8. Co nikdy neudelat

1. nespoustet mainnet deploy bez `validate:master:polygon`
2. nenechat `EXPECT_LIQUIDITY_PATH` a `LIQUIDITY_PATH` rozdilne
3. nenechat ownership na deploy EOA
4. nevynechat `acceptOwnershipTxs`
5. nespustit `initialDistribute()` pred finalnim `setReserve(...)`
6. nenechat `DEV_WALLET` omylem na docasne deploy adrese
7. neaktivovat buyback branch bez finalniho `setDistributor(distributor)`
