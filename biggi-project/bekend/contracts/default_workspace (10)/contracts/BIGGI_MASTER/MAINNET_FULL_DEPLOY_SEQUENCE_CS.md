# BIGGI Polygon mainnet: finalni deploy a launch postup

Stav k 2026-08-25. Tento dokument je hlavni poradi zbyvajicich kroku. Vychazi z live read-only kontrol Polygonu, overeni vsech peti CORE chapteru a lokalnich testu.

## Aktualni verdikt

- CORE a tokenomika jsou nasazene na Polygon mainnetu.
- Deployment manifest eviduje 58 unikatnich projektovych deploymentu: 58 ma bytecode a 58 je verifikovano.
- Centralni TicketHub, SeriesRegistry, ChapterController, readery a pet opravenych VRF/Public paru jsou nasazene. Aktualni kontrola je `223/223`; vsech pet Public kontraktu ma `MAX_SUPPLY=100`.
- Opravena Public migrace prosla kompletnim Polygon fork nacvikem: 5 deploymentu, 136 lokalnich transakci a finalni wiring audit `deployed-wired-paused`.
- `BiggiCREAutomationReceiver` je nasazeny, verifikovany a zamerne paused.
- `okForDeployOnly=true`, ale `okForPublicLaunch=false`.
- Posledni `npm.cmd run preflight:launch:polygon` vratil 11 blockeru a 2 ocekavane warningy k CollectionRewards budgetu a BIGGI-paid mintum.
- Kanonicky read-only plan ma pet oddelenych fazi a posledni Polygon-fork rehearsal po dokonceni faze 00 provedl 22 potrebnych lokalnich transakci; 4 jiz splnene/nepovinne kroky preskocil a vsechny post-checky prosly. Zadna mainnet transakce ani podpis pri rehearsal nevznikly.
- Ownership transfer, VRF subscription transfer, CRE receiver deploy a pocatecni distribuce BIGGI jsou hotove. Initial liquidity ani CRE aktivace zatim odeslane nebyly.

## Historicky odhad POL nakladu

Nasledujici odhad je snapshot z 2026-06-29 a nesmi se pouzit jako aktualni gas quote. Pred kazdym write krokem je nutne cenu znovu spocitat z aktualnich Polygon dat.

Live odhad k 2026-06-29, Polygon blok priblizne `89353439`:

- Polygon Gas Station standard `maxFee`: priblizne `422.13 gwei`.
- Odhad vsech zbyvajicich setup transakci: priblizne `37 154 620 gas`.
- Horni odhad pri uvedenem standard `maxFee`: priblizne `15.68 POL`.
- S 30% rezervou: priblizne `20.39 POL`.
- Bez MAIN2 metadata: priblizne `5 412 582 gas`, tedy `2.28 POL`; s rezervou `2.97 POL`.
- MAIN2 metadata samotna: priblizne `31 742 038 gas`, tedy `13.40 POL` pri aktualnim standard maxFee.
- Pri gas price `50 gwei` by stejny kompletni setup stal priblizne `1.86 POL`, s 30% rezervou `2.42 POL`.
- Aktualni zustatek puvodni admin wallet byl pri kontrole priblizne `2.406 POL`.

Tento historicky odhad vychazel ze zruseneho 550-radkoveho MAIN2 modelu a pro opraveny Public redeploy neni platny. Posledni read-only preflight je ulozen v `reports/public-collections-redeploy-polygon.json`; jeho odhad pokryva pouze pet deployment transakci, konfiguracni a wiring transakce jsou navic. Pred execute je nutny novy preflight. Naklady na likviditu, VRF subscription, CRE, IPFS a hosting nejsou zahrnuty.

- zvoleny `LIQ_NATIVE_AMOUNT`, ktery se vlozi jako kapital do BIGGI/WPOL poolu;
- castku vlozenou do VRF subscription;
- pripadne CRE servisni/billing naklady po schvaleni pristupu;
- IPFS pinning nebo frontend hosting.

Aktualni gas je velmi vysoky. MAIN2 metadata neodesilat pri teto cene; pred kazdym batchem znovu nacist Polygon Gas Station a nastavit maximalni prijatelnou cenu.

