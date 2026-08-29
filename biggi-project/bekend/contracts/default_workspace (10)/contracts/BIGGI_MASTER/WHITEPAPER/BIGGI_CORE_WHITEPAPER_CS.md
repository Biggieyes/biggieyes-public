# Technický whitepaper BIGGI CORE

- Verze: 1.0
- Jazyk: čeština
- Síť: Polygon PoS mainnet (`chainId 137`)
- Snapshot stavu: 2026-08-27, ověřeno do Polygon bloku `92774843`

## 1. Rozsah a stav dokumentu

Tento dokument popisuje nasazený BIGGI NFT CORE: kapitoly, tickety, VRF reveal,
spárované Public kolekce, cenovou mechaniku barev očí a pozadí, Collection
Rewards, Token Rewards, NFT rewards, metadata, platební routing a administrativní
pravomoci.

Jde o technický popis, nikoli nabídku, ocenění, investiční příslib ani garanci
odměn. Ceny na marketplace určují účastníci trhu. Některé níže popsané parametry
může měnit owner. Aktuální owner je
`0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`; budoucí převod na Safe/multisig
je provozní cíl, nikoli dokončený stav tohoto snapshotu.

## 2. Model systému

BIGGI je škálovatelný systém kapitol. Jednu kapitolu tvoří:

1. jedna VRF kolekce o 550 kusech (`BiggiMain`),
2. jedna volitelná Public kolekce o 100 kusech (`BiggiMain2`),
3. záznam kapitoly v `BiggiSeriesRegistry`,
4. vazby pro spuštění a cenu v `BiggiChapterController`,
5. jeden sdílený chapter-aware `BiggiTicketHub`.

Registry umožňuje přidávat další série a kapitoly. Rozšíření není automatické:
každý nový pár se musí nasadit, registrovat, nakonfigurovat, naplnit metadaty,
ověřit, případně financovat a aktivovat přes launch gate.

### 2.1 Registrované kapitoly

