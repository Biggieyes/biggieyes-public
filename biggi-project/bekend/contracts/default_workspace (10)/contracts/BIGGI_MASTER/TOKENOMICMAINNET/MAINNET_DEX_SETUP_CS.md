# MAINNET DEX SETUP PRO BIGGI_MASTER

## Aktualni produkcni volba (overeno 2026-08-28)

DEX uz je zvolen a DEX-sensitive kontrakty jsou na Polygon mainnetu zapojene:

| Hodnota | Produkcni nastaveni |
| --- | --- |
| DEX | `QuickSwap Polygon PoS V2` |
| `BIGGI_TOKEN` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| `ROUTER` | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` |
| `FACTORY` | `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` |
| `WETH` / `QUOTE_TOKEN` | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` (WPOL) |
| `PAIR` | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |
| Liquidity path | `keeper_proxy` |

On-chain kontrola potvrdila `router.WETH()`, `factory.getPair(BIGGI, WPOL)`,
oba pair tokeny a kompletni wiring `LiquidityManager -> Orchestrator -> KeeperProxy`.
Pair je zamerne stale prazdny. Finalni parametry seedu a jediny povoleny execution
postup jsou v `INITIAL_LIQUIDITY_RUNBOOK_CS.md`.

Nasledujici kapitoly vysvetluji obecny model a slouzi pro audit; nejsou pokynem
k vyberu jineho DEXu nebo vytvoreni dalsiho pairu.

Tento dokument je prakticky po lopate:

- co v `BIGGI_MASTER` znamena `PAIR`, `QUOTE_TOKEN`, `ROUTER`, `FACTORY`, `WETH`
- proc local/mock hodnoty nestaci pro mainnet
- jak udelat produkcni DEX setup bez chaosu
- proc aktualni deploy script neni idealni pro "cold start" uplne od nuly

## 1. Co ty adresy ve skutecnosti jsou

Pro `BIGGI_MASTER` to znamena:

- `ROUTER`
  kontrakt DEXu, pres ktery se delaji swapy a pridava likvidita
- `FACTORY`
  kontrakt DEXu, ktery zna nebo vytvari pairy
- `WETH`
  wrapped native token dane site v logice V2 routeru
- `QUOTE_TOKEN`
  druhy token v paru proti `BIGGI`
- `PAIR`
  konkretni BIGGI pair na DEXu

V tomhle stacku to neni kosmetika. Tyhle adresy pouzivaji:

- liquidity branch
- buyback branch
- supply controller
- dex reserve guard

Takze na mainnetu to musi byt skutecne adresy skutecneho DEXu.

## 2. Co bylo v local/mock setupu

Na localu nebo test setupu je mozne:

- nasadit mock router
- nasadit mock factory
- nasadit mock pair
- nasadit mock quote token

To je dobre jen na testovani logiky.

Na produkci to tak byt nesmi.

## 3. Co to znamena v produkci

Na produkci potrebujes realny `Uniswap V2-like` DEX.

Nemusi to byt znacka `Uniswap`.
Musi to ale umet V2 rozhrani, ktere `BIGGI_MASTER` ceka:

- `factory()`
- `WETH()`
- `getPair(...)`
- `getAmountsOut(...)`
- `addLiquidityETH(...)`

Prakticky to znamena:

1. vyberes jeden konkretni Polygon V2-compatible DEX
2. vezmes z jeho oficialnich docs realne adresy `ROUTER` a `FACTORY`
3. zvolis quote token proti BIGGI
4. zjistis wrapped native token, ktery ten router pouziva jako `WETH`
5. vytvoris nebo dohledas realny BIGGI pair
6. pair adresu ulozis jako `PAIR`

## 4. Co je nejbezpecnejsi quote token

Nejjednodussi varianta je:

- BIGGI / wrapped native token

To znamena:

- `QUOTE_TOKEN = WETH`

Vyhoda:

- jednodussi buyback
- jednodussi price path
- jednodussi liquidity branch
- script i readery s tim pocitaji dobre

Alternativa je stablecoin pair, ale to je dalsi komplikace navic.

Pro prvni produkcni launch je jednodussi jet proti wrapped native tokenu.

## 5. Jak vznikne realny PAIR

`PAIR` neni neco, co si vymyslis.

Je to realna adresa poolu na zvolenem DEXu.

Vznikne takto:

1. mas nasazeny `BIGGI_TOKEN`
2. mas zvoleny `QUOTE_TOKEN`
3. na V2 DEXu zavolas `createPair(BIGGI, QUOTE_TOKEN)` nebo pouzijes UI/router flow, ktery pair vytvori pri prvnim pridani liquidity
4. pak overis pair pres `factory.getPair(BIGGI, QUOTE_TOKEN)`
5. tu vyslednou adresu zapises do `PAIR`

`PAIR` tedy casto neznas predem.

## 6. Nejdulezitejsi pravidlo pro full tokenomics deploy

Pro plny tokenomics deploy na mainnetu je nejcistsi cesta mit predem hotove:

- realny DEX
- realny `ROUTER`
- realny `FACTORY`
- realny `WETH`
- realny `QUOTE_TOKEN`
- realny `PAIR`
- pocatecni likviditu v paru

Toto je doporucena cesta pro BIGGI mainnet.