VRF router pouziva native payment, callback limit `300 000 gas` a 500 gwei lane. Chainlink pro Polygon uvadi native premium `84 %` a coordinator overhead `99 500 gas`. Pri lane stropu 500 gwei je hruby horni odhad jednoho fulfillmentu az priblizne `0.37 POL` plus pripadna dalsi slozka poplatku; skutecna cena zavisi na pouzitem callback gasu a aktualnim gas price. Subscription nema automaticky top-up z ticket revenue a musi byt monitorovana a doplnovana.

## Co je jeste potreba dodat

Do chatu neposilat zadny private key ani seed phrase. Potrebne jsou pouze verejne hodnoty:

1. Finalni `LIQ_TOKEN_AMOUNT` a `LIQ_NATIVE_AMOUNT` pro pocatecni BIGGI/WPOL likviditu.
2. Potvrzeni `LIQ_LP_RECIPIENT=0xFe234394845B601B2c671c0dD631fA6290c02bb9` (`LiquidityVault`).
3. Provozni minimum a monitoring financovani VRF subscription.
4. `PUBLIC_METADATA_FILE`: kompletni 100polozkova MAIN2 metadata matice (10 NFT v kazdem z 10 bloku, bez background klonu) a finalni IPFS URI pro aktivovany chapter.
5. Schvaleny Chainlink CRE Deploy Access a z nej ziskane workflow ID/owner.

## Aktualnich 11 launch blockeru

Stav z `preflight:launch:polygon` po nasazeni CRE receiveru:

1. BIGGI/WPOL pair nema pocatecni likviditu.
2. Chapter 1 Public je zamerne paused; metadata jsou `100/100`, `fullyConfigured=true` a `rewardMatrixConsistent=true`.
3. `CRE_AUTOMATION_RECEIVER` je zamerne paused.
4. CRE workflow ID jeste neni zamknute v receiveru.
5. CRE workflow owner jeste neni zamknuty v receiveru.
6. `LIQUIDITY_ORCHESTRATOR` je paused.
7. `LIQUIDITY_KEEPER_PROXY` je paused.
8. `BUYBACK_UPKEEP_PROXY` je paused.
9. BuybackAgent auto-buyback zatim neni zapnuty.
10. Pet CRE call allowlist polozek a ctyri target-side role zatim nejsou zapojene.
11. Originals Chapter 1 zatim neni aktivni.

Mimo on-chain preflight zustava externi blocker: CRE Deploy Access je stale `Not enabled`. Receiver `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` je nasazeny, overeny pres Sourcify a bezpecne paused.

Finalni image URI kapitol 2-5 chybi, ale neblokuji aktivaci kapitoly 1. Kazdy budouci chapter je musi mit doplnene a overene pred svou vlastni aktivaci. TokenRewards zahrnuje VRF i Public kolekci kazdeho chapteru; CollectionRewards zahrnuje pouze VRF kolekci.

## Presne poradi

### 1. Bezpecnost a vlastnictvi

Puvodni owner key byl zobrazen v pracovnim vystupu a musi byt povazovan za kompromitovany.

1. Vytvorit novou bezpecnou wallet a zalohovat ji mimo repozitar.
2. Do `.env.core.polygon` lokalne nastavit:

```text
EXPECT_OWNER=<NEW_OWNER_ADDRESS>
DEV_WALLET=<DEV_WALLET>
MARKETING_SUPPORT=<MARKETING_SUPPORT>
CRE_RECEIVER_OWNER=<NEW_OWNER_ADDRESS>
```

3. `COMPROMISED_OWNER_ADDRESS` ponechat beze zmeny. Finalni preflight tim starou adresu odmitne.
4. Vygenerovat ownership batch:

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm.cmd run batch:ownership -- --to <NEW_OWNER_ADDRESS> --out reports/ownership-transfer-batch.json
```

5. Ze stareho ownera provest `transferOwnership` pouze pro projektove kontrakty. Neprenaset vlastnictvi externiho Chainlink coordinatoru ani KeystoneForwarderu.
6. Z noveho ownera provest `acceptOwnership()` pro tri `Ownable2Step` kontrakty:
   - `BiggiReserveV4`
   - `BiggiLiquidityOrchestrator`
   - `BiggiLiquidityKeeperProxy`
7. Prenest take vlastnictvi VRF v2.5 subscription:
   - stary owner: `requestSubscriptionOwnerTransfer(subId, NEW_OWNER_ADDRESS)`
   - novy owner: `acceptSubscriptionOwnerTransfer(subId)`
8. Znovu spustit:

```powershell
npm.cmd run audit:ownership:polygon
```

9. Overit, ze vsech 30 projektovych ownable kontraktu vlastni nova adresa a ze nema zadny kontrakt `pendingOwner`.
10. Stary key odstranit z backend `.env` a `.env.core.polygon`. CRE prikazy spoustet z `bekend/cre-workflows/biggi-cre`, ne z korene backendu.

### 2. Lokalni release gate

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm.cmd run compile:master
npm.cmd run test:master
node scripts/tools/compareTokenomicAbi.js
node scripts/tools/compareAbiToSource.js
```

