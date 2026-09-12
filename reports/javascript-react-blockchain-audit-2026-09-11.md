# BiggiEyes: audit JavaScriptu, Reactu a blockchainove integrace

Datum: 2026-09-11. Pracovni kopie: `C:/dev/BIGGINFTWEB`.
Rezim: pouze audit. Zadne opravy aplikace, zmeny adres, ABI, zavislosti,
lockfilu, metadat, opravneni nebo deploymenty. Novym dokumentem je tento report.
Lokalne vznikl povoleny vystup produkcniho buildu v ignorovanem `dist/`.

## 1. Strucny zaver

Build, frontendove testy (328), lokalni kontraktove testy (121), omezeny
TypeScript check a desktop/mobile smoke prosly. NFT Rewards V2 ma v aktualnim
kodu podstatne lepsi ochrany konzistence nez nektere starsi casti aplikace:
kontrolu uctu a site, identitu nacitaneho kontextu a snapshot na jednom bloku.

Projekt ale nelze oznacit za plne konzistentni. Audit nasel 10 potvrzenych
problemovych mist. Nejdrazsi rizika jsou automaticke opakovani odeslani zapisu
po RPC chybe a pouzivani kontraktu Originals pri sledovani/retry VRF dalsich
kapitol. Dalsi reprodukovane chyby umoznuji navrat stareho uctu po odpojeni,
prepsani novych dat starsi odpovedi a zobrazeni vypadku RPC jako platnych dat.
Kontrola konfigurace navic pada na aliasu `NFT_REWARDS_CONTRACT`, ktery zustal V1.

Nebyla prokazana ztrata prostredku, neopravneny claim ani duplicitni mainnet
transakce. Neprobihaly skutecne podpisy, mainnet zapisy, CRE deployment ani
kontrola soucasnych produkcnich secrets. Toto neni formalni bezpecnostni audit
Solidity, potvrzeni dostupnosti vsech RPC ani garance provozu automatizace.

## 2. Prehled kontrolovanych postupu

Stavy popisuji konkretne proverene cesty, ne kazdy mozny radek repozitare.
F01 az F10 odkazuji na nalezy v nasledujici sekci.

| Skupina | Stav | Konkretni dukaz nebo omezeni |
| --- | --- | --- |
| `fetch`, HTTP status a JSON | POUŽITO SPRÁVNĚ | `src/shared/services/communityVotingApi.js:80`: timeout, kontrola `response.ok`, nasledna kontrola odpovedi; fallback trasy jen pro prislusne HTTP chyby. |
| `Promise`, `async`, `await`, `then` | POUŽITO S PROBLÉMEM | Awaitovane operace prepisuji neaktualni kontext ve F03, F04, F06. Samotne pouziti `await` tuto ochranu nezajistuje. |
| `try`, `catch`, `throw`, propagace chyb | POUŽITO S PROBLÉMEM | F05 maskuje chyby jako data, F08 jako uspesne podani claimu. NFT V2 a community HTTP API naopak chyby predavaji. |
| `finally`, ukonceni loading | POUŽITO S PROBLÉMEM | Vetsina cest ma `finally`; u F04 a F06 jej vsak muze dokoncit stary pozadavek nad novejsim kontextem. |
| Callbacky a smlouva navratove hodnoty | POUŽITO S PROBLÉMEM | `REWARDSPanel.handleClaim` predpoklada, ze uspesne splneny Promise znamena odeslanou transakci; F08. |
| `Promise.all` | POUŽITO S PROBLÉMEM | Vhodne pro souvisejici NFT V2 snapshot; v Collection Rewards vnitrni `safeRead` skryje i uplny vypadek, F05. Liquidity ma zbytecne sekvencni nezavisle skupiny, A2. |
| `Promise.allSettled` | POUŽITO SPRÁVNĚ | `AppCore.jsx:5119` a `Gallery.jsx:1224`: oddelitelne skupiny assetu/chunky. Nenavrhuji jim nahrazovat atomicke preflighty zapisu. |
| Timeout a `AbortController` | POUŽITO SPRÁVNĚ | Community HTTP a IPFS maji timeout/cleanup; `rpcConfig.js:46` ma omezeny RPC probe. Ethers odpovedi je nutne navic odlisit generaci pozadavku. |
| Retry a backoff | POUŽITO S PROBLÉMEM | Read-only retry ma smysl; spolecny retry zapisovych akci v F01 ho nema bez rozliseni stavu odeslani. |
| Komponenty, JSX, props, state | POUŽITO S PROBLÉMEM | Zakladni render a navigace prosly smoke; F04, F05 a F10 narusuji zobrazovana data. |
| Event handlers, conditional rendering | POUŽITO S PROBLÉMEM | F05 povoluje claim pri neznamem stavu; F08 chybne vypise uspech. Nejde o obecny problem JSX. |
| Stabilni `key` | POUŽITO SPRÁVNĚ | Galerie pouziva identitu assetu; NFT Rewards radky `rewardId`/`eventId`, kapitoly `chapterId`. Nebyl potvrzen konflikt klicu v techto cestach. |
| `useState` | POUŽITO S PROBLÉMEM | Ukladani samo je korektni, ale nehlidane asynchronni aktualizace ve F03, F04, F06 prepisuji aktualni stav. |
| `useEffect` a dependencies | POUŽITO S PROBLÉMEM | Existuje cleanup listeneru a casovacu, ale chybi ruseni platnosti rozbehnutych odpovedi ve F03/F04/F06; 46 lint varovani vyzaduje individualni posouzeni. |
| `useRef` | POUŽITO S PROBLÉMEM | NFT V2 pouziva generaci pozadavku a public mint zamykani; sdileny `inFlightRef` v F06 sam nestaci pri zmene zdroje. |
| `useMemo` | POUŽITO S PROBLÉMEM | F10: memoizovany panel nepocita se zmenou cen a poctu mintu. Nejde o duvod pridavat dalsi memoizaci plosne. |
| `useCallback` | POUŽITO S PROBLÉMEM | Stabilni callback muze stale dokoncit praci nad starym kontextem, F03/F04/F06. Zavislosti nejsou nahrada za request guard. |
| `useContext` | POUŽITO SPRÁVNĚ | Aktivni providery sdileji wallet a kontrakty. Spravnost hodnot Web3 contextu ma samostatnou chybu F03. Dalsi deleni contextu vyzaduje profil. |
| `useReducer` | NEPOUŽITO A NENÍ POTŘEBA | V aplikačních volanich nenalezen; reexport v shim souborech neni pouziti. Jeho absence neni chyba. |
| Custom hooks | POUŽITO S PROBLÉMEM | Dobre ochrany `useNFTRewards`; slabsí `useCollectionRewards` a `_usePollingSnapshot`, F04/F06. |
| StrictMode, side effects behem renderu | DOPORUČENO ZVÁŽIT | Bootstrap zaklada RAF manager uz behem renderu. Neprokazany lifecycle problem R3; StrictMode nevypinat jako opravu. |
| `map`, `filter` | POUŽITO SPRÁVNĚ | Galerie a NFT Rewards vytvareji odvozene seznamy; omezeny paralelismus NFT V2 neprovadi nekontrolovane stovky soucasnych volani. |
| `find` | POUŽITO SPRÁVNĚ | `useNFTRewards.js:97` pracuje s volitelnym nalezenym eventem; Gallery normalizace ma fallback. |
| `reduce` | POUŽITO SPRÁVNĚ | `Gallery.jsx:1562` a nasledujici agregace maji pocatecni hodnotu. Nebyl potvrzen pad nad prazdnym polem v kontrolovanych agregacich. |
| `some`, `includes` | POUŽITO SPRÁVNĚ | Gallery rozlisuje ticket/metadata a dovolene rarity. Nejsou nahrazkou onchain overeni vlastnictvi. |
| `every`, prazdne kolekce | DOPORUČENO ZVÁŽIT | LiveStats kontroluje delku pred `every`. `CollectionBlocksGrid.jsx:525` nekontroluje plnou delku obou poli pri reuse; bezny rodic je predava plna, ale chybi okrajovy test R4. |
| `forEach` | POUŽITO SPRÁVNĚ | V proverovanem `src` nebyl nalezen `async` callback ve `forEach` pouzity jako cekana davka. Iterace listeneru v preload manageru je synchronni. |
| `sort` a mutace | POUŽITO SPRÁVNĚ | NFT Rewards radi kopie `[...]`; Gallery radi nove odvozene seznamy. Nebyla potvrzena mutace rodicovskeho state temito sorty. |
| `toSorted` | NEPOUŽITO A NENÍ POTŘEBA | Kopie plus `sort` funguji. TS target ES2022 ani browserslist samy nejsou duvod vyzadovat novejsi nativni metodu. |
| Provider, signer, contract instance | POUŽITO S PROBLÉMEM | F03 obnova stareho signera; F07 ethers v6 instance nema pouzivane `.address`. |
| ABI, adresy a chain ID | POUŽITO S PROBLÉMEM | Konfigurace runtime cili na Polygon 137; ABI heuristika prosla; alias V1/V2 nesedi, F09. |
| Cteni vs. podpis a zapis | POUŽITO S PROBLÉMEM | Read-only providery jsou oddelene, public mint/NFT V2 delaji kontroly; F01 a F03 ohrozuji konzistenci zapisove cesty. |
| Listenery a subscriptions | POUŽITO SPRÁVNĚ | `Web3Provider.jsx:348` odpojuje konkretni predane handlery. Nenavrhuji globalni `removeAllListeners`. |
| Potvrzeni a stavy transakce | POUŽITO S PROBLÉMEM | Public mint a NFT V2 cekaji receipt; F02 zamenuje prazdny pending jine kolekce za fulfillment, F08 zamenuje callback za odeslani. |
| `BigInt`, decimals, prevody jednotek | POUŽITO SPRÁVNĚ | Public mint odesila aktualni raw cenu; NFT V2 a CRE pouzivaji celociselne hodnoty. `Number` pro formatovany nahled neni stejne jako `Number` pro `value`. |
| Mint, redeem/burn, VRF, NFT | POUŽITO S PROBLÉMEM | Lokalni kontraktovy lifecycle prosel; frontendova navaznost dalsich kapitol ma F02. |
| Vlastnictvi a claim | POUŽITO S PROBLÉMEM | NFT V2 revaliduje ucet, sit a prijemce; Collection UI ma stare/neoverene udaje ve F04/F05. Neprokazuje to moznost obejit onchain opravneni. |
| Cache, polling, invalidace po zapisu | POUŽITO S PROBLÉMEM | NFT V2 ma klic kontextu a aktualizaci po potvrzeni; sdileny polling ma F06. Nektere starsi cesty zbytecne duplikuji refresh. |
| Multicall a batching | POUŽITO S PROBLÉMEM | Podpora snapshot blockTag a RPC batch kontrol je pritomna; Liquidity vynechava readery F07; detekce chybejici ABI funkce ma latentni problem R1. |
| Kruhy importu / nepouzity kod | NEOVĚŘENO | V zmapovanem grafu 223 dosazitelnych modulu nebyl kruh. Neni to dukaz absence kruhu ci mrtveho kodu v celem monorepu. |
| Serverova tajemstvi v klientu | NEOVĚŘENO | Guard a zdrojovy scan prosly, nalezy v bundlu byly false positive. Uplna shoda se skutecnymi Netlify secrets nebyla overovana. |
| CRE a financni automatizace | NEOVĚŘENO | Staticky tok a oba TS checky prosly; realny DON deployment, opravneni, funding, reorgy a provedeni upkeepu nebyly testovany. |