| Kapitola | Série | VRF kolekce | Public kolekce | Stav |
| ---: | --- | --- | --- | --- |
| 1 | Original BIGGI / `BIGGI MASTER Core Launch` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` | `0xe56cC0657A89daf10994204eD745985a61b0E36F` | neaktivní |
| 2 | Universe | `0x5Bec5aeE4Ff8b1B5e7CBddcEEC61555354002036` | `0x7EaB23497085cfF00Cb2E9809b2Af0e717187356` | neaktivní |
| 3 | Mutant | `0x72e6DE66f340E0243DAF45917E7Ce8057Faeedc2` | `0xda6A6f45053796d0f5edB965fe3FA47B9a35460c` | neaktivní |
| 4 | Apocalipse | `0x8E862D9071120D69517D3F7Db0c101175E911115` | `0xecE7D61AB3FB2229C39B48380D704183532fE960` | neaktivní |
| 5 | Super Hero | `0xCA09F0b1f06AD3aA2302ED40Cb12013B84b52B38` | `0x99f049279BC545469F989d8f06CD915ef4B6f1d4` | neaktivní |

On-chain Registry nyní eviduje pět sérií a pět kapitol. Každá kapitola má již
vyraženo 50 marketingových ticketů, celkem tedy 250. Marketingový ticket je
převoditelný i během neaktivní kapitoly, ale nelze jej redeemovat, dokud není
jeho kapitola explicitně aktivní.

## 3. Životní cyklus ticketu

Každá kapitola má přesně 550 ticketů:

- 50 marketingových ticketů,
- 500 placených ticketů,
- přímý placený mint je povolen pouze tehdy, když odesílatel aktuálně drží méně
  než 10 ticketů dané kapitoly. Do tohoto zůstatku se počítají marketingové i
  placené tickety; sekundární převody zůstatek aktualizují, ale neomezují počet
  ticketů, které může přijímající peněženka držet.

Sdílený TicketHub přiděluje nepřekrývající se rozsahy tokenů:

| Kapitola | ID marketingových ticketů | ID placených ticketů | Celý rozsah |
| ---: | --- | --- | --- |
| 1 | `1-50` | `51-550` | `1-550` |
| 2 | `551-600` | `601-1100` | `551-1100` |
| 3 | `1101-1150` | `1151-1650` | `1101-1650` |
| 4 | `1651-1700` | `1701-2200` | `1651-2200` |
| 5 | `2201-2250` | `2251-2750` | `2201-2750` |

Běžný postup je:

1. uživatel mintne nebo získá ticket dané kapitoly;
2. ticket uchovává kapitolu a snapshot ceny ticketu;
3. po aktivaci kapitoly owner ticketu zavolá `redeemTicket` a ticket se spálí;
4. TicketHub zavolá VRF kolekci příslušné kapitoly;
5. `BiggiVrfRouter` požádá Chainlink VRF o náhodnost;
6. callback vybere jednu dosud nemintnutou pozici z matice 550 položek;
7. finální NFT se mintne uživateli, který ticket redeemoval.

Ticket se spálí před VRF requestem. Jeden uživatel může mít v jedné VRF kolekci
nejvýše jeden čekající mint. Zpožděný nebo neúspěšný request lze opakovat po
nastavené lhůtě, aktuálně 15 minutách.

## 4. Cenová křivka placeného ticketu

Aktuální cena před prvním placeným mintem je `500 POL`. Marketingové tickety
mají uložený snapshot `1 POL` a placenou cenovou křivku neposunuly.

Po každém placeném mintu, v nativním POL i v BIGGI, TicketHub aktualizuje cenu
pomocí celočíselné aritmetiky:

```text
P(0)   = aktuální TicketHub ticketPrice
P(n+1) = floor(P(n) * 10033 / 10000)
```

Poměr `10033 / 10000` znamená zvýšení o `0,33 %` po každém placeném mintu.
Kupující platí `P(n)` a další kupující vidí `P(n+1)`. Výpočet probíhá v nejmenší
jednotce a každý krok se zaokrouhluje dolů.

### 4.1 Globální, nikoli samostatná křivka kapitoly

`ticketPrice` a `priceIncreasePerMint` jsou jediné globální proměnné TicketHubu.
Při otevření nové kapitoly se automaticky neresetují. Proto:

- placený mint v kterékoli kapitole posouvá stejnou globální křivku;
- další kapitola přebírá tehdejší globální cenu, pokud ji owner explicitně
  nezmění;
- owner může změnit aktuální cenu i násobitel růstu.

Při nezávazném předpokladu, že se všech 500 placených ticketů Kapitoly 1 koupí
za nativní POL, owner cenu nezmění a křivka začne na `500 POL`, aktuální auditní
skript vypočítá přibližně:

- celkový objem placených ticketů: `635 280,928774928937197257 POL`;
- další globální cenu po 500 placených mintech:
  `2 596,427064957265492499 POL`.

Jde o deterministickou projekci křivky, nikoli záruku příjmů, poptávky nebo
prodejní hodnoty.

Platba v BIGGI používá ownerem nastavitelný parametr `biggiPerEth`. Nejde o
cenový oracle. Při aktuální hodnotě `1e18` je číselné množství BIGGI stejné jako
cena vyjádřená v POL, ale tím nevzniká tržní parita BIGGI a POL.

## 5. Matice 550 NFT podle barvy očí

Každá VRF kapitola používá stejnou strukturální matici. Má deset bloků podle
barvy očí, deset hodnot `mainId` v každém bloku a klesající počet povolených
pozadí.

Pro blok očí `e` v rozsahu `1..10` platí:

```text
rozsah mainId             = 10 * (e - 1) + 1  až  10 * e
počet pozadí na mainId    = 11 - e
počet NFT v bloku očí     = 10 * (11 - e)
```

Pozice matice 550 NFT se mapují na token ID hlavních NFT `1001-1550`. Jedno
`mainId` se záměrně opakuje pro každé povolené pozadí; globální unikátnost
`mainId` proto není invariant.

| Blok očí | Barva očí | Main ID | Povolené kódy pozadí | Počet NFT | Počáteční/aktuální cena před revealem | Token Reward jednotky | Postava za dokončení |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | Orange | `1-10` | `1-10` | 100 | `100 POL` | 10 | Cosmonaut (`2001`) |
| 2 | Black | `11-20` | `1-9` | 90 | `200 POL` | 20 | Snowman (`2002`) |
| 3 | White | `21-30` | `1-8` | 80 | `300 POL` | 30 | Bugs (`2003`) |
| 4 | Brown | `31-40` | `1-7` | 70 | `400 POL` | 40 | Pig (`2004`) |
| 5 | Blue | `41-50` | `1-6` | 60 | `500 POL` | 50 | Mickey (`2005`) |
| 6 | Green | `51-60` | `1-5` | 50 | `600 POL` | 60 | Santa (`2006`) |
| 7 | Violet | `61-70` | `1-4` | 40 | `700 POL` | 70 | Woody (`2007`) |
| 8 | Red | `71-80` | `1-3` | 30 | `800 POL` | 80 | Buzz (`2008`) |
| 9 | Pink | `81-90` | `1-2` | 20 | `900 POL` | 90 | Bart (`2009`) |
| 10 | Rainbow | `91-100` | `1` | 10 | `1 000 POL` | 100 | Homer (`2010`) |

Počáteční hodnoty v tabulce jsou současně živé hodnoty Kapitoly 1 v tomto
snapshotu, protože zatím nebylo revealováno žádné VRF NFT. Nejsou neměnné:
owner každé VRF kolekce může aktuální cenu bloku nastavit.

Minter, jehož reveal doplní poslední chybějící NFT v daném bloku očí, obdrží
jediné NFT postavy příslušného bloku. Výsledek závisí na pořadí revealů a postava
se v každém bloku udělí pouze jednou.

## 6. Přesná mechanika pozadí a cen bloků

Kódy pozadí používají stejný barevný index jako bloky očí:

| Kód | Barva pozadí | Trvalé zvýšení stejně barevného bloku očí | Jednorázový bonus revealovaného NFT | Výskyt v kompletní matici 550 |
| ---: | --- | ---: | ---: | ---: |
| 1 | Orange (`O`) | 5 % | 5 % | 100 |
| 2 | Black (`B`) | 2 % | 10 % | 90 |
| 3 | White (`W`) | 2 % | 15 % | 80 |
| 4 | Brown (`BR`) | 3 % | 20 % | 70 |
| 5 | Blue (`BL`) | 3 % | 25 % | 60 |
| 6 | Green (`G`) | 4 % | 30 % | 50 |
| 7 | Violet (`V`) | 4 % | 35 % | 40 |
| 8 | Red (`R`) | 5 % | 40 % | 30 |
| 9 | Pink (`P`) | 5 % | 45 % | 20 |
| 10 | Rainbow (`RB`) | 10 % | 50 % | 10 |

### 6.1 Pravidlo provedené při každém VRF revealu

Označme `e` blok barvy očí revealovaného NFT a `b` jeho barvu pozadí. `C[j]` je
aktuální cena bloku očí `j`, `I[b]` je trvalé zvýšení daného pozadí a `F[b]` je
jednorázový bonus do `finalPrice`.

```text
C[b] := C[b] + floor(C[b] * I[b] / 100)
B     := C[e]                       // čte se až po zvýšení výše
V     := B + floor(B * F[b] / 100)
```

Hlavní pravidlo je:

> Barva pozadí kdekoli v jedné VRF kolekci zvýší aktuální cenu bloku očí stejné
> barvy, vždy o procento nastavené pro dané pozadí.

Například červené pozadí na NFT s bílýma očima zvýší cenu červeného bloku očí,
nikoli cenu bílého bloku. Cenové stavy jsou oddělené pro každou VRF kapitolu;
reveal v Universe nemění ceny v Originals.

Pokud `e == b`, blok se nejprve zvýší a hodnota NFT se vypočítá již z této
zvýšené ceny. Pokud `e != b`, zvýší se blok odpovídající pozadí a NFT použije
nezměněnou aktuální cenu svého vlastního bloku očí.

`B` se uloží jako `blockPrice` a `V` jako `finalPrice`. `finalPrice` je on-chain
výpočtový snapshot revealovaného NFT. Při redeemu se neplatí, není marketplace
floor a není garantovaným oceněním.

### 6.2 Platné příklady z matice

**Bílé oči + červené pozadí při počátečních cenách**

```text
Červený blok:  800 -> 840 POL          (trvalé zvýšení Red o 5 %)
Bílý blok:     zůstává 300 POL
finalPrice:    300 + 40 % = 420 POL    (bonus červeného pozadí)
```

Bílé oči povolují pozadí `1-8`, proto je tato kombinace platná.

**Modré oči + modré pozadí při počátečních cenách**

```text
Modrý blok:    500 -> 515 POL          (trvalé zvýšení Blue o 3 %)
finalPrice:    515 + 25 % = 643,75 POL (výpočet až po zvýšení)
```

### 6.3 Teoretické konečné ceny bloků

Každá pozice matice je unikátní a počet jednotlivých pozadí je pevný. Po revealu
všech 550 NFT proto vzniknou následující konečné aktuální ceny, pokud je owner
ručně nezmění. Hodnoty zahrnují stejné zaokrouhlení při každém násobení jako
kontrakt:

| Blok očí | Počet zvýšení odpovídajícím pozadím | Konečná aktuální cena |
| --- | ---: | ---: |
| Orange | 100 x 5 % | `13 150,125784630345501716 POL` |
| Black | 90 x 2 % | `1 188,626625261089334182 POL` |
| White | 80 x 2 % | `1 462,631746828916894557 POL` |
| Brown | 70 x 3 % | `3 167,128764848694588592 POL` |
| Blue | 60 x 3 % | `2 945,801552022868342684 POL` |
| Green | 50 x 4 % | `4 264,010007766983247771 POL` |
| Violet | 40 x 4 % | `3 360,714439555655191651 POL` |
| Red | 30 x 5 % | `3 457,553900120529607314 POL` |
| Pink | 20 x 5 % | `2 387,967934629978120546 POL` |
| Rainbow | 10 x 10 % | `2 593,742460100000000000 POL` |

Jde o projekci interního stavu protokolu, ne o předpověď tržních cen. Ruční
změna ceny ownerem změní další vývoj.

## 7. Náhodný výběr a recovery

Standardní index revealu je:

```text
requestedIndex = (randomWord mod 550) + 1
```

Pokud je pozice již mintnutá nebo neplatná, kontrakt cyklicky pokračuje dopředu,
dokud nenajde další platnou nemintnutou pozici. Tím zabrání duplicitnímu mintu;
pozdní revealy však po prvním VRF výsledku vybírají ze zbytku deterministickým
fallbackem.

Kontrakt současně nabízí owner-only funkci
`emergencyResolvePendingMint(user, preferredIndex)`. Vyžaduje existující pending
mint, ale owner může určit preferovaný index matice a funkce nevynucuje běžnou
čekací lhůtu. To je podstatný trust předpoklad: současný kontrakt nelze popsat
tak, že zcela znemožňuje administrativní ovlivnění čekajícího výsledku.
V produkci má tuto pravomoc chránit Safe/multisig a zveřejněná emergency policy.
Její odstranění nebo timelock vyžaduje nový deploy, protože kolekce není
upgradeovatelná.

## 8. Spárovaná Public kolekce

Každá Public kolekce obsahuje 100 volitelných NFT:

- deset unikátních `mainId` v každém bloku očí;
- žádné klony podle pozadí;
- jeden společný štítek pozadí `PUBLIC`;
- token ID `1001-1100` uvnitř daného Public ERC-721 kontraktu.

Public mint nemá vlastní základní cenovou řadu `100-1000 POL`. Pro blok očí
vybraného NFT čte `BiggiMain2` aktuální cenu přímo ze své spárované VRF kolekce
přes `BiggiChapterController`.

```text
Cena Public mintu = aktuální cena bloku očí v párové VRF kolekci
Public blockPrice = Public finalPrice = tato cena
```

Public mint nespouští zvýšení podle pozadí a nemění ceny párové VRF kolekce.

Public mint se odemkne pouze tehdy, když stejná kapitola splní vše následující:

- `saleMinted == 500`,
- `marketingMinted == 50`,
- `totalMinted == 550`,
- registrovaný VRF/Public/TicketHub stack a limity jsou konzistentní.

Public kontrakt musí být také unpaused. V tomto snapshotu jsou metadata Originals
Public konzistentní `100/100`, ale kontrakt je paused a kapitola neaktivní, takže
je Public mint zamčený.

## 9. Tok plateb

### 9.1 Mint za nativní POL

TicketHub i Public mint odešlou pouze přesně účtovanou cenu a přeplatek vrátí.
Účtovaná cena se rozdělí:

| První příjemce | Podíl z ceny mintu |
| --- | ---: |
| MultiCollectionDistributor | 60 % |
| Dev wallet | 40 % |

Distributor rozdělí svůj 60% podíl:

| Příjemce Distributoru | Podíl z příjmu Distributoru | Efektivní podíl z celého mintu |
| --- | ---: | ---: |
| Collection Rewards | 25 % | 15 % |
| Reserve | 35 % | 21 % |
| Buyback Agent | 20 % | 12 % |
| Treasury | 10 % | 6 % |
| Community Center | 10 % | 6 % |

Zbytek po celočíselném zaokrouhlení dostane Treasury. Pokud downstream volání
selže, Distributor částku uloží do chráněného pending zůstatku pro opakování;
částka se bez evidence nestane volnými prostředky.

### 9.2 Mint placený v BIGGI

Aktuální token sink je Treasury s `tokenSinkBps = 10000` a aktivním deposit mode.
Proto 100 % BIGGI zaplacených přes TicketHub nebo Public mint jde do Treasury a
fail-closed se rozdělí:

| Cíl | Podíl BIGGI |
| --- | ---: |
| Token Rewards | 34 % |
| Reserve | 33 % |
| DripDistributor | 33 % |

Všechny tři cíle musí být nastavené, jinak platba revertne. Minty placené v
BIGGI neposílají nativní POL do Collection Rewards.

## 10. Collection Rewards a motivace obchodovat

Collection Rewards se vztahují pouze na registrované VRF kolekce. Public kolekce
jsou záměrně vyloučené. Po nakonfigurování rozpočtů kolekcí je odměnový plán
uzamčený:

| Výzva | Vlastnictví požadované při claimu | Globální počet výherců v jedné VRF kapitole | Odměna |
| --- | --- | ---: | ---: |
| Orange set | všech 10 pozadí pro jedno `mainId` v Orange bloku (`1-10`) | jeden pro každé `mainId`, max. 10 | `1 000 POL` |
| Block set | všech deset různých `mainId` v jednom bloku `1-9`, libovolná pozadí | jeden pro každý blok, max. 9 | `3 000 POL` |
| Rainbow set | všech deset různých `mainId` v bloku 10 | jeden | `10 000 POL` |

Maximální nativní závazek jedné VRF kapitoly je:

```text
10 * 1 000 + 9 * 3 000 + 1 * 10 000 = 47 000 POL
```

Každá kapitola má izolovaný rozpočet. Claimy se automaticky povolí, až funded
částka dané kapitoly dosáhne `47 000 POL`. Rozpočet se plní efektivním 15% podílem
z nativních mintů přiřazených aktuální `fundingCollection`, případně přímou
platbou přes `fundCollectionBudget`. Před financováním další kapitoly musí
provozní postup přepnout `fundingCollection` na její VRF kolekci.

Při claimu kontrakt ověřuje aktuální ERC-721 vlastnictví. Sběratel může chybějící
části mintnout, získat převodem nebo koupit na sekundárním trhu. Tím vzniká
záměrná motivace skládat sety a jednotlivá pozadí a `mainId` získávají kombinovanou
užitnou hodnotu. Nejde však o záruku likvidity ani zisku:

- každý konkrétní cíl lze vyplatit pouze jednou globálně v dané VRF kapitole;
- první platný claim spotřebuje odměnu cíle;
- rozpočet kapitoly musí být již povolený;
- claimant platí gas;
- získání setu může stát více než odměna;
- dostupnost a ceny na marketplace jsou mimo protokol.

Na Polygon bloku `92774712` bylo všech pět rozpočtů nakonfigurováno, ale každý měl
`0 POL` funded, požadavek `47 000 POL` a vypnuté claimy. Souhrnná maximální
zbývající odpovědnost byla `235 000 POL`; nejde o aktuálně splatný dluh, protože
claimy zůstávají samostatně zamčené pro každou kapitolu.

## 11. Token Rewards a NFT Rewards

### 11.1 Týdenní BIGGI Token Rewards

Způsobilé jsou VRF i Public kolekce ve všech registrovaných kapitolách. Tickety
v TicketHubu způsobilé nejsou.

- claim stav se sleduje pro kombinaci kolekce, token ID a EVM týdne;
- při claimu se ověřuje aktuální vlastník;
- převod neumožní stejnému tokenu claimnout podruhé ve stejném týdnu;
- bloky očí mají `10, 20, ..., 100` jednotek pro bloky `1-10`;
- výplata nejprve používá BIGGI zůstatek Token Rewards;
- preventivní funding zajišťuje nasazený `BiggiSupplyController`. Sleduje
  zůstatek Token Rewards a při poklesu pod `5 000 000 BIGGI` může přes
  `BiggiToken.mintToTokenRewards` doplnit `200 000 000 BIGGI`, s cooldownem 12
  hodin, v rámci `500 000 000 BIGGI` Guardian Rewards rámce a globálního capu;
- nasazený `BiggiSupplyGuardian` je registrovaný v tokenu, ukazuje na Supply
  Controller a je na Controlleru povoleným callerem. Jeho owner může spustit
  ruční maintenance nebo ruční rewards refill; automatické provedení refillu
  stále vyžaduje autorizovaného keepera nebo CRE execution;
- kontrakt obsahuje přímou fallback větev pro nedostatek zůstatku, která volá
  `BiggiToken.mint`, tato funkce tokenu je však pouze pro ownera a Token Rewards
  není aktuálním ownerem tokenu. Tato fallback větev proto nyní není funkční a
  claim by se revertoval pouze tehdy, kdyby se zůstatek vyčerpal dříve, než se
  provedla preventivní refill transakce;
- aktivní emission controller může výchozí hodnotu `1 BIGGI za jednotku` snížit
  podle týdenního rozpočtu, ale nemůže ji zvýšit nad tento výchozí limit.

Ve snapshotu měl inicializovaný týden rozpočet `50 000 BIGGI` a sazbu
`0,5 BIGGI` za jednotku. Jde o dynamický týdenní stav, nikoli trvalou sazbu.

### 11.2 NFT Rewards

`BiggiNftRewards` je samostatný ERC-721 odměnový systém. Jeho aktuálně dosažitelné
produkční větve jsou manuální odměny vytvořené ownerem a vítězové mystery eventů
vybraní přes VRF z unikátního seznamu způsobilých adres. Přiřazený uživatel mintne
odměnové NFT voláním `claim(rewardId)`.

Nasazený kontrakt obsahuje také `createCharacterReward`, ale tuto funkci smí volat
jen povolená kolekce a aktuální kontrakty `BiggiMain` ani `BiggiMain2` ji nevolají.
Deset character NFT za dokončení bloků mintuje přímo každý `BiggiMain`; jde o
oddělenou mechaniku. Owner-only nouzové dokončení mystery eventu může určit výsledek
bez on-chain vynuceného timeoutu. Do nasazení hardenované verze NFT Rewards proto
zůstává explicitní důvěryhodnostní hranicí ownera.

## 12. Integrita metadat a herního stavu

Herně kritická data jsou pro každou pozici uložená on-chain:

- `blockIdx` neboli barva očí,
- `background`,
- `mainId`,
- minted stav,
- snapshot ceny ticketu,
- snapshot ceny bloku,
- snapshot `finalPrice`.

Obrázky a prezentační JSON používají URI/IPFS. Obrázek ani trait na marketplace
nepřepisuje on-chain herní stav. Před aktivací musí každá kapitola projít úplnou
kontrolou matice:

- VRF: `configuredCount == 550`, `fullyConfigured == true` a
  `rewardMatrixConsistent == true`;
- Public: `configuredCount == 100`, `fullyConfigured == true` a konzistentní
  Public matice;
- finální obrázky a JSON URI musí být pro danou kapitolu připnuté a otestované.

Originals VRF nyní prochází `550/550`; Originals Public prochází `100/100`.
Budoucí kapitoly zachovávají stejná strukturální pravidla, ale nesmí se aktivovat,
dokud neprojdou jejich finální média a URI.

## 13. Bezpečnostní a governance hranice

Implementované kontroly zahrnují reentrancy guard na hodnotově citlivých cestách,
chapter-bound vazby TicketHubu, kontroly limitů, pause mechanismy, VRF allowlist,
validaci metadat, izolované rozpočty Collection Rewards a pending accounting při
selhání forwardu z Distributoru.

Podstatné pravomoci ownera zahrnují:

- pause/unpause kontraktů a aktivaci kapitol;
- změnu ceny ticketu a násobitele růstu;
- změnu aktuálních cen VRF bloků;
- změnu konverze BIGGI, příjemců plateb a modulů routingu;
- změnu URI a seed metadat před mintem;
- změnu způsobilosti v Registry a cíle financování Collection Rewards;
- nouzové vyřešení pending VRF mintu popsanou funkcí;
- rescue aktiv tam, kde kontrakt rescue funkci nabízí.

Tyto pravomoci nejsou hypotetické. Kontrakty nejsou upgradeovatelné proxy:
konfigurace mění nasazený kontrakt, ale změna kódu vyžaduje redeploy a migraci.
Ověřený source a procházející testy zvyšují transparentnost, ale nejsou externím
bezpečnostním auditem ani formální verifikací.

## 14. Aktuální stav spuštění

Read-only kontroly v tomto snapshotu ukazují:

- kontrola CORE vazeb prošla bez nesouladu;
- Chapter 1 VRF minted: `0/550`;
- Chapter 1 tickety: `50` marketingových, `0` placených;
- všech deset cen Chapter 1 zůstává `100-1000 POL`;
- TicketHub je unpaused, ale všechny kapitoly neaktivní;
- Originals Public je paused a locked;
- VRF subscription má `2 POL` nativní balance, Router je autorizovaný consumer
  a počet requestů je nula;
- všech pět Collection Rewards rozpočtů je nakonfigurovaných a zamčených na
  `0/47 000 POL`;
- launch preflight: `okForDeployOnly = true`, `okForPublicLaunch = false`, 11
  očekávaných předstartovních blokátorů a 2 warnings.

Neaktivní stav je záměrný. Nasazený kontrakt ani předmintnutý marketingový ticket
neznamená, že je veřejný prodej nebo redeem aktivní.

## 15. Kanonické CORE adresy

| Komponenta | Adresa |
| --- | --- |
| Series Registry | `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058` |
| Chapter Controller | `0x9c084D89c0CB6c8424652d1fa82E83aD9c098288` |
| Sdílený TicketHub | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| Compute | `0x0A09261631496B4aad9A5c2A82b62666249d773f` |
| VRF Router | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| Originals VRF | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| Originals Public | `0xe56cC0657A89daf10994204eD745985a61b0E36F` |
| MultiCollectionDistributor | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| Collection Rewards | `0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43` |
| Token Rewards | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| NFT Rewards | `0x939Df533b80943298E15ad4c8F188102954f34FF` |

Kanonická adresní data zůstávají v `biggi-project/bekend/addresses.master.json`.

## 16. Reprodukovatelné ověření

Ze složky `biggi-project/bekend`:

```bash
npm run check:master:core:polygon
npm run audit:collection-rewards:polygon
npm run preflight:launch:polygon
npm run check:master:polygon
```

Primární zdrojové kontrakty:

- `CORE/BiggiTicketHub.sol`
- `CORE/BiggiMain.sol`
- `CORE/BiggiMain2.sol`
- `CORE/BiggiCompute.sol`
- `CORE/BiggiSeriesRegistry.sol`
- `CORE/BiggiChapterController.sol`
- `CORE/BiggiCollectionRewards.sol`
- `CORE/BiggiTokenRewards.sol`
- `CORE/BiggiNftRewards.sol`
- `CORE/BiggiMultiCollectionDistributor.sol`

Každá pozdější změna konfigurace nebo deploymentu musí aktualizovat verzi a
snapshot tohoto dokumentu.
