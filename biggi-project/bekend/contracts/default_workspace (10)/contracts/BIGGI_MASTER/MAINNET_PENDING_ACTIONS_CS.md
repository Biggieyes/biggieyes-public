# BIGGI mainnet pending actions

Stav k 2026-08-25. Tento dokument vychazi z aktualni live read-only kontroly Polygon mainnetu. Audit sam neposila zadne transakce.

Kompletni zavazne poradi je v [MAINNET_FULL_DEPLOY_SEQUENCE_CS.md](MAINNET_FULL_DEPLOY_SEQUENCE_CS.md). Posledni launch preflight aktualne eviduje 11 blockeru a 2 ocekavane warningy.

## 1. Kriticka bezpecnost

- Puvodni deployer/owner private key byl zobrazen v pracovnim vystupu a puvodni adresa zustava pouze historickym deployerem.
- Projektove ownable kontrakty i VRF v2.5 subscription byly preneseny na `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`.
- Pred public launchem je stale doporuceno zvazit hardware-wallet-backed Safe/multisig jako dlouhodoby owner.
- Nikdy neposilat ani nevkladat novy private key do chatu nebo dokumentace.

## 2. Core konfigurace

Zamer projektu je 550 ticketu celkem:

- `SALE_CAP=500`
- `MARKETING_CAP=50`
- cena marketing ticketu `1 POL` (snapshot; marketing mint nezvysuje krivku)
- cena prvniho paid ticketu `500 POL`
- paid cena se po kazdem paid mintu nasobi `10033 / 10000` (+0.33 %)

Centralni live TicketHub ma `saleCap=500`, `marketingCap=50`, verejnou startovni cenu `500 POL`, finalni distributor a dev wallet. Je napojen na pet series/chapter paru; kazdy chapter ma 50 marketing ticketu a zustava neaktivni. Marketing tickety si zachovavaji snapshot `1 POL`; prvni paid ticket Chapter 1 bude token ID 51. CORE wiring kontrolovat pred kazdym dalsim write krokem pres `npm.cmd run verify:master:core-series:polygon` a `npm.cmd run check:master:core:polygon`.

## 3. Chainlink VRF

Subscription:

- Coordinator: `0xec0Ed46f36576541C75739E915ADbCb3DE24bD77`
- Subscription ID: `81201946401186585545741412524989119977867721966007705722641563343499481545614`
- Consumer: `VRF_ROUTER=0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F`

Live stav:

- LINK balance: `0`
- native balance: `2 POL`
- consumers: pouze ocekavany `VRF_ROUTER`
- request count: `0`
- subscription owner: `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`

Pred mintem provest jeden kontrolovany VRF request a podle realne spotreby nastavit monitoring zustatku.

## 4. Token a likvidita

Pred verejnym launchem:

- jednorazovy `BIGGI.initialDistribute` je hotovy a reserve konfigurace je zamknuta;
- live rozdeleni je Reserve 600M, DripDistributor 200M, TokenRewards 200M a marketing 200M BIGGI;
- dodat pocatecni BIGGI/WPOL likviditu;
- overit nenulove reserves a LP supply;
- LP tokeny ulozit do urceneho LiquidityVaultu.

Aktualne je total supply `1.2B BIGGI` a DEX pair nema likviditu.

## 5. CRE

- Deploy Access: ceka na schvaleni Chainlinkem.
- Workflow dry-run: uspesny, `failed=0`, bez broadcastu.
- Posledni dry-run: `needed=1`, `submitted=0`; zapis by potreboval pouze rewards week roll a byl bezpecne preskocen.
- Registry: `private`.
- Receiver `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` je nasazeny, verifikovany a paused.
- Pet produkcnich target/selector dvojic zatim neni allowlisted; to je zamerne do finalniho workflow ID/owner wiring.

Po schvaleni:

1. nasadit CRE workflow neaktivni;
2. uzamknout receiver na workflow ID a workflow ownera;
3. zapojit pouze pet schvalenych target/selector kombinaci;
4. aktivovat workflow az po liquidity a finalnim preflightu;
5. ponechat samostatny `DRIP_KEEPER_PROXY` paused, protoze drip spousti BuybackAgent primo.

Pre-liquidity oprava byla potvrzena na Polygonu 2026-08-25: `BUYBACK_UPKEEP_PROXY.minNativeThresholdWei=500000000000000000` (`0.5 POL`) a LiquidityManager ma pri `autoTopUpEnabled=false` hodnoty `5 POL / 5 POL`. Proxy zustava paused. Tx hashe a post-state jsou v `CORE/FOR_SUPPORT/EVIDENCE/pre-liquidity-remediation-execution-polygon.json`.

## 6. Metadata a finalni gate

- MAIN metadata kontrola je konzistentni pro 550 polozek.
- Chapter 1 MAIN2 metadata jsou on-chain `100/100`, `fullyConfigured=true` a `rewardMatrixConsistent=true`; kontrakt zustava zamerne paused.
- Finalni obrazky/URI budoucich chapteru 2-5 musi byt doplneny a overeny pred aktivaci kazdeho z nich.
- Pred otevrenim mintu spustit znovu:

```powershell
npm.cmd run check:master:core:polygon
npm.cmd run preflight:launch:polygon
```

Public launch je povolen pouze pri nulovem poctu blockeru.
