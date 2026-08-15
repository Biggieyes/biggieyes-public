# BIGGI_MASTER source of truth

Tento soubor je navigacni vrstva pro dalsi praci na BIGGI_MASTER. Nenahrazuje
runbooky; pouze urcuje, ktere dokumenty maji prednost pri kodu, deployi,
wiringu a CRE automatizaci.

## Zavazne vrstvy

1. `TOKENOMICMAINNET/README.md` a souvisejici deployment/ABI zaznamy:
   aktualni stav mainnet tokenomics, overene deploymenty, verified kontrakty,
   ABI a TokenRewards emission controller.
2. Tokenomics consistency notes a auditni dokumenty:
   historicke hardening zmeny, scaling kapitoly, BIGGI NFT payment routing,
   liquidity/reserve opravy a CRE migration.
3. `MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md`:
   CRE workflow, `BiggiCREAutomationReceiver`, keeper targety a presne poradi
   aktivace.
4. `MAINNET_DEPLOY_ORDER_CS.md` spolu s `MAINNET_DEX_SETUP_CS.md`:
   deployment order, wiring, DEX pozadavky, liquidity path a final gate.

## Aktualni zaver

Core tokenomics uz neni navrh od nuly. Je nasazena a overena. Kriticka prace
pred verejnou aktivaci je produkcni konfigurace, wiring, DEX liquidity, CRE
activation a ownership handoff.

## Poradi zavislosti

```text
REAL DEX
  |
  +-- ROUTER
  +-- FACTORY
  +-- WETH
  +-- BIGGI/WETH PAIR
          |
          +-- initial liquidity
                  |
                  v
        DEX / Liquidity branches
                  |
                  v
        Tokenomics final wiring
                  |
                  v
        CRE Receiver + workflow
                  |
                  v
        final strict gate
                  |
                  v
        Safe ownership
                  |
                  v
             GO LIVE
```

## CRE activation gate

CRE se nema aktivovat, dokud nejsou hotove vsechny tyto body:

- skutecny Polygon DEX `ROUTER`, `FACTORY` a `WETH`;
- skutecny `BIGGI/WETH` pair;
- pocatecni liquidity;
- finalni tokenomics wiring;
- `DEV_WALLET`;
- `EXPECT_OWNER`;
- CRE workflow ID a owner;
- receiver allowlist;
- vsechny keeper role;
- metadata `MAIN = 550`, `fullyConfigured = true`,
  `rewardMatrixConsistent = true`;
- strict Polygon gate.

Receiver zustava paused az do splneni gate. Aktivni liquidity cesta je pouze
`LIQUIDITY_KEEPER_PROXY`; `LIQUIDITY_AUTOMATION` nesmi bezet paralelne.

## BIGGI payment flow

```text
TicketHub / Main2
       |
       | 100% BIGGI
       v
BiggiTreasury
       |
       +-- 34% -> TokenRewards
       +-- 33% -> Reserve
       +-- 33% -> DripDistributor
```

Flow je fail-closed. Pokud chybi kterykkoli ze tri prijemcu, transakce se ma
revertnout.

## Finalni CRE vetve

```text
CRE
 |
 +-- Supply
 |     +-- SupplyController.performUpkeep()
 |
 +-- Buyback
 |     +-- BuybackUpkeepProxy.performUpkeep()
 |
 +-- Liquidity
 |     +-- LiquidityKeeperProxy.performUpkeep()
 |
 +-- DEX Guard
 |     +-- DexReserveGuard.performUpkeep()
 |
 +-- Rewards Week
       +-- TokenRewardsEmissionController.rollCurrentWeek()
```

Drip neni samostatna CRE periodicka vetev. Aktivuje se jen pres uspesny buyback,
ktery vola `dripOnBuy(acquired)`.