Vse musi skoncit bez chyby. `gate:master:local` nepouzivat jako mainnet kontrolu, protoze pracuje s lokalnim deployem.

### 3. Overit hotovy CORE wiring

Centralni chapter-aware CORE wiring a capy `500/50` jsou hotove. Konfiguracni execute skript bez noveho schvaleneho duvodu znovu nespoustet.

Read-only kontrola:

```powershell
npm.cmd run verify:master:core-series:polygon
npm.cmd run check:master:core:polygon
```

Skript musi nastavit nebo potvrdit zejmena:

- `TicketHub.distributor = DISTRIBUTOR`
- `TicketHub.setTicketCaps(500, 50)`
- `TicketHub.devWallet = DEV_WALLET`
- `Main2.devWallet = DEV_WALLET`
- `BiggiToken.marketingSupportAddr = MARKETING_SUPPORT`
- vsech pet series/chapter vazeb
- Reserve notify callers pro TicketHub, Main2 a Treasury
- rewards, registry, distributor a token sink vazby

Kontrola:

```powershell
npm.cmd run check:master:core:polygon
```

### 4. MAIN2 redeploy dokoncen; doplnit budouci Public metadata

1. Redeploy peti opravenych Public kontraktu byl dokoncen 2026-08-18; znovu jej nespoustet.
2. Aktivni adresy jsou v `addresses.master.json`; report je `reports/public-collections-redeploy-polygon.json`.
3. Pro kazdy chapter seedovat presne 100 zaznamu: `idx=mainId=1..100`, `background=1` pouze jako interni PUBLIC sentinel a 10 indexu v kazdem bloku.
4. Public metadata nesmi obsahovat background variant trait ani vlastni cenu. Cenu bloku vzdy poskytuje sparovana VRF kolekce.
5. Dodat finalni IPFS URI pro konkretni chapter pred jeho aktivaci. Chapter 1 ma prereveal CID `bafybeihn4yqga5yuslc2577qsvoajt2fwdpcsr6oj7fdurivwnlrsi7qzy`; chapters 2-5 zustavaji bez URI, dokud nebudou mit vlastni obrazky.
6. Overit:
   - `metadataConfiguredCount() == 100`
   - `metadataFullyConfigured() == true`
   - `rewardMatrixConsistent() == true`
   - vsechny IPFS URI odpovidaji skutecnym souborum

MAIN metadata zustavaji 550/550. Public je samostatna 100-NFT kolekce a nema background klony. Dokud chybi URI chapteru, `rewardMatrixConsistent=true`, ale `fullyConfigured=false`; takovy chapter se nesmi aktivovat.

### 5. Dokoncit Chainlink VRF

Pouzivane hodnoty:

- Coordinator: `0xec0Ed46f36576541C75739E915ADbCb3DE24bD77`
- Subscription ID: `81201946401186585545741412524989119977867721966007705722641563343499481545614`
- Consumer: `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F`
- Key hash: `0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154d86`

Poradi:

1. Dokoncit transfer subscription ownera na novou admin adresu.
2. Pridat VRF_ROUTER jako consumer.
3. Financovat subscription zvolenym podporovanym tokenem.
4. Overit nenulovy balance, noveho ownera a presne jednoho ocekavaneho consumera.
5. Pred mintem provest jeden kontrolovany VRF request a potvrdit callback/eventy.

### 6. Nasadit CRE receiver jako paused

Receiver se po nove uprave nasazuje automaticky pozastaveny.

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm.cmd run deploy:master:cre-receiver:polygon
npm.cmd run verify:master:cre-receiver:polygon
```

Deploy zapise adresu do `addresses.master.json`, `.env.core.polygon` a `cre-workflows/biggi-cre/my-workflow/config.production.json`. Receiver v teto fazi neodblokovat a jeste mu nepovolovat obecne targety.

### 7. Po schvaleni CRE nasadit workflow, ale neaktivovat provoz

Vsechny CRE prikazy spoustet z teto slozky:

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend\cre-workflows\biggi-cre
cre whoami
cre registry list
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive
cre workflow deploy .\my-workflow --target production-settings
cre workflow get .\my-workflow --target production-settings
cre workflow list --target production-settings --output json
```

