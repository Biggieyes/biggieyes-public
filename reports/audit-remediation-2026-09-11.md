# BiggiEyes: opravy po JS / React / blockchain auditu

Navazuje na [puvodni audit](javascript-react-blockchain-audit-2026-09-11.md).
Audit zustava zaznamem stavu pred opravami; tento dokument popisuje naslednou
opravnou etapu na zaklade dodatku zadani `pak vse oprav`.

Nasledna etapa: [wallet lifecycle a doplnujici regrese](wallet-lifecycle-2026-09-11.md).
Odhalila dalsi hrany v potvrzovani mintu, zmene uctu/site a obnoveni VRF;
nize uvedene vysledky 371 testu zaznamenavaji prvni etapu, nikoli konecne E2E.

## Rozsah

- Opravy potvrzenych nalezu F01-F10 v aktivnim root frontendu a lokalnim manifestu.
- Bez Netlify deploye, podpisu, mainnet transakci, zmen roli nebo RPC secrets.
- Bez zmen Solidity, ABI, tokenove emise, cenovych procent, NFT metadat nebo supply.
- Existujici rozpracovane zmeny V2, moderatoru, galerie a public kolekce zachovany.
- `public-repo` nebyl plosne prepsan. Kontrola jeho adres/ABI prochazi, ale
  publikovani jeho samostatneho historickeho runtime vyzaduje vlastni synchronizaci.

## Opravene nalezy

| Nalez | Provedena oprava | Dotcene soubory | Regrese |
| --- | --- | --- | --- |
| F01, P1 | Wallet send se provede jen jednou. Ani 429/timeout nevyvola dalsi podani. Potvrzeni vyzaduje uspesny receipt; repricing neni zamenen za zruseni. | `src/shared/utils/writeRetry.js`, `src/app/AppCore.jsx`, obe developer guide | `writeRetry.test.js`: jedno podani, RPC chyby, zamitnuti, receipt, repricing/cancel/replacement |
| F02, P1 | Pending VRF nese chain 137, ucet, kanonickou kapitolu/MAIN, ticket a request ID. Ulozeni do localStorage umoznuje obnoveni. Poll i manualni retry pouzivaji spravnou kapitolu. Nulovy pending, spaleni ticketu ani jiny NFT mint nejsou samy o sobe dukazem fulfillmentu. | `src/shared/utils/pendingVrf.js`, `src/app/AppCore.jsx` | `pendingVrf.test.js`: vsech 5 kapitol, reload, podvrzeny kontext, RPC chyba, retry receipt, stejna fulfillment transakce, emergency, vychozi blok |
| F03, P2 | Generation/session guard vyradi pozdni refresh a obnovu wallet po disconnect nebo novem pripojeni. Cleanup odstranuje konkretni listenery. | `src/providers/Web3Provider.jsx` | `Web3Provider.reconnect.test.jsx`: disconnect behem getSigner a starsi ucet po novem |
| F04, P2 | Collection reward data patri kombinaci provider/kontrakt/ucet/kolekce. Zastarala odpoved ani jeji chyba nesmi prepsat aktualni stav. | `src/hooks/useCollectionRewards.js` | `collectionRewardsHookConsistency.test.jsx`: zmena wallet, kolekce, failed refresh |
| F05, P2 | Selhani povinnych cteni vraci error/unknown, nikoli uspesne nuly. Neoverene collection claims jsou zakazane; gas preflight nelze ignorovat. Token claim vyzaduje dostupny preview. Community onchain data zustanou citelna pri izolovanem vypadku anket; pocty anket jsou v takovem pripade nezname. | `collectionRewardsService.js`, `useTokenRewards.js`, `useCommunityCenterUserSnapshot.js`, `REWARDSPanel.jsx`, `COLLECTIONREWARDSSection.jsx`, `COMMUNITYCENTERPanel.jsx`, `USERPANEL.jsx`, `AppCore.jsx` | `collectionRewardsService.test.js`, `rewardReadErrors.test.jsx`, `rewardsPanelMainnetConsistency.test.jsx` |
| F06, P2 | Zmena polling zdroje invaliduje predchozi generaci i stary in-flight lock. Novy request muze zacit ihned; stara odpoved nesmi zapisovat do nove cache. | `src/hooks/tokenomics/_usePollingSnapshot.js` | `pollingSnapshotConsistency.test.jsx`: resolve/reject stareho zdroje, spravna cache a loading |
| F07, P2 | Liquidity reader pouziva ethers v6 `target`, nikoli neexistujici v5 `address`. Helper a diagnostika wiring se skutecne ctou. | `src/shared/services/tokenomics/liquidity.reader.js` | `liquidityReaderV6.test.js`: skutecne ethers v6 Contract instance s mockovanym read runnerem |
| F08, P2 | Token claim callback vraci confirmed/cancelled/failed; panel nehlasi uspech po zruseni nebo no-op. Chyba navazne obnovy dat nezmeni potvrzenou transakci na neuspesnou. | `src/app/AppCore.jsx`, `src/features/rewards/REWARDSPanel.jsx` | `auditCallbackIntegration.test.js` spousti skutecne telo callbacku; `writeRetry.test.js` overuje receipt |
| F09, P2 | Zastaraly alias NFT_REWARDS_CONTRACT v backend manifestu sjednocen s existujicim kanonickym NFT Rewards V2 deploymentem. | `biggi-project/bekend/addresses.json` | `node scripts/check-contracts.js`: 170 adres v kazdem frontendu, 5 kapitol, 8 CORE ABI |
| F10, P2 | Memoizovany collection panel se obnovi take pri zmene blockPrices, blockMintCounts a autoOpenInfoPanel. | `src/app/AppCore.jsx` | `auditCallbackIntegration.test.js`: AST invariant skutecnych dependencies; nejde o wallet E2E test ceny |

