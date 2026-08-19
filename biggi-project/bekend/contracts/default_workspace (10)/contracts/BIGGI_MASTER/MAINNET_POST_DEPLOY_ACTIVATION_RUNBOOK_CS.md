# Mainnet post-deploy activation runbook

Aktualizovano 2026-08-17 podle live Polygon stavu a petikapitoloveho CORE. Kanonicke adresy jsou v `MAINNET_CONTRACT_RECORDS.md` a `CORE/CORE_MAINNET_REAL_DATA.md`.

Tento dokument popisuje bezpecny postup po nasazeni kontraktu na Polygon mainnet. Cilem je mit vse pripraveno, ale nespustit ekonomicke procesy drive, nez existuje realna pocatecni likvidita.

## Aktualni stav po deployi

Po deployi mohou byt kontrakty spravne nasazene a verifikovane, ale protokol jeste nemusi byt verejne aktivni.

Aktualni bezpecny deploy-only stav:

- `BIGGI_TOKEN.totalSupply() == 1,200,000,000 BIGGI`
- `BIGGI_TOKEN.distributed() == true`
- `BIGGI_TOKEN.reserveLocked() == true`
- `PAIR` existuje, ale ma rezervy `0/0`; public launch je proto blokovany
- buyback, drip keeper, liquidity keeper a orchestrator zustavaji vypnute nebo paused
- centralni `BiggiTicketHub` obsluhuje chaptery 1-5
- kazdy chapter ma `saleCap=500`, `marketingCap=50`, 50 marketing ticketu a `active=false`
- chapter 1 `MAIN` ma metadata `550/550`; chapter 1 `MAIN2` ani budouci collection metadata jeste nejsou launch-ready
- marketing ticket metadata jsou oddelena po chapterech; NFT metadata je nutne doplnit pred aktivaci konkretniho chapteru

## Nove bezpecne skripty

Vsechny nasledujici prikazy jsou defaultne dry-run, pokud neni explicitne nastaveny execute flag.

```bash
npm run preflight:launch:polygon
npm run prepare:initial-distribution:polygon
npm run prepare:initial-liquidity:polygon
npm run activate:tokenomics:polygon
npm run manifest:deployment:polygon
```

Reporty se ukladaji do `reports/`.

## 1. Launch preflight

```bash
npm run preflight:launch:polygon
```

Kontroluje hlavne:

- RPC chainId je Polygon mainnet `137`
- vsechny hlavni kontrakty maji bytecode
- `PAIR` obsahuje `BIGGI_TOKEN` a `WPOL`
- `BIGGI_TOKEN` ma provedene `initialDistribute`
- `TicketHub` ma nastaven distributor, sale cap, cenu a BIGGI token sink do treasury
- `MAIN.metadataConsistency()` je launch-ready
- VRF ma key hash, subscription a approval pro `MAIN`
- keepers jsou stale paused, pokud jeste neprobehla aktivace

Strict rezim:

```bash
LAUNCH_PREFLIGHT_STRICT=1 npm run preflight:launch:polygon
```

Strict rezim ma projit az tesne pred verejnym mintem.

## 2. Initial BIGGI distribution - dokonceno

`BiggiToken.initialDistribute()` uz na mainnetu probehlo. Nasledujici prikazy zustavaji pouze jako historicka reference a nesmi se znovu poustet s execute flagy.

Dry-run:

```bash
npm run prepare:initial-distribution:polygon
```

Execute:

```bash
EXECUTE_INITIAL_DISTRIBUTION=1 I_UNDERSTAND_INITIAL_DISTRIBUTION_LOCKS_RESERVE=1 npm run prepare:initial-distribution:polygon
```

Tento krok zavola `BiggiToken.initialDistribute()`.

Dulezite:

- musi byt nastavene finalni adresy `RESERVE`, `DRIP_DISTRIBUTOR`, `TOKEN_REWARDS`, `MARKETING_SUPPORT`, `SUPPLY_CONTROLLER`, `SUPPLY_GUARDIAN`
- po tomto kroku se reserve adresa v tokenu lockne
- tento krok se da provest jen jednou

## 3. Pocatecni likvidita

Dry-run:

```bash
LIQ_TOKEN_AMOUNT=8000000 LIQ_NATIVE_AMOUNT=5000 npm run prepare:initial-liquidity:polygon
```

Execute priklad:

```bash
LIQ_TOKEN_AMOUNT=8000000 LIQ_NATIVE_AMOUNT=5000 EXECUTE_INITIAL_LIQUIDITY=1 npm run prepare:initial-liquidity:polygon
```

