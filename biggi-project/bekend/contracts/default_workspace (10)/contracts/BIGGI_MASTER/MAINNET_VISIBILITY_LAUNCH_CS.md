# BIGGI MASTER: Mainnet Visibility Launch

> Archivni profil: tento dokument popisuje puvodni variantu `SALE_CAP=0` / `MARKETING_CAP=550`. Aktualni live chapter-aware deployment pouziva `SALE_CAP=500`, `MARKETING_CAP=50` pro kazdy chapter. Pro aktualni stav pouzij `CORE/CORE_MAINNET_REAL_DATA.md` a `addresses.master.json`.

Tento dokument je pro situaci, kdy chces:

- mit `BiggiMain` NFT uz na Polygon mainnetu
- mit je mintnute a viditelne na marketplace
- ale nechces spustit verejny sale ani plny tokenomics launch

Tohle je minimalni launch profil pro viditelnost NFT, ne plny produkcni rollout celeho `BIGGI_MASTER`.

## Souvisejici dokumenty

- `CORE/CORE_DEPLOY_ORDER_CS.md`
- `CORE/CORE_RUNBOOK_CS.md`
- `CORE/MAINNET_CONTRACT_DOSSIERS/BiggiMain/README.md`
- `CORE/MAINNET_CONTRACT_DOSSIERS/BiggiTicketHub/README.md`
- `CORE/MAINNET_CONTRACT_DOSSIERS/BiggiVrfRouter/README.md`

## 1. Co se nasazuje

Minimalni povinny set:

- `BiggiCompute`
- `BiggiVRFRouter`
- `BiggiMain`
- `BiggiTicketHub`

Volitelny rozsireny set:

- `BiggiSeriesRegistry`
- `BiggiChapterController`
- `BiggiMain2`

Pokud chces jen hlavni mystery NFT kolekci viditelnou na marketplace a nechces jeste poustet public branch, staci prvni ctyri kontrakty.

## 1.1 Co naopak pro tenhle launch nepotrebujes

Pro cisty private visibility launch s `SALE_CAP = 0` nepotrebujes:

- `BiggiMultiCollectionDistributor`
- `BiggiReserveV4`
- `BiggiTreasury`
- `BiggiBuybackAgent`
- `BiggiToken` wiring do `BiggiTicketHub`

Duvod:

- bezny placeny sale je zavreny
- pouzivas jen owner-only `mintMarketingTicket()`
- redeem jde pres `BiggiTicketHub -> BiggiMain -> BiggiVRFRouter`
- paid split flow a BIGGI-paid mint se v tomhle profilu nespousti

## 2. Co tenhle launch umi

- nasadit hlavni VRF NFT kolekci
- nasadit ticket layer
- propojit `TicketHub -> Main -> VRFRouter`
- zavrit verejny sale tim, ze `SALE_CAP = 0`
- otevrit owner-only marketing bucket tim, ze `MARKETING_CAP = 550`
- nastavit metadata URI a seednout layout pro vsech 550 NFT

## 3. Co tenhle launch neumi

- nespousti plnou tokenomiku
- nespousti reserve / treasury / buyback / drip jako nutnou soucast
- nedela NFT neprodejne

To je dulezite:

Aktualni `BiggiMain`, `BiggiMain2` a `BiggiTicketHub` jsou samostatne ERC721 kontrakty.
Po mintu budou normalne transferovatelne a pujdou listnout, pokud holder udela approval.

Takze:

- `viditelne, ale neverejne mintovane` = ano
- `viditelne, ale neprodejne` = ne, na to by se musely kontrakty upravit

## 4. Co je potreba pred deployem

Musis mit pripraveno:

- deploy wallet
- Polygon mainnet RPC
- Chainlink VRF config nebo existujici `VRF_ROUTER`
- ticket metadata base URI
- vsech 10 block base URI pro `BiggiMain`
- rewards base URI pro `BiggiMain`
- characters base URI pro `BiggiMain`
- metadata layout soubor pro `BiggiMain`

Volitelne navic, pokud nekdy potom otevres placeny sale nebo BIGGI-paid mint:

- `DISTRIBUTOR`
- `BIGGI_TOKEN`
- `RESERVE_ADDRESS`
- `BIGGI_RATE`
- pripadne `TOKEN_SINK` a `TOKEN_SINK_BPS`

Bez layout souboru se redeem nerozjede.