`cre whoami` musi ukazat `Deploy Access: Enabled`. Pokud je novy workflow po deployi `ACTIVE`, okamzite ho pozastavit:

```powershell
cre workflow pause .\my-workflow --target production-settings
```

Z `workflow get/list` ziskat skutecne `workflowId` a `ownerAddress`. Tyto hodnoty nastavit lokalne:

```text
CRE_EXPECTED_WORKFLOW_ID=0x...
CRE_EXPECTED_WORKFLOW_OWNER=0x...
```

Potom z backendu zapojit presny allowlist a role:

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm.cmd run wire:master:cre-receiver:polygon
```

Povolene jsou pouze tyto vetve:

1. SupplyController `performUpkeep(bytes)`
2. BuybackUpkeepProxy `performUpkeep(bytes)`
3. LiquidityKeeperProxy `performUpkeep(bytes)`
4. DexReserveGuard `performUpkeep(bytes)`
5. TokenRewardsEmissionController `rollCurrentWeek()`

`DRIP_KEEPER_PROXY` neni CRE target a musi zustat paused. Drip vola BuybackAgent primo po uspesnem nakupu.

### 8. Jednorazova distribuce BIGGI

Nejdriv znovu potvrdit vsechny ctyri prijemce. Potom dry-run:

```powershell
npm.cmd run prepare:initial-distribution:polygon
```

Execution:

```powershell
$env:EXECUTE_INITIAL_DISTRIBUTION="1"
$env:I_UNDERSTAND_INITIAL_DISTRIBUTION_LOCKS_RESERVE="1"
npm.cmd run prepare:initial-distribution:polygon
Remove-Item Env:EXECUTE_INITIAL_DISTRIBUTION
Remove-Item Env:I_UNDERSTAND_INITIAL_DISTRIBUTION_LOCKS_RESERVE
```

Ocekavany jednorazovy vysledek:

- Reserve: 600 000 000 BIGGI
- DripDistributor: 200 000 000 BIGGI
- TokenRewards: 200 000 000 BIGGI
- MarketingSupport: 200 000 000 BIGGI
- total supply: 1 200 000 000 BIGGI
- `distributed=true`
- `reserveLocked=true`

### 9. Pocatecni BIGGI/WPOL likvidita

Pair uz existuje na QuickSwap V2 kompatibilnim routeru, ale ma nulove reserves:

- Pair: `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90`
- Router: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
- WPOL: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`
- BIGGI: `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD`
- LiquidityVault: `0xFe234394845B601B2c671c0dD631fA6290c02bb9`

Finalni hodnoty jsou ulozene v `.env.core.polygon`. Spustit dry-run a fork rehearsal:

```powershell
npm.cmd run prepare:initial-liquidity:polygon
npm.cmd run rehearse:initial-liquidity:fork
npm.cmd run plan:production-activation:polygon
npm.cmd run rehearse:production-activation:fork
```

Kanonicky manifest je `config/production-activation.polygon.json`. Konsolidovany
plan se deli na faze `00-remediation`, `10-liquidity`, `20-tokenomics`,
`30-CRE` a `40-Originals`. Liquidity calldata ma deadline pouze 900 sekund,
proto se musi tesne pred skutecnym krokem znovu vygenerovat.

Faze `00-pre-liquidity-remediation` byla na Polygonu dokoncena 2026-08-25.
`BUYBACK_UPKEEP_PROXY` ma threshold `0.5 POL`, zustava paused, a LiquidityManager
ma pri vypnutem auto top-up ulozeno `5 POL / 5 POL`. Doklad je v
`CORE/FOR_SUPPORT/EVIDENCE/pre-liquidity-remediation-execution-polygon.json`.

Po kontrole execution:

```powershell
$env:EXECUTE_INITIAL_LIQUIDITY="1"
$env:I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE="1"
npm.cmd run prepare:initial-liquidity:polygon
Remove-Item Env:EXECUTE_INITIAL_LIQUIDITY
Remove-Item Env:I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE
```

