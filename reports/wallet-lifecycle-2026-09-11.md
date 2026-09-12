# BiggiEyes: navazujici overeni wallet / transakcniho lifecycle

Navazuje na [audit](javascript-react-blockchain-audit-2026-09-11.md) a
[prvni opravy](audit-remediation-2026-09-11.md). Datum: 2026-09-11.

## Zaver a rozsah

Hlubsi regresni testy odhalily dalsi hrany v puvodnich nalezech F01/F02/F03/F08.
Prvni opravnou etapu proto nelze povazovat za dukaz uplne konzistence vsech
wallet toku. Nize uvedene reprodukovane pripady byly opraveny lokalne.

- Aktivni root frontend, bez zmen vzhledu, CSS, metadat, cen, supply a odmen.
- Zadne upravy Solidity, ABI, adres, secrets, balicku nebo lockfile v teto etape.
- Zadne podpisy, mainnet transakce, approvals, role changes ani Netlify deployment.
- Existujici pracovni strom zustal zachovan; nevznikl commit ani push.
- Document Control byl vyhledan a zavolan pres `list_document_sessions`.
  Nebyl pripojen zadny dokument; zadny externi dokument se nemenil.

## Potvrzene nalezy a provedene opravy

### W01: Zmena podepisujiciho kontextu behem preflightu

- Priorita P1, vysoka jistota; prokazano negativnimi regresnimi testy.
- Misto: `src/app/AppCore.jsx:7871`, `:8310`, `:8619`, `:8845`;
  `mintTicket`, `redeemTicket`, `retryPendingMint`, `claimREWARDS`.
- Problem: po asynchronnim vypoctu fee mohl nasledovat zapis s jinym uctem
  nebo siti, nez pro ktere byla akce pripravena. Retry jiz mel kontrolu signer
  adresy, ale nikoli aktualni site. Read-only Polygon provider neoveruje sit wallet.
- Dopad: nespravny ucet u mintu, zbytecny nebo chybne pripraveny podpis/revert;
  nebyla prokazana ztrata prostredku na mainnetu.
- Minimalni oprava: `src/shared/utils/writeRetry.js:7`, `assertWriteContext`.
  Overuje aktualni UI ucet, adresu signeru, primo `eth_accounts` a `eth_chainId`
  z jeho wallet providera a po await znovu platnost UI uctu. Neznamy kontext
  zapis nepovoli. Vsechny ctyri akce navic explicitne predavaji `chainId: 137`.
- Proc nestaci `getNetwork()`: skutecny ethers 6.17 BrowserProvider s `any`
  muze pri detekci zmeny vratit jeste predchozi Network. Overeno testem a lokalnim
  `node_modules/ethers/lib.esm/providers/abstract-provider.js:596`.
- Zmena chovani: ano, zmena/odpojeni/neoveritelny stav blokuje pripraveny zapis.
  Bez zmen metod ABI, cen, naroku nebo financnich prijemcu. Dva dodatecne lokalni
  wallet RPC dotazy na akci; zadne pridane periodicke polling pozadavky.
- Regrese: `appWriteLifecycle.test.js` a `writeContext.test.js`, vcetne zmeny
  uctu pred dorucenim UI eventu a serializace chain ID do `0x89` pres ethers.

### W02: Ticket mint nepouzival spolecne potvrzeni transakce

- Priorita P2, vysoka jistota, reprodukovano.
- Misto: `src/app/AppCore.jsx:7893`, `mintTicket`; stejny hash problem pri retry
  v `src/shared/utils/pendingVrf.js:87`, `pendingVrfFromReceipt`.
- Problem: `tx.wait()` po uspesnem zvyseni gasu vyhodil TRANSACTION_REPLACED,
  coz UI oznacilo jako neuspech. V ulozenem VRF kontextu zustaval puvodni hash.
- Dopad: chybna zprava o vysledku a odkaz na nahrazenou transakci; mozny zmatek
  pri naslednem rucnim pokusu uzivatele.
- Oprava: i mint pouziva `waitForWriteReceipt`; potvrzeni vyzaduje status 1.
  U repricing se pouzije skutecny receipt/hash, cancellation neni uspech.
  VRF kontext si uklada hash potvrzeneho receipt.
- Zmena chovani: pouze spravne vyhodnoceni potvrzeni, bez dalsiho odeslani
  a bez zmeny mintovani nebo nahodnosti.
- Regrese: chybejici receipt, status 0, zrusena replacement, repricing mintu
  a retry chapter 2-5; vsechny write callbacks zachovavaji jedno odeslani.

### W03: Pozdni vysledek stare wallet zasahoval do noveho stavu

- Priorita P2, vysoka jistota, reprodukovano.
- Misto: `src/app/AppCore.jsx:2010`, `rememberPendingVrf`; `:8390`, redeem catch;
  `:7902`, navaznost mint/referral; `:8880`, navaznost token claim refresh.
- Problem: potvrzeni po disconnect neaktualizovalo ulozeny request ID; zamitnuti
  stareho redeemu mohlo nastavit VRFPending=false u nove wallet. Claim obnovoval
  prehled stare wallet a mint mohl otevrit navaznou referral akci po zmene uctu.
- Dopad: chybne cekani/prehled nove wallet, horsi obnova VRF a nevhodny dalsi podpis.
- Oprava: potvrzeny kontext se uchova pod puvodnim uctem i po odpojeni, ale
  neprepise aktualni in-memory kontext jine wallet. Catch a odlozene refresh akce
  respektuji aktualni ucet. Potvrzeny claim stale vraci confirmed, ale nespousti
  refresh pro stary ucet. Revert cisti pouze puvodni ulozeny request.