## 3. Potvrzene nalezy

Priorita P1: opravit pred dalsim ostrym pouzivanim dotceneho toku.
Priorita P2: konkretni chyba konzistence/spolehlivosti, neni sama dukazem exploitu.
Jistota se tyka popsane chyby; skutecny financni dopad je zvlast podminen.

### F01 - P1: automaticke opakovani odeslani zapisove transakce

- **Jistota:** vysoka; skutecny helper byl spusten s mockem odeslani.
- **Misto:** [writeRetry.js:18](C:/dev/BIGGINFTWEB/src/shared/utils/writeRetry.js:18), `runWriteWithRpcRetry`; [AppCore.jsx:2529](C:/dev/BIGGINFTWEB/src/app/AppCore.jsx:2529), `sendWriteWithRpcRetry`. Volajici mint na 7830, redeem na 8242, retry VRF na 8512, claim na 8704.
- **Podminka:** `sendFn` skonci chybou klasifikovanou jako rate limit. Vychozi nastaveni povoluje dalsi dva pokusy. Neni rozliseno, zda uz prvni pozadavek odesel do site, pouze se nevratila odpoved.
- **Dukaz:** pri simulovane ztrate odpovedi po podani helper provedl `sendCalls = 2`. Pred dalsim `sendFn` neprobihalo dohledani puvodni transakce podle hash/nonce.
- **Dopad:** dalsi wallet prompt, moznost nove platene mint transakce nebo zbytecneho gasu. Konkretni chovani zavisi na wallet/RPC; duplicitni mainnet transakce nebyla vyvolana ani pozorovana.
- **Minimalni oprava:** automaticky opakovat read-only preflighty, ne cele podani. Pri nejasnem odeslani drzet stav `submission unknown`, dohledat puvodni hash/nonce a vyzadovat vedomou novou akci az po vyreseni stavu. Nepovazovat pouhy prechod na jiny RPC za dukaz, ze prvni podani neexistuje.
- **Zmena chovani:** ANO, zapisovy tok mint/redeem/retry/claim. Nejde o kosmetiku ani zmenu ceny, odmen ci kontraktovych pravidel.
- **Overovaci test:** chyba pred odeslanim, prijata transakce se ztracenou odpovedi, odmitnuti 4001, timeout, cekajici nonce a replacement. V nejasnem stavu nesmi byt automaticky druhe odeslani. Soucasne testy retry tento pozadavek nezajistuji.

### F02 - P1: VRF dalsich kapitol se kontroluje na kontraktu Originals