Pokud je prijemcem primo LiquidityVault, je nutne vedome nastavit `ALLOW_UNSYNCED_VAULT_LP=1`. Realny LP balance bude spravny okamzite, ale interni `lpBalanceOf` se srovna az pri prvnim uspesnem LM pairing cyklu, ktery zavola `syncPairBalance(pair)`. Pred public launchem proto provest kontrolovany LM cyklus a potvrdit `accounted == realBal`.

Presny postup a recovery pravidla jsou v `TOKENOMICMAINNET/INITIAL_LIQUIDITY_RUNBOOK_CS.md`.

### 10. Aktivovat tokenomiku, receiver a CRE

Az po distribuci, likvidite, VRF a metadata gate:

```powershell
$env:ENABLE_LIQUIDITY_ORCHESTRATOR="1"
$env:ENABLE_LIQUIDITY_KEEPER="1"
$env:ENABLE_DRIP_KEEPER="0"
$env:ENABLE_BUYBACK_UPKEEP="1"
$env:ENABLE_AUTO_BUYBACK="1"
$env:ENABLE_LM_AUTO_TOPUP="0"
$env:BUYBACK_MIN_NATIVE_WEI="500000000000000000"
npm.cmd run activate:tokenomics:polygon
```

Zkontrolovat dry-run report a ve stejnem PowerShell okne teprve povolit execution:

```powershell
$env:EXECUTE_TOKENOMICS_ACTIVATION="1"
$env:I_UNDERSTAND_KEEPERS_GO_LIVE="1"
npm.cmd run activate:tokenomics:polygon
```

Tento krok take snapshotuje baseline SupplyControlleru a DexReserveGuardu. Skript hard-blockuje pokus o zapnuti Drip keeperu a dust-level buyback threshold. Kanonicky threshold `0.5 POL` byl nastaven uz v bezpecne paused fazi 00 a pred unpause se znovu overi.

Potom aktivovat on-chain CRE receiver:

```powershell
npm.cmd run activate:master:cre-receiver:polygon
```

Aktivacni skript receiveru odmitne unpause bez workflow identity, peti selectoru a vsech cilovych roli.

Nakonec aktivovat private-registry workflow:

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend\cre-workflows\biggi-cre
cre workflow activate .\my-workflow --target production-settings
cre workflow get .\my-workflow --target production-settings
```

Private registry aktivace pouziva CRE login a nevyzaduje Ethereum registry gas. Polygon state writes provadi CRE pres KeystoneForwarder a receiver.

### 11. Finalni gate a otevreni mintu

1. Overit, ze neexistuje soubezna stara Chainlink Automation/Gelato registrace pro stejne vetve.
2. Spustit:

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm.cmd run audit:ownership:polygon
npm.cmd run check:master:core:polygon
npm.cmd run preflight:launch:polygon
npm.cmd run manifest:deployment:polygon
```

3. `preflight:launch:polygon` musi vratit `okForPublicLaunch=true`, `blockers=0` a `warnings=0`.
4. Teprve potom aktivovat pripraveny chapter pres `TicketHub.setChapterActive(chapterId, true)`; chapters 2-5 zustanou neaktivni, dokud nemaji vlastni metadata a launch gate.
5. Preflight zopakovat po odblokovani.
6. Provest jeden maly end-to-end mainnet smoke test:
   - overit, ze marketing alokace ma snapshot `1 POL` a paid mint ji nezahrnuje do cenove krivky
   - nastavit a read-only overit public start `500 POL`
   - nakup prvniho paid ticketu za `500 POL` (Chapter 1 token ID 51)
   - kontrola navyseni dalsi paid ceny o `+0.33 %`
   - kontrola 60/40 splitu a distributor vetvi
   - redeem pres VRF a callback
   - zobrazeni NFT a metadat ve frontend galerii
   - kontrola CRE logu a `ReportForwarded` eventu
7. Po smoke testu zkontrolovat treasury, reserve buckety, rewards, DEX reserves, LP vault real/accounted balance a frontend readery.

## Stop podminky

Deploy nebo launch se okamzite zastavi, pokud:

- signer neni ocekavany owner;
- nektera adresa ukazuje na zero nebo na kompromitovanou EOA;
- dry-run planuje neocekavanou transakci;
- CRE workflow je active drive, nez jsou hotove role a receiver identity;
- VRF nema consumer nebo zustatek;
- pair nema oba nenulove reserves;
- MAIN nebo MAIN2 metadata consistency neni plna;
- finalni preflight nema nula blockeru.