Cesty v tabulce se vztahuji k aktivnimu `src/`; uplne puvodni lokace a radky
jsou uvedene u jednotlivych nalezu v puvodnim auditu. Cisla radku se opravami posunula.

## Preventivni hrany

- R1: `multicall.js` kontroluje i `null` z ethers v6 Interface.getFunction.
  Test `multicallSnapshot.test.js` pouziva skutecny Interface.
- R2: polling sanitizer zachovava boolean `false`/`true`, nemeni je na pravdive retezce.
- R3: preload manager ma cisty konstruktor a explicitni start/stop/reset.
  Bootstrap uklizi RAF, window load listener i timeouty a toleruje StrictMode replay.
  Test `preloadManagerLifecycle.test.js`; doplnena cleanup logika v `src/app/main.jsx`.
- R4: pred `.every()` nad parent block stats se overuje ocekavana delka poli.
  Prazdne pole tak neni vydavano za kompletni sadu cen.
- R5: pridany cileny regresni testy se skutecnym ethers v6 Interface/Contract.
  Zadna plosna TypeScript migrace nebo nova runtime knihovna.

## Dulezite zmeny chovani

Nejde jen o kosmeticky refaktor:

1. Mint/redeem/claim: odstraneni automatickeho opakovani odeslani. Po nejasnem
   vysledku je nutne zkontrolovat MetaMask Activity a puvodni transakci.
2. VRF: zmena identity cteni a cile explicitniho retry. Dalsi redeem ceka na
   overeni predchoziho vysledku; RPC outage nemuze predstirat dokonceny mint.
3. Odmeny: claim pri neoverene zpusobilosti/budgetu nebo failed preflight je blokovan.
   Naroky, vyse odmen a budgetove prahy kontraktu zustaly beze zmen.
4. Callback token claimu ma explicitni vysledek. Pouhy hash neni confirmed.
5. Manifest alias smeruje na stavajici V2; nic se nenasazovalo a zadne role se nemenily.

Barva pozadi nadale ovlivnuje stejnou barvu oci/bloku podle stavajici mechaniky.
Oprava F10 meni pouze aktualnost props/zobrazeni, ne vypocet cen.

## Overeni