- **Jistota:** vysoka, dohledana aktivni cesta vcetne adresnich factory; bez mainnet zapisu.
- **Misto:** [AppCore.jsx:8100](C:/dev/BIGGINFTWEB/src/app/AppCore.jsx:8100), `redeemTicket`; `retryPendingMint` na 8401 a 8483; `checkVrfFulfilledByTransfer` na 8779; polling na [8913](C:/dev/BIGGINFTWEB/src/app/AppCore.jsx:8913) a finalizace na 8938. Factory [contract.js:161](C:/dev/BIGGINFTWEB/src/shared/utils/contract.js:161), 640 a 1409.
- **Problem:** redeem spravne vybere lokalni `readContract` podle kapitoly tiketu. Nasledne polling znovu vezme `contractRef.current || getReadOnlyContract()`, tedy vychozi MAIN/Originals. Retry obdobne pouzije `getMainRW()` pro vychozi kolekci.
- **Podminka:** pending redeem napr. Chapter 2 a zadny pending request v Chapter 1. Nula z Chapter 1 vede k `finalizeVrf()`, prestoze skutecny pozadavek Chapter 2 jeste neskoncil. Retry muze zahlasit, ze pending request neexistuje, nebo pracovat s jinym requestem.
- **Dopad:** predcasne skonceni cekani, nespravna informace o mintu, nedostupny nebo chybne smerovany recovery tok. Neni to dukaz ztraty NFT: spravny onchain request je veden na skutecne kolekci.
- **Minimalni oprava:** uchovat identitu pending operace `{chainId, account, chapterId, collection, ticketId, requestId}` a pouzit ji pro polling, Transfer/fulfillment filtr i retry. `expectedCollectionAddress` jiz existuje v pending polozce, ale zde se nepouziva. Zpracovat i obnoveni stranky. Nula na jinem kontraktu nesmi znamenat uspech.
- **Zmena chovani:** ANO, dulezity redeem/VRF/retry tok a zdroj pravdy. Nemeni se burning, nahodnost ani pravidla vyberu NFT.
- **Overovaci test:** pomaly fulfillment kapitol 2 az 5 pri nule na Originals, dva rozdilne requesty, prepnuti kapitoly, reload a pozdni callback stareho requestu. Potvrzeni redeem receipt nesmi samo oznacit NFT za mintnute.

### F03 - P2: odpoved stareho wallet refresh obnovi ucet po odpojeni

- **Jistota:** vysoka, reprodukovano skutecnym React providerem s mockem wallet.
- **Misto:** [Web3Provider.jsx:130](C:/dev/BIGGINFTWEB/src/providers/Web3Provider.jsx:130), `refresh`, nastavovani stavu po await na 158; `disconnect` na 320.
- **Podminka:** `refresh()` ceka na signer/adresu/sit a mezitim uzivatel provede disconnect nebo zmeni wallet. Dobihajici refresh nema kontrolu generace ani aktualniho explicitniho pripojeni.
- **Dukaz:** po `disconnect()` byl `account = ""`; po dokonceni odlozeneho `getSigner()` se obnovil `account = "wallet-A"` a neprázdny signer.
- **Dopad:** rozhrani znovu ukaze odpojenou/starou penezenku a poskytne stary signer dalsim konzumentum. Samotny test neprokazuje moznost podpisu bez souhlasu wallet.
- **Minimalni oprava:** generacni ID spolecne pro refresh/connect/disconnect/provider change, kontrola pred kazdym commitnutim vysledku, zneplatneni na disconnect; chyby stare generace nesmi vymazat novou session.
- **Zmena chovani:** ANO, sprava wallet session a zdroj signera. Nemeni onchain role ani opravneni.
- **Overovaci test:** slow A -> disconnect -> resolve A musi zustat odpojeno; slow A -> fast B -> resolve A musi zustat B; totéz pro zmenu chain ID a StrictMode cleanup.

### F04 - P2: Collection Rewards prepisuje novejsi wallet/kapitolu starymi daty

- **Jistota:** vysoka, reprodukovano na skutecnem hooku, service nahrazena odlozenymi odpovedmi.
- **Misto:** [useCollectionRewards.js:29](C:/dev/BIGGINFTWEB/src/hooks/useCollectionRewards.js:29), `refresh` a efekt na 60; aktivni konzument [REWARDSPanel.jsx:330](C:/dev/BIGGINFTWEB/src/features/rewards/REWARDSPanel.jsx:330).
- **Podminka:** request A probiha pri prepnuti wallet nebo kolekce na B. Po spravnem vysledku B dorazi starsi A. Bez podminky zavola `setData(stats)` i `setLoading(false)`.
- **Dukaz:** aktualni data `{wallet: B, claimable: 0}` prepsala starsi `{wallet: A, claimable: 1}`. `claimable` zde byl pouze identifikacni testovaci payload, nikoli zmena struktury produkcni service.
- **Dopad:** cizi/stare informace o claimu pod novou wallet nebo kapitolou; uzivatel muze vyvolat akci podle neplatneho nahledu. Onchain vlastnictvi tim obcházeno neni.
- **Minimalni oprava:** request ID a klic wallet + sit/provider + rewards kontrakt + collection. Skryt data z jineho kontextu ihned; pouze aktualni generace muze nastavovat data, error i loading. Navazat na jiz existujici vzor NFT V2.
- **Zmena chovani:** ANO, nacitani a prezentace naroku; zadna zmena pravidel naroku ci vyse odmen.
- **Overovaci test:** slow A/fast B pro wallet, kapitolu a provider, unmount, chyba A po uspechu B, konec loading starsiho pozadavku.

### F05 - P2: vypadek RPC vypada jako platna data a neznamy claim zustava otevreny

- **Jistota:** vysoka, service reprodukovana s chybou vsech kontraktovych metod; UI vetve overeny staticky.
- **Misto:** [collectionRewardsService.js:202](C:/dev/BIGGINFTWEB/src/shared/services/collectionRewardsService.js:202), `getAllStats` a `safeRead` na 310; [COLLECTIONREWARDSSection.jsx:115](C:/dev/BIGGINFTWEB/src/features/rewards/Rewards/CollectionRewards/COLLECTIONREWARDSSection.jsx:115), `resolveClaimPresentation`; `REWARDSPanel.jsx:324`, 330 a 502. Dalsi stejny vzor: `useTokenRewards.js:9` a `useCommunityCenterUserSnapshot.js:189`.
- **Podminka:** RPC vrati 401/402/403/429, timeout nebo jinou chybu cteni. `safeRead` chyby potlaci. I uplny vypadek vrati objekt misto zamitnuti Promise.
- **Dukaz:** vysledek pri vypadku vsech reads: `blockWinnersCount = 0`, devetkrat `blockPaid = false`, `rainbowClaimed = false`. Budget spravne zustal neznamy (`claimsEnabled = null`), ale celkove neni signalizovana chyba. Neznamy `claimability.resolved = false` ma v UI `disabled = false` a text `Check wallet`; null muze spadnout do `Open`.
- **Dalsi dukaz:** rodic ignoruje `loading`/`error` Collection hooku; `canClaimCOLLECTION` vyzaduje jen wallet/provider/service. `_sendTx` na 173 navic po chybe estimateGas dale zkousi podani. Community snapshot obdobne vraci nuly a prazdne eventy, token hook chybejici hodnoty bez chyby.
- **Dopad:** vypadek nelze spolehlive odlisit od nenaplneneho projektu nebo nevyplacene odmeny. Hrozi zbytecny wallet prompt/revert, ne automaticke obejiti kontraktoveho budget gate.
- **Minimalni oprava:** odlisit povinne a volitelne reads; u povinnych predavat error/unknown/stale a zachovat posledni platna data pouze stejneho kontextu. Pri neznamem naroku/budgetu zakazat claim a nabidnout refresh. Revert estimateGas nesmi byt tise povazovan za duvod pokracovat. Zachovat skutecnou nulu jako legitimni vysledek uspesneho cteni.
- **Zmena chovani:** ANO, stavy dat, preflight a dostupnost claimu. Pravidlo financovani pro kazdou kolekci se NESMI menit.
- **Overovaci test:** vsechny reads selzou, jen volitelny read selze, vracena skutecna nula, neznamy budget, neplatna URL, 429, timeout a znamy revert estimateGas; zadne automaticke odeslani pri neoverenem naroku.