- Zmena chovani/toku dat: ano, oddeleni vysledku mezi ucty; bez zmen reward
  naroku, referral pravidel nebo VRF smart kontraktu.
- Regrese: obnova vsech peti kapitol po disconnect, presny request a stejna
  fulfillment transakce, pozdni rejection, revert pri prepnuti a puvodni claim.

### W04: Mobilni smoke cekal na obsah pred aktivaci lazy sekce

- Priorita P3, vysoka jistota; chyba overovaciho skriptu, nikoli zmena layoutu.
- Misto: `scripts/smoke-runtime.mjs:137`, mobilni scenar u cekani na galerii;
  souvisejici `src/components/layout/MainLayout.jsx:238`, `DeferredSection`.
- Problem: test cekal na `.gallery-section` pred scrollem, ale obsah se montuje
  az pri priblizeni k existujicimu `#gallery`. Pri vyssim obsahu nad galerii skoncil
  timeoutem 60 s. Desktop v tomto behu prosel.
- Oprava: desktop i mobil nejprve scrolluji stabilni host `#gallery` a teprve
  potom cekaji na obsah. Timeout se nezvysoval a chyba se neignoruje.
- Dopad opravy: pouze realne poradi testovaneho uzivatelskeho postupu; aplikace,
  lazy loading, CSS i vizual zustaly beze zmen. Opakovany smoke prosel.

## Hranice testu

- `appWriteLifecycle.test.js` spousti skutecna tela AppCore callbacku vybrana
  pres Babel AST. Mockuje jejich okoli a RPC. Neni to render cele aplikace.
- `writeContext.test.js` pouziva skutecne instalovane ethers BrowserProvider,
  Contract a JsonRpcSigner nad izolovanou EIP-1193 fixture. Nic se nepodepisuje.
- `Web3Provider.reconnect.test.jsx` montuje React provider; doplnena pozdni zmena
  site, stary WalletConnect restore a cleanup listeneru pri StrictMode replay.
- Playwright smoke testuje skutecny build na desktopu 1440x900 a mobilnim viewportu
  390x844, galerii, LiveStats, Rewards a horizontalni overflow. Bez realne MetaMask.
- To nenahrazuje mainnet E2E, fyzicke zarizeni ani formalni audit smart kontraktu.

## Verifikace

Pred opravou nove testy skutecne selhavaly: prvni callback sada 14 z 15,
nasledne 3 z 6 testu se skutecnym BrowserProvider a 6 dalsich callback regresi.
Nejde pouze o testy napsane az proti uz opravene implementaci.

| Kontrola / prikaz | Stav | Skutecny vysledek a omezeni |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | PASS | Finalni beh po vsech zdrojovych zmenach: 78 sad, 414 testu, 207.33 s. O 43 testu vice nez po prvni etape. Predchozi mezibeh mel 409 testu. |
| `npm run build` | PASS | Finalni build: 4380 modulu, 58.07 s, 9 CSP hashu, lokalni `dist/`. |
| `npm run typecheck` | PASS | Opakovano po posledni zmene; stale omezeno na TS konfiguraci projektu, nikoli vsechny JS soubory. |
| ESLint API `lintFiles(['src/**/*.{js,jsx,ts,tsx}'])`, `fix: false` | PASS | 481 souboru, 0 errors, 137 warnings. Po konecnem doplneni chain ID znovu overeny 3 dotcene zdroje: 0 errors, 13 stavajicich warnings v teto podmnozine. |
| `node scripts/check-contracts.js` | PASS | 170 adres v kazdem frontendu, 5 kapitol a 8 CORE ABI souhlasi s backendem. Nejde o cteni mainnet stavu. |
| `node scripts/check-secrets.mjs` | PASS | Opakovano vcetne novych reportu; zadny credential-like nalez. Neoveruje hodnoty produkcnich secrets. |
| `node scripts/smoke-runtime.mjs`, prvni beh | FAIL | Desktop prosel, mobil cekal 60 s na jeste nemontovanou galerii. Viz W04. |
| `node scripts/smoke-runtime.mjs`, finalni beh | PASS | Po oprave testoveho scrollu prosel desktop i mobil nad finalnim buildem; preview i Chromium se ukoncily. Vystup URL byl pred vypsanim sanitizovan. |
| `git diff --check --` s vyctem dotcenych souboru | PASS | Bez whitespace chyb v diffu; nove testy take formatovany existujicim Prettier. |
| Lokalni backend testy | SKIPPED | V teto etape zadna zmena backendu/kontraktu. Predchozi beh 121 testu je zaznamenan v prvni opravne zprave, zde se neopakoval. |
| Document Control `list_document_sessions` / uprava dokumentu | BLOCKED | Konektor funguje, ale seznam pripojenych dokumentu byl prazdny. Audit je ulozen v repozitari. |
| Mainnet E2E, Netlify/CRE deploy, produkcni env | SKIPPED | Nic z toho tato lokalni opravna etapa neprovadela. |

Nebyly instalovany ani aktualizovany balicky. Formatovani pouzilo jiz dostupny
Prettier z VS Code extension. CSS a ostatni rozpracovane zmeny zustaly zachovany.

## Dalsi postup

1. Izolovane browser E2E s plnym AppCore a wallet adapterem: podpis, receipts,
   eventy a zmena site/uctu. Dosavadni callback a provider testy nejsou jeho nahrada.
2. Pred schvalenym releasem samostatne overit produkcni konfiguraci; nevydavat
   lokalni build za nasazeny. Historicky public-repo runtime nebyl synchronizovan.
3. Merit vykonnostni A2/A3 z puvodniho auditu. Zadna prokazana procenta zrychleni,
   pridana cache nebo plosne zvyseni soubeznosti RPC v teto etape.