Prikazy byly posouzeny pred spustenim. Nebyl spusten depcheck, audit fix,
instalace/upgrady balicku ani prepis lockfile. Formatovani dotcenych souboru
pouzilo jiz nainstalovany Prettier z VS Code extension, nikoli novou zavislost.

| Kontrola | Stav | Vysledek / omezeni |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | PASS | Finalni beh: 76 sad, 371 testu, 139.76 s. Mockovane RPC/wallet, nikoli realne mainnet transakce. |
| Lokalni backend prikaz nize | PASS | 121 testu. Lokalni Hardhat, bez forku a bez cerstve kompilace; existujici artefakty. |
| `npm run typecheck` | PASS | Stejny omezeny rozsah 8 TS/TSX souboru; nikoli typova verifikace vsech JS. |
| ESLint API `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])` bez fixu | PASS | 481 souboru, 0 errors, 137 warnings; pred opravami 139 warnings. |
| `node scripts/check-contracts.js` | PASS | Alias rozpor odstranen, oba frontend manifesty a backend souhlasi. |
| `node scripts/check-abis.js` | PASS | 479 souboru, 61 ABI, 848 funkci. Heuristika, nikoli semanticky dukaz kazdeho callu. |
| `node scripts/check-secrets.mjs` | PASS | Zadny credential-like nalez ve sledovanych/pending souborech. Neni uplnym auditem produkcnich secrets. |
| `npm run build` | PASS | Finalni build: 4380 modulu, 50.63 s, 9 inline-script CSP hashu. Vystup pouze v lokalnim `dist/`. |
| `node scripts/smoke-runtime.mjs` | PASS | Opakovano nad finalnim buildem. Desktop 1440x900 + mobil 390x844: galerie, LiveStats, Rewards, kontrola horizontalniho preteceni. Preview po testu ukoncen. |
| `git diff --check` na dotcenych zdrojich | PASS | Zadna nova whitespace chyba. |
| Trvaly lokalni dev server | BLOCKED | Prostredi odmitlo Start-Process. Ephemeral Vite preview pri smoke funguje a ukoncuje se. |
| Netlify deploy / mainnet wallet E2E / role changes / CRE deploy | SKIPPED | Nebyly pozadovany v teto opravne etape ani provedeny. |

Backend prikaz s procesnim `FORK_URL=''`, `FORK_BLOCK_NUMBER=''`,
`CRE_AUTOMATION_REPORT_PATH=''`, cwd `biggi-project/bekend`:

```text
node node_modules/hardhat/internal/cli/cli.js test --config hardhat.biggi-master.cjs --network hardhat --no-compile
```

## Co tento vysledek nedokazuje

- Neni to formalni bezpecnostni audit smart kontraktu ani garance bezchybnosti.
- Skutecny wallet E2E mint -> redeem -> VRF fulfillment -> NFT a zmena site v
  MetaMask nebyly na mainnetu vykonany. Cileny JS testy a lokalni backend testy
  tento nasazeny provoz nenahrazuji.
- A2/A3 z auditu (paralelizace liquidity cteni a lazy nacitani neaktivnich reward
  tabu) zustavaji samostatnou vykonnostni etapou vyzadujici profilovani. Nebyla
  plosne zvysena RPC soubeznost ani zavedena nova cache s jinou cerstvosti dat.
- Zbyvajicich 137 lint warnings neni automaticky 137 runtime chyb. Nebyly slepe
  vypnute lint checks ani prepsany hooks jen kvuli sjednoceni stylu.
- Po opravach se netvrdi procentni zrychleni. Runtime smoke kontroluje funkcnost,
  ne produkcni vykon pod zatezi. Puvodni omezeny performance vzorek zustava v auditu.

## Dalsi poradi

1. Wallet E2E na izolovane testovaci fixture: zamitnuti, repricing/cancel,
   zmena uctu/site, chapter 2-5 redeem/fulfillment, reconnect behem cekani.
2. Pred releasem zkontrolovat aktualni produkcni konfiguraci a pripadnou
   synchronizaci samostatneho public-repo runtime. Nasazovat az po schvaleni.
3. Samostatne merit A2/A3 a teprve podle dat upravit RPC nacitani; nakonec kosmetika.