### F06 - P2: sdileny polling muze zobrazit snapshot predchoziho zdroje

- **Jistota:** vysoka, reprodukovano skutecnym hookem.
- **Misto:** [_usePollingSnapshot.js:90](C:/dev/BIGGINFTWEB/src/hooks/tokenomics/_usePollingSnapshot.js:90), reset cache; `refresh` na 142, `inFlightRef` na 154 a nastavovani snapshotu po await. Aktivni pouziti v Ecosystem snapshot hooks.
- **Podminka:** pri rozbehnutem fetchi A se zmeni fetcher/cacheKey na B. Globalni `inFlightRef` zabrani spusteni B; odpoved A nasledne prepise aktualni snapshot bez kontroly zdroje.
- **Dukaz:** po zmene na B zustalo `callsB = 0`, vysledny `snapshot.source = A`. Pri pravidelnem pollingu muze pozdeji prijit oprava; do te doby je kontext chybny.
- **Dopad:** Ecosystem muze kratkodobe nebo az do dalsiho refresh ukazovat stav jineho readeru/site/konfigurace. Cache se zapisuje pod puvodnim klicem; chyba je zejmena v nekontrolovanem commitnuti do aktualniho UI.
- **Minimalni oprava:** oddelit in-flight a commit podle generace kontextu, pri zmene spustit pozadavek noveho zdroje, stare odpovedi ignorovat. Osetrit take minRefreshGap a finally.
- **Zmena chovani:** ANO, read-only polling a aktualnost panelu; bez zmen buyback/drip/liquidity transakci.
- **Overovaci test:** source A -> B, source A error po uspechu B, invalidace cache, refresh pri navratu do tabu, unmount. Nevynucovat AbortController do ethers volani, ktere jej nepodporuje.

### F07 - P2: Liquidity reader pouziva ethers v5 vlastnost `.address` na v6