Duvod:

`BiggiMain.fulfillRandomFromRouter()` mintne jen tehdy, kdyz je pro vylosovany index predem nastaven:

- `background`
- `blockIdx`
- `mainId`

Jinak kontrakt spadne na `MetadataNotInitialized`.

## 5. Jak zavrit verejny sale a nechat jen private mint

Pouzij:

- `SALE_CAP = 0`
- `MARKETING_CAP = 550`

To znamena:

- bezny user nemuze pouzit `mintTicket()`
- owner muze pouzivat `mintMarketingTicket(address to)`

Tedy:

1. owner mintne marketing tickety na vlastni nebo spravovane wallety
2. drzitel ticketu udela redeem
3. tim se pres VRF mintnou skutecna NFT do `BiggiMain`
4. po mintu uz se mohou objevit na marketplace

Pokud bys nekdy nastavil `SALE_CAP > 0`, uz nestaci cisty visibility profil.
V tom okamziku musis mit nastaveny aspon `DISTRIBUTOR`, jinak se paid flow nebude routovat do zbytku ekosystemu tak, jak je zamysleno.

## 6. Deploy flow

Env template je zde:

- [scripts/master/.env.visibility.example](c:/dev/BIGGINFTWEB/biggi-project/bekend/scripts/master/.env.visibility.example)

Prakticky:

- validator umi cist vlastni env soubor
- samotny Hardhat deploy bere sit a private key z `biggi-project/bekend/.env`
- pred realnym deployem dej finalni hodnoty bud do backend `.env`, nebo je exportuj ve stejne shell session

Nejdriv validace:

```bash
node scripts/master/validateVisibilityEnv.js --network polygon --strict
```

Pak deploy:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/deployVisibilityStack.js --network polygon
```

Nebo npm alias:

```bash
npm run deploy:master:visibility:polygon
```

Vystup jde defaultne do:

```bash
addresses.visibility.json
```

## 7. Co deploy script udela

Deploy script:

1. nasadi `BiggiNamesLib`
2. nasadi `BiggiCompute`
3. nasadi `BiggiMain`
4. nasadi `BiggiTicketHub`
5. pouzije existujici `VRF_ROUTER`, nebo nasadi novy
6. provaze `VRFRouter -> Main`
7. provaze `Main -> TicketHub`
8. nastavi `saleCap / marketingCap`
9. nastavi `devWallet`
10. volitelne nastavi `Distributor / BIGGI / Reserve / token sink`, pokud je dodas
11. nastavi URI pro `Main`
12. seedne `Main` metadata layout

Pokud je `DEPLOY_PUBLIC_BRANCH=1`, navic:

13. nasadi `BiggiSeriesRegistry`
14. nasadi `BiggiChapterController`
15. nasadi `BiggiMain2`
16. propoji chapter branch

## 8. Co udelat po deployi

Pokud chces, aby uz na marketplace byly skutecne tokeny:

1. owner mintne marketing tickety na wallety, ktere ovlada
2. ty wallety provedou redeem
3. pocka se na VRF fulfillment
4. po mintu zkontroluj `tokenURI`
5. pak refresh metadata na marketplace

Dokud neexistuji skutecne mintnute tokeny, neuvidis na marketplace realne NFT polozky.

Pouhy deploy kontraktu nestaci.

## 9. Prakticka pravda o marketplace viditelnosti

Tenhle stack nema `contractURI`.

To znamena:

- tokeny mohou byt viditelne, pokud jsou mintnute a `tokenURI` vraci metadata
- collection-level marketplace presentation nemusi byt dokonala

Na viditelnost jednotlivych NFT to nevadi tolik jako na prezentaci cele kolekce.

## 10. Doporuceny minimalni private launch

Pokud chces bezpecny prvni krok:

1. nasad jen `BiggiCompute + BiggiVRFRouter + BiggiMain + BiggiTicketHub`
2. `SALE_CAP = 0`
3. `MARKETING_CAP = 550`
4. nastav vsechny URI
5. seedni vsech 550 metadata zaznamu
6. mintni par marketing ticketu na vlastni wallety
7. redeemni prvnich nekolik NFT
8. over `tokenURI` a marketplace viditelnost
9. az potom res public branch nebo plnou tokenomiku

Tohle je nejcistsi cesta, jak dostat NFT na mainnet a na marketplace bez toho, aby se otevrel verejny sale.