Skript pouziva QuickSwap/Uniswap V2 router a vola `addLiquidityETH`.

Dulezite:

- LP recipient je defaultne deployer wallet
- neposilej manualne LP tokeny primo do `LiquidityVault`, pokud nechces nesynchronizovane accounting chovani
- `LiquidityVault` ma byt plnen pres `LiquidityManager`, aby vault accounting odpovidal realite
- pokud tokeny pro prvni likviditu maji jit z reserve, pouzij `TRANSFER_FROM_RESERVE=1`, ale az po kontrole, ze to odpovida tokenomice

## 4. Aktivace tokenomiky po likvidite

Dry-run:

```bash
npm run activate:tokenomics:polygon
```

Execute vsech keeperu:

```bash
EXECUTE_TOKENOMICS_ACTIVATION=1 I_UNDERSTAND_KEEPERS_GO_LIVE=1 ACTIVATE_ALL_KEEPERS=1 npm run activate:tokenomics:polygon
```

Postupne execute jen vybrane casti:

```bash
EXECUTE_TOKENOMICS_ACTIVATION=1 I_UNDERSTAND_KEEPERS_GO_LIVE=1 ENABLE_LIQUIDITY_ORCHESTRATOR=1 ENABLE_LIQUIDITY_KEEPER=1 npm run activate:tokenomics:polygon
```

```bash
EXECUTE_TOKENOMICS_ACTIVATION=1 I_UNDERSTAND_KEEPERS_GO_LIVE=1 ENABLE_BUYBACK_UPKEEP=1 ENABLE_AUTO_BUYBACK=1 npm run activate:tokenomics:polygon
```

```bash
EXECUTE_TOKENOMICS_ACTIVATION=1 I_UNDERSTAND_KEEPERS_GO_LIVE=1 ENABLE_DRIP_KEEPER=1 npm run activate:tokenomics:polygon
```

Aktivacni skript nejdriv vyzaduje:

- `BIGGI_TOKEN.distributed() == true`
- `PAIR` ma nenulove rezervy
- `PAIR.totalSupply() > 0`

Potom muze:

- udelat `SupplyController.snapshotBaseline()`
- udelat `DexReserveGuard.snapshotBaseline()`
- odemknout `LiquidityOrchestrator`
- odemknout `LiquidityKeeperProxy`
- odemknout `DripKeeperProxy`
- odemknout `BuybackUpkeepProxy`
- zapnout `BuybackAgent.autoBuybackEnabled`
- volitelne zapnout `LiquidityManager.autoTopUpEnabled`

## 5. Deployment manifest

```bash
npm run manifest:deployment:polygon
```

Vytvori:

- `reports/deployment-manifest-polygon.json`
- `contracts/default_workspace (10)/contracts/BIGGI_MASTER/MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`

Manifest je pro archivaci live adres, bytecode stavu, verification stavu a creation transakci podle exploreru.

## 6. Aktualni poradi pred public mintem

1. `npm run preflight:launch:polygon`
2. potvrdit finalni `DEV_WALLET`, owner/Safe a VRF subscription/consumer wiring
3. doplnit chapter 1 `MAIN2` metadata a proverit metadata obou collection kontraktu
4. vlozit pocatecni BIGGI/WPOL likviditu pres `prepare:initial-liquidity:polygon`
5. znovu `npm run preflight:launch:polygon`
6. provest kontrolovany end-to-end mint/redeem test chapteru 1
7. ziskat CRE Deploy Access, workflow ID a workflow ownera; receiver ponechat do finalniho gate paused
8. dry-run `npm run activate:tokenomics:polygon`
9. aktivovat pouze `LIQUIDITY_KEEPER_PROXY` cestu a schvalene CRE vetve; nepoustet paralelne `LIQUIDITY_AUTOMATION`
10. nastavit `BiggiTicketHub.setChapterActive(1, true)` az jako vedomy public-mint krok
11. strict kontrola `LAUNCH_PREFLIGHT_STRICT=1 npm run preflight:launch:polygon`

## 7. Co nespoustet omylem

- znovu volat `initialDistribute()`; distribuce uz probehla a reserve je locknuta
- aktivaci keeperu pred prvni likviditou
- auto-buyback pred treasury/reserve/drip wiring kontrolou
- public mint pred VRF consumer nastavenim a metadata consistency kontrolou
- manualni LP deposit primo do vaultu bez synchronizace pres `LiquidityManager`