- **Jistota:** vysoka; ověřeno proti skutecne nainstalovanemu ethers 6.17.0 a ABI dotcenych osmi kontraktu.
- **Misto:** [liquidity.reader.js:191](C:/dev/BIGGINFTWEB/src/shared/services/tokenomics/liquidity.reader.js:191), helper; 201 reserve/treasury reader; 385 whitelist/vault helper; 406 kontrola branch readeru; 420 a dale adresy vystupu. Instance vytvari [liquidity.contracts.js:17](C:/dev/BIGGINFTWEB/src/web3/contracts/liquidity.contracts.js:17).
- **Podminka:** normalni aktivni ethers v6 contract instance bez vlastniho `.address` adapteru. Factory tento adapter nepridava; v dotcenych ABI neni ani metoda nazvana `address`.
- **Dukaz:** `.address` je `undefined`, `.target` obsahuje cil. Podminky `if (helper?.address)` a `if (reserveTreasuryReader?.address)` tedy potrebne reads vubec neprovedou.
- **Dopad:** chybejici treasury/helper/whitelist udaje a adresy v Liquidity UI; preskocena cast kontroly zastaraleho wiring. Nelze to automaticky vysvetlovat chybejici likviditou.
- **Minimalni oprava:** pouzit validovane `target` nebo `await getAddress()` a jednotnou lokalni funkci pro ziskani adresy; nemigrovat kvuli tomu backend z ethers v5. API v6 popisuje [oficialni dokumentace Contract](https://docs.ethers.org/v6/api/contract/#BaseContract-target).
- **Zmena chovani:** ANO, aktivuje dosud vynechane reads a kontrolu wiring; nemeni LP ani financni operace.
- **Overovaci test:** skutecne ethers v6 instance s mock runnerem, nikoli mocky umele obsahujici `.address`; overit zavolani helperu a treasury readeru, adresy vystupu a detekci spatneho wiring.

### F08 - P2: neuspesny/zruseny claim dostane zpravu o odeslani

- **Jistota:** vysoka, primo dolozena navaznost callbacku; bez podpisu transakce.
- **Misto:** [REWARDSPanel.jsx:552](C:/dev/BIGGINFTWEB/src/features/rewards/REWARDSPanel.jsx:552), `handleClaim`; [AppCore.jsx:8728](C:/dev/BIGGINFTWEB/src/app/AppCore.jsx:8728), `claimREWARDS`, pripojeni callbacku na 9329.
- **Podminka:** AppCore odchytne odmitnuti uzivatelem, nedostupnost nebo revert a vrati `undefined`. Rodicuv Promise se splni; panel po `await onClaim()` bez dalsi podminky vypise `Claim submitted. Watch your wallet for confirmation.`.
- **Dopad:** protichudne informace po zruseni/neodeslane transakci. Pri uspechu navic AppCore jiz pockal `tx.wait()`, takze zprava o dalsim cekani neodpovida stavu.
- **Minimalni oprava:** explicitni vysledek `{status: confirmed | cancelled | failed | noop, hash, receipt}` nebo konzistentni error kontrakt callbacku. Panel nesmi odvozovat uspech jen z toho, ze Promise nebyl rejectnuty.
- **Zmena chovani:** ANO, verejne rozhrani callbacku mezi komponentami a UX claimu. Zadna zmena odmen.
- **Overovaci test:** 4001, prazdny narok, RPC chyba pred podanim, revert receipt, replacement, uspesny receipt. Zpravu `confirmed` pouze po potvrzenem vysledku.

### F09 - P2: backendovy alias NFT Rewards zustal V1 a shazuje kontrolu kontraktu

- **Jistota:** vysoka; `node scripts/check-contracts.js` skutecne skoncil kodem 1.
- **Misto:** [addresses.json:101](C:/dev/BIGGINFTWEB/biggi-project/bekend/addresses.json:101), `NFT_REWARDS_CONTRACT`; frontend [addresses.js:427](C:/dev/BIGGINFTWEB/src/shared/utils/addresses.js:427). CI krok [ci.yml:31](C:/dev/BIGGINFTWEB/.github/workflows/ci.yml:31).
- **Dukaz:** alias v backendu je V1 `0x939Df533b80943298E15ad4c8F188102954f34FF`; root a public mirror odvozuji alias z aktivniho V2 `0xd1cefDf3b4ce4c174291F8eB0729980c50D293b9`. Hlavni `NFT_REWARDS` je V2, tento problem neznamena, ze aktualni hlavni NFT Rewards UI stale vola V1.
- **Dopad:** lokalni/CI consistency gate selhava pro root i mirror. Skript pouzivajici stary alias jako fallback muze zvolit V1. Audit neziskaval posledni remote GitHub Actions log, proto tento nalez neni vysvetlenim libovolneho historickeho padu Actions.
- **Minimalni oprava:** opravit kanonicky alias podle primarniho V2 zaznamu a doplnit invariant rovnosti aliasu. Projit pouze skutecne konzumenty aliasu; neprepisovat historicke deployment reporty V1.
- **Zmena chovani:** ANO, konfigurace adresy/fallbacku. Nevyzaduje novy kontrakt ani automaticky novy deployment.
- **Overovaci test:** `npm run check:contracts`, root i public mirror bez rozdilu; test skriptu s chybejicim primarnim klicem a aktivnim aliasem.

### F10 - P2: memoizovany Collection panel nezohlednuje aktualizovane ceny

- **Jistota:** vysoka pro chybejici zavislost a datovy tok; skutecna prodleva zavisi na ostatnich refreshich.
- **Misto:** [AppCore.jsx:9315](C:/dev/BIGGINFTWEB/src/app/AppCore.jsx:9315), `renderActivePanel`; pouzite hodnoty na 9342 a 9343, dependency list na 9437. Konzument [CollectionBlocksGrid.jsx:525](C:/dev/BIGGINFTWEB/src/features/rewards/COLLECTION/CollectionBlocksGrid.jsx:525).
- **Podminka:** zmeni se `blockPrices`/`blockMintCounts`, ostatni dependencies memo zustanou stejne. Memo vrati starsi JSX s puvodnimi props. Originals grid temto props veri a vlastni cteni preskoci.
- **Dopad:** zobrazovane ceny/pocty zustanou stare az do zmeny jine zavislosti nebo znovuotevreni panelu. Neprokazuje to odeslani mintu za spatnou cenu; public mint ma samostatny cerstvy preflight.
- **Minimalni oprava:** u tohoto konkretniho memo doplnit skutecne pouzite zavislosti `blockPrices`, `blockMintCounts`, `autoOpenInfoPanel`, nebo odstranit zbytecnou memoizaci JSX po overeni callback toku.
- **Zmena chovani:** ANO, aktualnost cen v UI; NESMI se zmenit procenta rustu, barevne mapovani ani metadata.
- **Overovaci test:** zmenit pouze ceny/pocet mintu pri otevrenem panelu bez nove identity ostatnich props. Overit i situaci, kdy pozadi navysi cenu odpovidajici barvy bloku pri nezmenenem vlastnim poctu mintu tohoto bloku.

## 4. Mapa skutecneho projektu

### Verze a aktivni cesty

Verze byly overeny v lockfile a instalaci, ne pouze z rozsahu v manifestu.

| Cast | Overeny stav |
| --- | --- |
| Lokalni Node | 22.16.0; pozadavek repa >=20.19 |
| Root frontend | React/react-dom 19.2.3, ethers 6.17.0, Vite 7.3.6, TypeScript 5.9.3, Vitest 4.1.9 |
| Root dalsi integrace | Supabase 2.112.4, WalletConnect ethereum-provider 2.23.1 |
| Backend `biggi-project/bekend` | ethers 5.8.0, Hardhat 2.29.1, TypeScript 5.9.3 |
| Root Hardhat | 3.13.0; nepouzit pro backendove testy |
| `public-repo` | Oddeleny mirror; ethers 6.17.0, React 19.2.3, Vite 7.3.6, Vitest 4.1.10, Supabase 2.90.0 |
| Kanonicky CRE workflow | `biggi-project/bekend/cre-workflows/biggi-cre/my-workflow`; cre-sdk 1.15.0, viem 2.34.0, zod 3.25.76 |
| Read-only CRE health | `biggi-project/bekend/cre/biggi-tokenomics-automation`; cre-sdk 1.14.0, viem 2.34.0, zod 3.25.76 |

Produkce vychazi z root Vite konfigurace: `index.html` pro landing a
`app/index.html` -> `src/app/main.jsx` -> lazy `AppRuntime.jsx` -> providery ->
`AppCore.jsx`. Rewards, Collection, VRF, Ecosystem, User a Community panely se
nacitaji pres aktivni importy. `functions/` jsou Netlify serverove funkce;
Solidity, deployment utility a lokalni kontraktove testy lezi v backendu.

Ve zdrojove inventure bylo 481 JS/TS souboru. Staticky graf literalnich importu,
reexportu a dynamickych importu z app entry dosahl 223 modulu a nenalezl v teto
podmnozine kruh. Parser mel problem v `src/shims/hash.js`, mimo dosazeny app
graf. Vysledek proto neni globalni dukaz bezcyklicnosti celeho repozitare.

Reexportove wrappery `src/app/providers`, `src/services` apod. nebyly automaticky
oznaceny za duplicitni implementace. `public-repo`, stare experimenty
`alchemy-demo`, `.bak` ABI a generovane artefakty nejsou root produkcni aplikace.
`useTokenRewards` JE aktivni, v panelu je importovan s jinym zapisovanim nazvu.
Samostatny `handleClaim` v `LiveStats.jsx:2519` nema v teto komponente zadne
volani; proto nebyl hodnocen jako aktivni transakcni cesta.

Existujici necommitnute a nesledovane zmeny byly respektovany. Audit neprovadel
reset, checkout, formatovani, synchronizaci ABI/adres ani instalace.

### Co funguje konzistentneji

- [useNFTRewards.js:34](C:/dev/BIGGINFTWEB/src/hooks/useNFTRewards.js:34) pouziva generaci pozadavku, kontroluje kontext, sit 137 a snapshot blockTag; chyby nesplyvaji se success.
- [nftRewardsService.js:205](C:/dev/BIGGINFTWEB/src/shared/services/nftRewardsService.js:205), `claimForWallet`, overuje signer/sit/prijemce/stav naroku; lokalni testy pokryvaji V1/V2 kompatibilitu a negativni scenare.
- [nftRewardsAdmin.js:68](C:/dev/BIGGINFTWEB/src/shared/services/nftRewardsAdmin.js:68) overuje sit a aktualni owner autorizaci a omezuje podporovane akce. Viditelnost admin buttonu neni jedina autorizace.
- [CollectionBlocksGrid.jsx:930](C:/dev/BIGGINFTWEB/src/features/rewards/COLLECTION/CollectionBlocksGrid.jsx:930) ma u public mintu ochranu soubezneho podani, kontextovy guard, kontrolu site, finalnich obrazku/metadata readiness, supply a unlocku; pred podanim nacita aktualni cenu a odesila raw celociselne `value`. Resi i transaction replacement.
- Backendove testy pokryly navaznost ticket redeem/burn -> request -> fulfillment a oddelene chapter routing, rozpocty kolekci, retry NFT V2 i pozdni callbacky. To nepokryva chybnou frontendovou identitu requestu F02.
- [rpcConfig.js:46](C:/dev/BIGGINFTWEB/src/shared/utils/rpcConfig.js:46) validuje HTTP(S), ma timeout, v probe nefixuje sit napevno a skutecne porovnava vysledek `eth_chainId` s 137; nasledne overi block number a zavre provider. Runtime konfigurace obsahuje Polygon mainnet, ne Amoy.
- NFT castky i CRE integer hodnoty zustavaji `bigint`; backendovy ethers v5 pouziva svuj BigNumber. Tyto verze neni nutne sjednocovat jen kvuli stylu.

## 5. Preventivni doporuceni, nikoli prokazane produkcni incidenty

Oznaceni R1-R5 v teto sekci jsou identifikatory preventivnich doporuceni.

| ID | Pozorovani | Minimalni postup a test |
| --- | --- | --- |
| R1 | `src/shared/utils/multicall.js:10`: `_hasFn` vrati true, i kdyz ethers v6 `Interface.getFunction(name)` vrati null. V aktualne proverene Liquidity sade vsechny pozadovane funkce v ABI existuji. | Vratit pravdivost nalezeneho fragmentu a otestovat neznamou funkci. Neoznacovat latentni problem za duvod vsech aktualnich RPC chyb. |
| R2 | `_usePollingSnapshot.js:111` prevadi boolean pres `toString`; `false` by se stal pravdivym retezcem. Aktivni Ecosystem vsak explicitne predava `sanitize: false`. | Test zachovani booleanu u ostatnich/budoucich konzumentu; neopravovat na zaklade tvrzeni, ze je dnes kazdy Ecosystem boolean spatne. |
| R3 | `src/app/main.jsx:76` vytvari preload manager behem renderu; `preloadManager.js:40` hned registruje RAF. Cleanup nezahrnuje vsechny timeout/load vetve inicializace. | Oddelit cistou konstrukci od start/stop v efektu, otestovat StrictMode a preruseny mount, pocitat aktivni RAF/listenery po unmount. Leak ani jeho velikost timto auditem nebyly prokazany. |
| R4 | Parent stats reuse v `CollectionBlocksGrid.jsx:525` bere `every` nad slice bez kontroly delky. Pro prazdne pole vrati true; normalni root rodic ted predava plna pole. | Vyzadovat oba seznamy presne dostatecne dlouhe a testovat 0, 9 a 10 prvku. Nejde o zmenu poctu NFT ani barev. |
| R5 | Typecheck nekontroluje vetsinu aplikacniho JS (`checkJs: false`), a nektere testovaci mocky kontraktu nerozlisuji `.address`/`.target`. | Pridat uzke typy a testy na kriticke hranice service/provider/tx outcome; zadna plosna migrace frameworku ani blind zapnuti strict pro cele repo. |

Dalsi profilovani je vhodne pro casto meneny Web3 context, sdileni read-only
provider poolu a duplicitni refresh konzumentu. Bez mereni nepredpokladat, ze
pridani `useMemo`, zmena `useState` na `useReducer` nebo zavedeni dalsi knihovny
zrychli aplikaci. Ochrana zastaralych vysledku a spravne dependencies odpovidaji
[principum useEffect v dokumentaci React](https://react.dev/reference/react/useEffect).

## 6. Vykon: dukazy A, podezreni B, kosmetika C

### A1 - Lokalni runtime mereni

Byl spusten lokalni Vite production preview nad hotovym `dist/`, nikoli dev
server. Chromium headless, bez MetaMask a jinych rozsireni, bez pripojene wallet,
bez CPU/sitoveho throttlingu. Pro kazdou velikost vznikl novy browser context.
Pozorovaci okno: 25 sekund po DOMContentLoaded, bez otevirani dalsich panelu.
Desktop bezel prvni; mobilni viewport neni emulace vykonu fyzickeho telefonu.
Routing byl povolen jen pro GET/HEAD/OPTIONS a read-only JSON-RPC whitelist.
Nebylo potreba blokovat zadny zapisovy pozadavek. Browser i preview se zavrely.

| Metrika | Desktop 1440x900 | Mobilni viewport 390x844 |
| --- | ---: | ---: |
| FCP | 1260 ms | 404 ms |
| Posledni pozorovany LCP | 2352 ms | 860 ms |
| Long tasks / soucet | 6 / 927 ms | 4 / 412 ms |
| Nejdelší long task | 241 ms | 147 ms |
| JS `encodedBodySize` podle Resource Timing | 424308 B | 422414 B |
| Logicke RPC calls / HTTP RPC requests | 37 / 16 | 37 / 16 |
| RPC metody | 34 eth_call, 3 eth_blockNumber | 34 eth_call, 3 eth_blockNumber |
| HTTP >=400 / request failures / page errors | 0 / 0 / 0 | 0 / 0 / 0 |
| Document scrollWidth / viewportWidth | 1440 / 1440 | 390 / 390 |

Jde o dve lokalni pozorovani, ne prumer, percentil, Lighthouse score nebo
produkční Core Web Vitals. Z techto hodnot nelze dovodit, ze mobilem aplikace
bezi rychleji, ze vsechny panely jsou bez layout problemu, ani ze Infura nema
limit. Vzorek neresi skutecnou wallet, velkou galerii, soubezne navstevniky nebo
dlouhodoby polling. Zadna procenta budouciho zrychleni nejsou odhadovana.

### A2 - Dolozeny sekvencni tok Liquidity reads

[liquidity.reader.js:129](C:/dev/BIGGINFTWEB/src/shared/services/tokenomics/liquidity.reader.js:129)
ceka postupne na reserve, manager a vault multicall, pozdeji obdobne orchestrator,
keeper a branch reader. Nezavisle skupiny tak scitaji sitove latence. Minimalni
navrh: omezeny paralelismus nezavislych skupin nad stejnym snapshot blockTag;
navazne reads s nezjistenymi parametry ponechat zavisle. Overit pocet requests,
chovani pri castecne chybe a p50/p95 po oprave F07. Zrychleni zatim nezmereno.

### A3 - Nepodminene nacitani vsech reward sekci

`REWARDSPanel.jsx:324-348` inicializuje token, collection a NFT hooks nezavisle
na zvolene zalozce. NFT hook ma strankovani a limit, ale i tak umi prohledat
500 rewards a 100 eventu s omezenou konkurenci. Pri rustu poctu zaznamu tak
prvni Token tab vyvola praci i pro skryty NFT tab. Je to dolozeny tok, ne
zmereny dnesni bottleneck. Navrh: oddelit maly souhrn a lazy detail aktivni
zalozky. Overit zachovani souhrnneho naroku a refresh po claimu.

### A4 - Velikosti buildu a lazy loading

Build mel 4379 modulu. Vybrane raw/gzip velikosti: AppRuntime 652.33/126.71 kB,
vendor-wallet 1399.58/395.06 kB, ethers 233.70/72.80 kB,
React 192.36/60.30 kB, Supabase 211.38/55.87 kB.
Wallet chunk se nacita dynamicky; neni spravne vydavat celou jeho velikost za
povinny pocatecni download. Zvyseny `chunkSizeWarningLimit: 1700` je jen limit
varovani, nikoli optimalizace. Merit konkretni importovani casti, ne pouze
prejmenovavat chunky.

### B - Co vyzaduje dalsi profilovani

- Dva read-only provider mechanismy v `shared/utils/contract.js` a `web3/provider`/RPC poolu. Bez profilu nelze tvrdit uniky nebo RPC storm.
- Velky `AppCore` a sirka context aktualizaci: React profiler s pripojenou mock wallet, nejmene 100/1000 assety a prepinanim panelu.
- Initial LCP obrazek/preload a vliv konkretni MetaMask verze: porovnat stejny build s a bez rozsireni, stejny cache rezim, sit a CPU.
- Dlouhodoba nedostupnost providera, 401/402/403/429, quota reset a circuit breaker: deterministicke mock scenare a pozdeji autorizovane produkcni mereni bez zapisů.

### C - Kosmetika bez prokazaneho vykonnostniho prinosu

Sjednoceni nazvu souboru, prepis `for` na `map`, `sort` na `toSorted`, plosne
pridavani memoizace, sjednoceni ethers v5/v6 v oddelenych projektech nebo
prepis vseho do `useReducer` nejsou opravy nalezenych problemu.

## 7. Bezpecnost, tajemstvi a hranice automatizace

`vite.config.js:6-45` blokuje secret-like klientské promenne, napr.
`VITE_PRIVATE_KEY`, `VITE_NETLIFY_AUTH_TOKEN`, `VITE_SUPABASE_SERVICE_ROLE_KEY`,
`VITE_PINATA_SECRET_API_KEY`. Vystup hlasi nazvy, ne hodnoty. Nebylo nalezeno
plosne vlozeni celeho `process.env` do klienta. Zdrojovy signature scan prosel.

Dodatecna aplikace stejne heuristiky na `dist/` dala sest nalezu ve vendor
Supabase/WalletConnect. Nasledna AST kontrola ukazala pristupy k promennym,
runtime heslum, prazdny string a jmeno SIWX storage klice, nikoli zabudovane
serverove credential hodnoty. Tento scan sam o sobe neprokazuje, ze v bundlech
nemuze byt libovolne pojmenovane tajemstvi. Skutecne hodnoty Netlify/CRE/wallet
secretu nebyly otevirany ani porovnavany; jejich remote konfigurace je mimo audit.
Klientske RPC identifikatory je nutne chranit limity na strane poskytovatele,
ne vydavat kod v prohlizeci za soukrome uloziste klicu.

V aktivnim UI nebylo nalezeno zjevne renderovani neduveryhodnych metadat pres
`dangerouslySetInnerHTML` nebo JavaScript `eval`. `redis.eval` na serveru je
Lua prikaz pro Redis, nikoli stejna kategorie JavaScript vykonavani.
[functions/message.js:197](C:/dev/BIGGINFTWEB/functions/message.js:197) overuje
wallet podpis a vazbu nonce; na 260-265 spotrebovava nonce atomicky pres
podminku `used = false`. Serverove admin a Pinata funkce overuji podepsany
pozadavek a owner identitu. Toto jsou kontrolovane ochrany, ne penentracni test
produkce nebo overeni aktualnich Supabase RLS politik.

Kanonicky CRE [main.ts:40](C:/dev/BIGGINFTWEB/biggi-project/bekend/cre-workflows/biggi-cre/my-workflow/main.ts:40)
ma schema konfigurace, decimal string/BigInt pro hodnoty, finalizovane reads,
vyhodnoceni checkUpkeep a podani performUpkeep pro konfigurovane cile; dalsi
vetev resi tydenni emission roll. `dryRun` nepoda write report a neuspesny
`TxStatus` neni vydavan za uspech. Lokalni receiver/automation testy prosly.
Read-only health workflow v druhe CRE slozce neni produkcni zapisova automatizace.
Zadny z techto vysledku nepotvrzuje dostupny CRE deployment access, aktualni
funding, aktivni DON nebo skutecne spustene drip/buyback/liquidity keepery.

## 8. Provedene kontroly a jejich skutecny vysledek

Skripty byly pred spustenim posouzeny. Nebyl spusten `depcheck`, protoze jeho
nazev zde skryva `npm-check-updates -u && npm install`. Nebyl spusten deploy,
`npm audit fix`, formatovani, write smoke ani test na externim mainnet fork.

| Kontrola / prikaz | Vysledek | Rozsah a omezeni |
| --- | --- | --- |
| `node node_modules/eslint/bin/eslint.js "src/**/*.{js,jsx,ts,tsx}" --format json` | PASS | 480 souboru, 0 errors, 139 warnings. Ekvivalent lint bez fixu, vystup zpracovan v pameti. |
| `npm run typecheck` | PASS | `tsc --noEmit -p tsconfig.json`; zahrnuto jen 8 TS/TSX souboru, `checkJs: false`, `strict: false`. Neprokazuje typovou bezchybnost cele JS aplikace. |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | PASS | 69 sad, 328 testu; priblizne 120.64 s. Mockovane transakce/RPC, nikoli realna MetaMask. |
| Backend prikaz nize | PASS | 121 passing, priblizne 2 minuty. Lokalni Hardhat bez forku a bez kompilace, existujici artefakty. |
| `npm run build` | PASS | Vite build 4379 modulu, 45.57 s; nasledne security headers generator, 9 inline script hashu. Pouze lokalni build. |
| `node scripts/smoke-runtime.mjs` | PASS | Desktop 1440x900: Gallery controls, LiveStats modal, Rewards preview. Mobil 390x844: dashboard/galerie a horizontalni overflow. Bez wallet. Preview ukoncen. |
| `node scripts/check-abis.js` | PASS | Heuristika 478 prohledanych souboru, 61 ABI, 848 nazvu funkci. Neumi dokazat spravny cil/semantiku kazdeho volani ani odhalit F07. |
| `node scripts/check-contracts.js` | FAIL | Po jednom rozdilu ze 170 adres pro root/mirror, stejny alias NFT Rewards, F09. Pet kapitol a osm kontrolovanych CORE ABI souhlasi. |
| `node scripts/check-secrets.mjs` | PASS | Zdrojovy signature scan, neporovnava skutecne produkcni secrets; ignorovane/velke/binarni soubory nejsou uplne pokryti. |
| Jednorazovy `node` runner: stejny secret scanner s in-memory seznamem `dist` souboru | FAIL | Sest heuristickych hlaseni; nasledna AST triage je vyhodnotila jako false positive. Zadne realne serverove tajemstvi potvrzeno nebylo. |
| `node node_modules/typescript/bin/tsc --noEmit` v obou CRE projektech | PASS | Oba projekty zvlast, bez generovani, simulate nebo deploy. |
| Jednorazove `node` reprodukce hooku/sluzeb nad skutecnym zdrojem | PASS | Potvrdily zavady F01/F03/F04/F05/F06. PASS znamena uspesnou reprodukci, nikoli bezchybnost aplikace. Bez zapisovani testu do zdroju. |
| Jednorazove `node --input-type=module`: Vite preview + Playwright + PerformanceObserver | PASS | Dve omezena lokalni mereni v A1, read-only RPC whitelist, procesy ukonceny. |
| `npm run test:ci` / alternativni Jest coverage | SKIPPED | Primarni Vitest sada byla spustena; samostatny Jest/coverage runner nebyl spousten. Nepripisuji mu uspesny vysledek. |
| Cerstva Solidity kompilace | SKIPPED | Testy byly `--no-compile`; audit neaktualizoval zdrojove ABI ani artefakty. |
| CRE simulate/deploy, mainnet write, approve, role changes | SKIPPED | Mimo povoleny read-only rozsah; zadne realne transakce ani externi zmeny. |
| Aktualni Netlify env/secrets, GitHub job logs, vsechny produkcni RPC | SKIPPED | Nebyla provedena autorizovana kontrola kazdeho remote prostredi; lokalni bundle a kratky read vzorek ji nenahrazuji. |
| Produkcni load test, fyzicky mobil/tablet, wallet E2E | SKIPPED | Smoke a viewport mereni nejsou zatěžovy test ani skutecna mobilni penezenka. |
| Dependency vulnerability advisory audit | SKIPPED | Overeny instalovane verze, nikoli kompletni novy CVE audit vsech zavislosti. Zadne instalace ani upgrade. |
| Kontrola integrity pracovniho stromu pri dokonceni | PASS | Hash sledovaneho diffu a vsech existujicich nesledovanych zdrojovych/dokumentacnich souboru zustal stejny jako pri zahajeni tohoto pokracovani. Jediny novy takovy soubor je tento report. |

Backendove testy bez zmeny prostredi na disku byly spusteny pres Node child
process s pracovnim adresarem `biggi-project/bekend`, s procesnimi hodnotami
`FORK_URL=''`, `FORK_BLOCK_NUMBER=''`, `CRE_AUTOMATION_REPORT_PATH=''`:

```text
node node_modules/hardhat/internal/cli/cli.js test --config hardhat.biggi-master.cjs --network hardhat --no-compile
```

Lint warnings: 52 nepouzitych promennych, 46 dependencies, 28 React Refresh,
5 prefer-const, 3 neescapovane entity, 1 irregular whitespace a 4 konfiguracni
varovani. Neni spravne tyto hodnoty vydavat za 139 potvrzenych runtime bugu;
konkretni dependencies byly sledovany v toku dat, zejmena F10.

### Reprodukcni scenare bez zapisu zdroju

Jednorazove sondy byly predany Node pres stdin (`@'... '@ | node` v PowerShellu).
Existujici source byl zpracovan Babel parserem/esbuild v pameti; nezmenila se
implementace testovaneho hooku ani service. Sitove zavislosti nahradily mocky.

| Sonda | Poradi operaci | Pozorovany vysledek |
| --- | --- | --- |
| Write retry | Prvni send zaznamena podani a vyhodi klasifikovanou 429; nulova testovaci prodleva; druhy send uspeje. | `sendCalls: 2` |
| Wallet disconnect | Mount realneho Web3Provider, pozastavit mock getSigner, disconnect, dokoncit getSigner/getAddress. | Prazdny ucet se vrati na wallet-A, signer se obnovi. |
| Collection hook | Spustit A, rerender na B, vyresit B, pak A. | State B prepise A. |
| Poll hook | Fetch A pending, novy cacheKey/fetcher B, dokoncit A; interval vypnut pro determinismus. | B nebyl zavolan; snapshot je A. |
| Collection RPC failure | Realny getAllStats, spravne zadana collection, vsechny contract reads vyhodi chybu. | Promise se splni, pocet vitezu 0, paid false, claimability unresolved. |
| Ethers instance | Skutecny ethers v6 Contract a dotcena ABI, bez podpisu a bez site. | `.address` undefined, `.target` existuje. |

Reprodukcni sondy dosud nejsou trvalou regresni sadou. Jejich pridani patri az
do nasledne schvalene opravne etapy. Testy F02/F08/F10 navrzene u nalezu rovnez
nejsou timto reportem vydavany za jiz implementovane frontendove E2E testy.

## 9. Doporucene poradi oprav a soubory

1. F01 a F02: zastavit automaticke znovupodani zapisu a opravit identitu chapter VRF od redeem po retry/fulfillment. Soubory: `src/shared/utils/writeRetry.js`, `src/app/AppCore.jsx`, odpovidajici testy; upravit souvisejici popis retry v developer dokumentaci, pokud bude tento postup schvalen.
2. F03, F04, F06: generation/context guards pro wallet, Collection Rewards a sdileny polling. Soubory: `src/providers/Web3Provider.jsx`, `src/hooks/useCollectionRewards.js`, `src/hooks/tokenomics/_usePollingSnapshot.js`; testy slow A/fast B a disconnect.
3. F05 a F08: spolehlive error/unknown/loading stavy a explicitni vysledky claimu. Soubory: `src/shared/services/collectionRewardsService.js`, `src/hooks/useTokenRewards.js`, `src/hooks/useCommunityCenterUserSnapshot.js`, `src/features/rewards/REWARDSPanel.jsx`, `src/features/rewards/Rewards/CollectionRewards/COLLECTIONREWARDSSection.jsx`, callback v `src/app/AppCore.jsx`.
4. F07, F09, F10: kompatibilita ethers v6 readeru, kanonicky alias a aktualni ceny v panelu. Soubory: `src/shared/services/tokenomics/liquidity.reader.js`, `biggi-project/bekend/addresses.json`, `src/app/AppCore.jsx`; testy consistency a presneho aktualizovani props. Mirror synchronizovat pouze tam, kde se oprava skutecne tyka jeho runtime.
5. Teprve pote A2/A3: zmerit a omezene paralelizovat/podminit reads. Opakovat stejny profil s limity RPC, aktualnosti snapshotu a chovanim pri chybe. Nezvysovat soubeznost plosne.
6. Nakonec preventivni hrany, cisteni skutecne neaktivniho kodu a stylisticka varovani. Zadny velky prepis jako podminka opravy vyse uvedenych chyb.

### Vyslovne dulezite dopady navrhu

- **Mint/redeem/claim podani:** F01 meni retry strategii. Nutny samostatny souhlas a transakcni regresni testy.
- **VRF/retry:** F02 meni cil cteni a zapisoveho retry, nikoli randomizaci nebo burning. Neni to jen vizualni uprava.
- **Wallet/signer:** F03 meni session lifecycle; F04/F06 meni identitu aktualnich dat. Zadne pridelovani nebo odnimani onchain roli.
- **Claim gate:** F05 meni dostupnost buttonu a preflight pri neoverenem stavu, nikoli narok vlastnika, prah budgetu nebo vyplacenou castku.
- **Claim outcome:** F08 meni callback kontrakt mezi komponentami a zpravy uzivateli.
- **Adresa kontraktu:** F09 opravuje alias V1/V2. Pred zmenou potvrdit kanonicky aktivni deployment, ne automaticky redeployovat.
- **Ceny:** F10 meni jen obnovovani jejich zobrazeni. Procenta rustu barev oci/bloku, navaznost stejné barvy pozadi, rarity, metadata a supply zustavaji beze zmen.
- **Financni automatizace:** A2/F07 meni pouze cteni. Zadne zvyseni emisi, zmena weekly odmen, distributor splitu, drip, buyback, liquidity prahu nebo CRE zapisovych pravidel neni soucasti navrhu.

Pred zadosti o schvaleni oprav oddelit tyto zmeny do malych overitelnych kroku.
Po kazdem kroku relevantni regresni testy; pred pripadnym budoucim release
opakovat celou sadu, build a consistency gate. Tento audit nic nenasadil.