`deployMasterStack.js` defaultne zustava strict: na non-local siti chce znat `PAIR` a `QUOTE_TOKEN`. Volitelny `ALLOW_PENDING_PAIR=1` existuje jen jako nouzovy fallback, pokud by bylo nutne nasadit tokenomiku pred finalnim pairem. Pro planovany produkcni launch ho nepouzivejte.

`BiggiDexReserveGuard` navic validuje, ze `PAIR` opravdu obsahuje jak `BIGGI_TOKEN`, tak `QUOTE_TOKEN`.

## 7. Spravny produkcni postup pro prvni launch

Nejrozumnejsi je dvoufaze.

### Faze A: nasadit core / tokenovou zakladnu

Nasad:

- `BiggiToken`
- `Reserve`
- `Treasury`
- `DripDistributor`
- `TokenRewards`
- `Registry`
- `ChapterController`
- `Compute`
- `Main`
- `Main2`
- `TicketHub`
- `CollectionRewards`
- `Distributor`
- `NFTRewards`
- `VRFRouter`

Pokud uz mas vyresenou pocatecni likviditu, muzou DEX-sensitive vetve jit v naslednem full deployi rovnou s realnym `PAIR`.

### Faze B: vytvorit realny DEX pair

Potom:

1. zvolis produkcni DEX
2. vezmes jeho oficialni `ROUTER`
3. vezmes jeho oficialni `FACTORY`
4. zjistis `WETH` z routeru nebo z oficialnich docs
5. zvolis `QUOTE_TOKEN`
6. vytvoris pair `BIGGI / QUOTE_TOKEN`
7. overis `PAIR` pres `factory.getPair(...)`

### Faze C: dopojit tokenomics a automation

Teprve kdyz existuje realny `PAIR`, nasad nebo nakonfiguruj:

- `SupplyController`
- `SupplyGuardian`
- `DexReserveGuard`
- `LiquidityManager`
- `LiquidityVault`
- `LiquidityOrchestrator` nebo `LiquidityAutomation`
- `DripLM`
- `BuybackAgent`
- `Policy`
- upkeep/proxy kontrakty
- `MasterTokenomicsConfig`

Pak dopln:

- `PAIR`
- `QUOTE_TOKEN`
- `ROUTER`
- `FACTORY`
- `WETH`

do finalniho `.env` a `addresses.master.json`.

Pri full deployi s existujici likviditou deploy flow zkusi:

- `SupplyController.snapshotBaseline()`
- `DexReserveGuard.snapshotBaseline()`
- `DexReserveGuard.refreshPriceAnchor()`, pokud je `DEX_GUARD_PRICE_CHECK_ENABLED=1` nebo `DEX_GUARD_REFRESH_PRICE_ANCHOR=1`

## 8. Co mas udelat ty konkretne

Pro `BIGGI_MASTER` doporucuji tenhle prakticky postup:

1. vyber jeden konkretni V2-compatible Polygon DEX
2. rozhodni, ze prvni produkcni pair bude `BIGGI / wrapped native`
3. priprav finalni produkcni adresy:
   - `ROUTER`
   - `FACTORY`
   - `WETH`
4. nasad nebo potvrd finalni `BIGGI_TOKEN`
5. vytvor pair `BIGGI / WETH`
6. z factory vytahni finalni `PAIR`
7. nastav `QUOTE_TOKEN = WETH`
8. dopln tyto hodnoty do `.env`
9. dopln tyto hodnoty do `addresses.master.json`
10. teprve potom pust preflight a finalni wiring check

## 9. Co je nejpravdepodobnejsi nejmensi chaos varianta

Pokud chces co nejmensi bordel:

- DEX: jeden V2-compatible Polygon DEX
- pair: `BIGGI / wrapped native`
- `QUOTE_TOKEN = WETH`
- liquidity path: vyber jen jednu z dvojice:
  - `automation`
  - `keeper_proxy`

Na prvni produkcni launch je lepsi nechat jednu aktivni liquidity path, ne obe.

## 10. Co zatim nedelej

Ted jeste nedelej:

- nepouzivej local/mock `PAIR`, `ROUTER`, `FACTORY`, `WETH`
- nesnaz se prohlasit `addresses.master.json` za mainnet, pokud v nem mas `localhost`
- nepoustet finalni strict mainnet check bez realneho `POLYGON_RPC_URL`
- nenechavat `DEV_WALLET` a `EXPECT_OWNER` prazdne
- nespoustej buyback/liquidity branch proti fake pairu

## 11. Nejkratsi pravda v jedne vete

Na mainnetu pro `BIGGI_MASTER` potrebujes realny V2-compatible DEX, realny `BIGGI` pair a velmi pravdepodobne dvoufaze nasazeni, protoze aktualni deploy script neni staveny jako bezproblemovy "cold start from zero" pro novy token a novy realny pair v jednom kroku.

## 12. Oficialni zdroje

DEX adresy a V2 reference si ber vzdy z oficialnich zdroju zvoleneho DEXu.

Napriklad:

- QuickSwap Contracts & Addresses:
  https://docs.quickswap.exchange/overview/contracts-and-addresses
- QuickSwap V2 pair guide (`getPair`):
  https://docs.quickswap.exchange/technical-reference/guides/smart-contract-integration/v2-pair-addresses
- Uniswap V2 Router02 reference:
  https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02
