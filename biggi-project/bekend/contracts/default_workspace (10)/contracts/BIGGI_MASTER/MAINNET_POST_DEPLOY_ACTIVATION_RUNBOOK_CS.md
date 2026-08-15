# Mainnet post-deploy activation runbook

Tento dokument popisuje bezpecny postup po nasazeni kontraktu na Polygon mainnet. Cilem je mit vse pripraveno, ale nespustit ekonomicke procesy drive, nez existuje realna pocatecni likvidita.

## Stav po deployi

Po deployi mohou byt kontrakty spravne nasazene a verifikovane, ale protokol jeste nemusi byt verejne aktivni.

Bezpecny deploy-only stav:

- `BIGGI_TOKEN.totalSupply() == 0`
- `BIGGI_TOKEN.distributed() == false`
- `PAIR` existuje, ale muze mit rezervy `0/0`
- buyback, drip keeper, liquidity keeper a orchestrator zustavaji vypnute nebo paused
- `TicketHub.saleCap` muze byt `0`, dokud se nema otevrit mint
- metadata mohou byt doplnena az pred public mintem

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

## 2. Initial BIGGI distribution

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

## 6. Poradi pred public mintem

1. `npm run preflight:launch:polygon`
2. `npm run prepare:initial-distribution:polygon` dry-run
3. `EXECUTE_INITIAL_DISTRIBUTION=1 I_UNDERSTAND_INITIAL_DISTRIBUTION_LOCKS_RESERVE=1 npm run prepare:initial-distribution:polygon`
4. vlozit pocatecni likviditu pres `prepare:initial-liquidity:polygon`
5. znovu `npm run preflight:launch:polygon`
6. dry-run `npm run activate:tokenomics:polygon`
7. execute aktivace jen tech keeper vetvi, ktere maji byt opravdu live
8. doplnit metadata a zkontrolovat `MAIN.metadataConsistency()`
9. nastavit finalni `TicketHub.saleCap`, `ticketPrice`, distributor a otevrit mint
10. strict kontrola `LAUNCH_PREFLIGHT_STRICT=1 npm run preflight:launch:polygon`

## 7. Co nespoustet omylem

- `initialDistribute()` pred potvrzenim finalni reserve adresy
- aktivaci keeperu pred prvni likviditou
- auto-buyback pred treasury/reserve/drip wiring kontrolou
- public mint pred VRF consumer nastavenim a metadata consistency kontrolou
- manualni LP deposit primo do vaultu bez synchronizace pres `LiquidityManager`
