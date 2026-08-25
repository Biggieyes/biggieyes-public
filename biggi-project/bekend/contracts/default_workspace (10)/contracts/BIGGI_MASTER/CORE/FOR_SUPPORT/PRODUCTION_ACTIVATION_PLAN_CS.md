# Produkcni aktivacni plan Polygonu

Datum: 2026-08-25

Tento postup je kanonicky read-only plan z
`config/production-activation.polygon.json`. Generator nevytvari podpisy a
neodesila transakce.

## Overeni bez mainnet zapisu

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm run plan:production-activation:polygon
npm run rehearse:production-activation:fork
npm run preflight:launch:polygon
```

Vystupy:

- `reports/production-activation-plan-polygon.json`
- `reports/production-activation/*.unsigned.json`
- `reports/production-activation-plan-fork.json`
- verejne kopie v `CORE/FOR_SUPPORT/EVIDENCE/`

## Zavezne faze

1. `00-pre-liquidity-remediation`
   - `BuybackUpkeepProxy.setThreshold(0.5 POL)`
   - `LiquidityManager.setAutoTopUpConfig(false, 5 POL, 5 POL)`
   - dokonceno na Polygonu 2026-08-25; obe post-condition prosly a automatizace zustaly paused
2. `10-initial-liquidity`
   - `8,000,000 BIGGI + 5,000 POL`
   - LP prijemce je `LiquidityVault`
   - nasledny sync je `1,600 BIGGI + 1 POL`
   - router allowance se na konci vynuluje
3. `20-post-liquidity-tokenomics`
   - snapshot SupplyController a DexReserveGuard
   - aktivace LiquidityOrchestrator, LiquidityKeeperProxy a BuybackUpkeepProxy
   - zapnuti auto-buyback
   - DripKeeper zustava paused a LM auto-top-up zustava vypnuty
4. `30-cre-wiring`
   - skutecny workflow ID a workflow owner
   - presne pet produkcnich target/selector dvojic
   - role receiveru na SupplyController, DexReserveGuard, EmissionController a LiquidityKeeperProxy
   - receiver se unpause provede jako posledni krok faze
5. `40-originals-launch`
   - aktivuje se pouze Chapter 1 `Originals`
   - chapters 2-5 zustavaji neaktivni
   - Originals Public se odpause, ale jeho mint zustava controller-gated do vycerpani sparovane VRF kolekce

## Kanonicke parametry

- `LiquidityManager.tokenPct = 100`
- `LiquidityManager.slippageBps = 300`
- `LiquidityManager.autoTopUpEnabled = false`
- ulozene LM trigger/request hodnoty jsou `5 POL / 5 POL`
- `BuybackUpkeepProxy.minNativeThresholdWei = 0.5 POL`
- Public ticket start je `500 POL`; globalni cena roste o `0.33 %` po kazdem placenem mintu napric chapters
- legacy `LIQUIDITY_AUTOMATION` zustava nenazazena na nulove adrese

## Aktualni blokatory provedeni

Read-only plan aktualne eviduje dva blokatory:

1. Owner ma `1.800179327500824706 POL`, ale samotna hodnota liquidity a sync kroku je `5001 POL`; gas je navic.
2. CRE production workflow ID/owner zatim neexistuji, protoze Deploy Access neni enabled.

Strict launch preflight eviduje 11 blockeru, protoze zapocitava i vsechny zamerne
paused/neaktivni stavy, ktere se odstrani az v jednotlivych fazich.

## Fork dukaz

Kompletni nacvik po dokonceni faze 00 provedl 22 potrebnych lokalnich transakci,
4 jiz splnene/nepovinne kroky preskocil a spotreboval `1,477,848 gas`.
Prosel presnou likviditou `8,001,600 BIGGI / 5,001 POL` po sync kroku,
Vault `accounted == real`, peti CRE cestami, paused DripKeeperem a aktivaci pouze
Chapter 1. Nebyla odeslana mainnet transakce ani vytvoren mainnet podpis.

Soubor faze 10 ma dynamicky deadline `latest block timestamp + 900 s`. Pred
skutecnym pouzitim se musi plan znovu vygenerovat; stary JSON se nikdy nepodepisuje.
