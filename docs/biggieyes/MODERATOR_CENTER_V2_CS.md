# Moderator Center V2 - Polygon mainnet

Posledni zivy read-only snapshot: 2026-10-01, blok Polygonu `94786081` (`chainId=137`). Cteni bylo pripnuto ke stejnemu bloku. Pri teto kontrole nebyla odeslana zadna transakce.

## Aktualni stav

Moderator V2 je kanonicky kontrakt pro vsechny nove integrace aplikace. Moderator V1 je zastaraly a historicky; jeho zbyvajici produkcni reference jsou migracni dluh. V2 je nasazeny a interne propojeny s Drip V2, ale **neni aktivni v produkcnim toku**.

| Komponenta | Adresa | Overeny stav |
| --- | --- | --- |
| Zastaraly `ModeratorCenter` V1 | `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D` | Historicky; zbyvajici produkcni reference se musi premigrovat |
| `ModeratorCenterV2` | `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8` | Pozastaveny; neni provozne pripraven |
| Legacy `BiggiDripLMToModerator` V1 | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` | Produkcni upstream kontrakty na nej stale odkazuji |
| `BiggiDripLMToModeratorV2` | `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A` | Pozastaveny; interni propojeni je pripravene |

Ve zkontrolovanem bloku platilo:

- V Moderator V2 bylo registrovano vsech pet kapitol, ale nebyl zapnuty zadny slot ani leader. `operationallyReady()` vracelo `false`.
- Drip V2 melo `wiringReady() == true`, odkazovalo na Moderator V2 a nemelo zadny cekajici nativni zustatek.
- `DripDistributor.dripLM`, `DripDistributor.tokensPerMintOperator` a `BuybackAgent.dripLM` stale odkazovaly na Drip V1.
- Oba V2 kontrakty byly pozastavene.
- Nastaveny par BIGGI/WPOL nemel rezervy.
- Vahy Moderatoru: leader `100`, moderator `30`, ticket boost `10`; globalni tydenni jedinecnost byla zapnuta. Milniky byly uzamcene a nastavene na nulu.
- Parametry Drip V2: prodej `70 %`, rozdeleni Reserve/Moderator `5000/5000` bps, slippage `200` bps a deadline `600` sekund.

Moderator Tools v aplikaci umi cist data z V2, ale podpora v rozhrani neznamena, ze produkcni platby tecou do V2. Rozhodujici je stav upstream adres uvedeny vyse.

## Tok odmen

Po propojeni a aktivaci vola buyback vetev Drip V2 po nakupu BIGGI. Drip V2 proda nastavenou cast BIGGI pres DEX a ziskane nativni POL rozdeli mezi Reserve a Moderator V2. Moderator V2 priradi alokaci do aktualniho tydenniho obdobi.

Moderator V2 ma deset slotu. Kazdy zapnuty slot potrebuje payout adresu a jedinecny referral hash; presne jeden zapnuty slot musi byt leader. Tydenni vahy vychazeji z opravnenych unikatnich referral registraci, koeficientu role a aktivity s tikety. Uzavreny tyden muze po cekaci lhute vyporadat kdokoliv; castky se pripisi payout adresam, ktere si je mohou vyzvednout. Pokud tyden nema zadnou opravnenou vahu, alokace se prenese do dalsiho obdobi.

Jde o vyplatu v POL, nikoliv o claim BIGGI tokenu. Milnikove odmeny jsou oddelene a aktualne nastaveny na nulu.

## Proc V2 neni aktivovana

Momentalne nejsou splnene dve produkcni podminky:

1. Neni nakonfigurovany zadny moderator slot. Pro `operationallyReady()` je potreba alespon jeden kompletni slot a presne jeden leader.
2. Nastaveny par BIGGI/WPOL nema likviditu. Aktivacni preflight prazdny par vyslovne odmita.

Tyto kontroly neobchazejte a neprepojujte produkcni volajici na pozastavene V2 kontrakty. Mohlo by to prerusit existujici Drip zpracovani. Frontendovy registry ted povazuje Moderator V2 za kanonicky pro nove UI integrace a legacy V1 helper povoluje pouze cteni. Backendove deployment manifesty ponechavaji V1 pod historickym klicem `MODERATOR_CENTER`, protoze na nej aktualne odkazuji nasazene upstream kontrakty; tato zmena zdrojoveho kodu nemeni chain. Aktivacni skript odpozastavi oba V2 kontrakty a zmeni tri upstream reference v samostatnych transakcich; migrace neni atomicka.

## Bezpecny postup aktivace

1. Ziskejte skutecnou payout adresu a referral identitu kazdeho slotu, ktery chcete zapnout. Vyberte presne jednoho leadera. Hodnoty nevymyslejte.
2. Spustte `npm run prepare:configure-moderator-v2:polygon` a zkontrolujte navrzene sloty. Konfigurujte je pouze tehdy, kdyz Moderator V2 zustava pozastaveny.
3. Pridejte predem odsouhlasenou likviditu BIGGI/WPOL a overte nenulove rezervy. Pocatecni mnozstvi tokenu a cenu je nutne samostatne rozhodnout.
4. Spustte `npm run prepare:activate-moderator-v2:polygon` a zkontrolujte cely preflight i poradi transakci.
5. Az po vyslovnem schvaleni vlastnikem spustte `npm run activate:moderator-v2:polygon`. Po kazde transakci overte potvrzeni, pause stavy a vsechny upstream reference. Pokud se beh zastavi uprostred, pred opakovanim udelejte novy read-only snapshot.
6. Aktualizujte deployment manifesty a konfiguraci aplikace podle potvrzeneho on-chain stavu a otestujte cteni Moderatoru, tydenni vyporadani, claimy a dorucovani Drip odmen.

## Zdrojove soubory

- Implementace V2: `biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/ModeratorCenterV2.sol`
- Sparovana implementace Drip: `biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiDripLMToModeratorV2.sol`
- Kanonicke adresy: `biggi-project/bekend/addresses.master.json` a `biggi-project/bekend/reports/moderator-v2-deployment-polygon.json`
- Kontroly konfigurace a aktivace: `biggi-project/bekend/scripts/master/configureModeratorV2.js` a `biggi-project/bekend/scripts/master/activateModeratorV2.js`
- Predchozi datovany readiness report: `reports/moderator-v2-readiness-2026-09-09.md`
- Doklad o V2 ctecim rozhrani Moderator Tools: `reports/moderator-tools-2026-09-09.md`
