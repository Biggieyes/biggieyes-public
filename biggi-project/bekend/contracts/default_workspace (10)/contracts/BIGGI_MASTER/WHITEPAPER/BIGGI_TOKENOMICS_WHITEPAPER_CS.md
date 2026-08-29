# Technický whitepaper BIGGI tokenomiky

- Verze: 1.0
- Jazyk: čeština
- Síť: Polygon PoS mainnet (`chainId 137`)
- Snapshot stavu: 2026-08-27, ověřeno do Polygon bloku `92774843`

## 1. Rozsah a interpretace

Tento dokument popisuje nasazený systém BIGGI tokenomiky a jeho napojení na
příjmy z NFT mintů. Zahrnuje supply BIGGI, tok nativních a tokenových plateb,
Collection Rewards, týdenní Token Rewards, Reserve, buyback, drip, likviditu,
ochranu supply, Community a Moderator alokace, automatizaci Chainlink CRE,
governance pravomoci a aktuální předstartovní stav.

Jde o technický popis, nikoli finanční radu nebo příslib ceny, zisku, likvidity,
provedení buybacku, dostupnosti odměn či poptávky na marketplace. „Aktuální“
hodnoty jsou ownerem nastavitelné hodnoty přečtené z Polygonu v datu snapshotu.
Kontrakt a pozdější on-chain transakce mají přednost.

## 2. Ekonomická architektura

Nativní příjem z NFT mintu zásobuje šest prvotních cílů:

```text
TicketHub / Public mint
          |
          +-- 40 % -> Dev wallet
          |
          +-- 60 % -> MultiCollectionDistributor
                         |
                         +-- 25 % -> Collection Rewards
                         +-- 35 % -> Reserve
                         +-- 20 % -> Buyback Agent
                         +-- 10 % -> Treasury
                         +-- 10 % -> Community Center
```

Platba v BIGGI používá samostatnou tokenovou cestu:

```text
TicketHub / Public mint
          |
          +-- 100 % BIGGI -> Treasury
                               |
                               +-- 34 % -> Token Rewards
                               +-- 33 % -> Reserve
                               +-- 33 % -> DripDistributor
```

Tyto dva toky se nesmí zaměňovat. Zejména minty placené v BIGGI nefinancují
nativní POL rozpočty Collection Rewards.

## 3. Supply BIGGI tokenu

`BiggiToken` je ERC-20 s 18 desetinnými místy, permit, burn, pause a globálním
hard capem `2 200 000 000 BIGGI`.

### 3.1 Dokončená počáteční distribuce

Jednorázová počáteční distribuce mintnula `1 200 000 000 BIGGI`:

| Cíl | Počáteční BIGGI | Podíl počáteční supply | Podíl hard capu |
| --- | ---: | ---: | ---: |
| Reserve | 600 000 000 | 50,00 % | 27,27 % |
| DripDistributor | 200 000 000 | 16,67 % | 9,09 % |
| Token Rewards | 200 000 000 | 16,67 % | 9,09 % |
| Marketing Support | 200 000 000 | 16,67 % | 9,09 % |
| **Celkem** | **1 200 000 000** | **100,00 %** | **54,55 %** |

Ve snapshotu živé zůstatky stále zahrnují `600 000 000 BIGGI` v Reserve,
`200 000 000 BIGGI` v DripDistributor a `200 000 000 BIGGI` v Token Rewards.
Celková supply je `1,2 miliardy BIGGI`.

### 3.2 Omezené refill rámce

Zbývající rozdíl jedné miliardy tokenů do hard capu představují dva branch
limity:

| Refill větev | Maximální dodatečné BIGGI | Zamýšlený příjemce |
| --- | ---: | --- |
| Guardian DEX/drip refill | 500 000 000 | DripDistributor |
| Guardian Token Rewards refill | 500 000 000 | Token Rewards |

Oba branch countery jsou ve snapshotu nulové. Vyhrazené mint funkce hlídají
limit větve i globální hard cap.

### 3.3 Podstatná pravomoc ownera

Token obsahuje také obecnou owner-only funkci `mint(to, amount)`, kterou omezuje
globální cap `2,2B`, ale neodečítá se z obou guardian branch counterů. Owner může
také pozastavit převody a přes `transferFromReserveTo` přesunout tokeny ze
zamknuté adresy Reserve. „Reserve locked“ brání změně nakonfigurované adresy
Reserve po počáteční distribuci; neznamená, že zůstatek Reserve nelze přesunout.

Token je burnable a držitel může snížit aktuální total supply. Burn nesnižuje
neměnný hard cap: `remainingMintable = CAP - totalSupply`, takže burn zvýší
množství, které lze později znovu mintnout do stejného capu. BIGGI je proto
správné označovat jako cap-bounded, nikoli jako trvale deflační token.

## 4. Rozdělení nativního NFT mintu

Efektivní rozdělení celé nativní platby za mint je:

| Cíl | Efektivní podíl |
| --- | ---: |
| Dev wallet | 40 % |
| Collection Rewards | 15 % |
| Reserve | 21 % |
| Buyback Agent | 12 % |
| Treasury | 6 % |
| Community Center | 6 % |
| **Celkem** | **100 %** |

TicketHub používá chapter-aware volání Distributoru; Public kolekce se přiřazují
přes Registry. Distributor eviduje součty podle zdroje, kapitoly i série.

Všech pět downstream příjemců musí být nastavených. Neúspěšný forward se uloží
jako pending zůstatek konkrétního příjemce a lze jej opakovat. Zbytek po
celočíselném zaokrouhlení se připíše Treasury. Owner může z Distributoru vybrat
jen volný zůstatek po odečtení chráněných pending závazků.

## 5. Rozdělení platby v BIGGI

TicketHub a Public kontrakty aktuálně posílají `10000` basis points BIGGI plateb
do Treasury v deposit mode. Treasury vyžaduje allowlistovaný ecosystem caller,
tokeny si stáhne a vyžaduje konfiguraci všech tří příjemců.

| Cíl Treasury | Podíl BIGGI platby |
| --- | ---: |
| Token Rewards | 34 % |
| Reserve | 33 % |
| DripDistributor | 33 % |

Poslední podíl dostane zbytek po celočíselném zaokrouhlení. Reserve dostane
notifikaci do DEX refill účetnictví a DripDistributor zaeviduje vložený inventory.

NFT kontrakty převádějí cenu vyjádřenou v POL přes ownerem nastavitelný parametr
`biggiPerEth`. Nejde o DEX ani oracle quote. Aktuální hodnota `1e18` způsobí, že
číselné množství BIGGI odpovídá ceně vyjádřené v POL, ale nevytváří tržní paritu.

## 6. Collection Rewards jako motivace skládat a obchodovat

Collection Rewards používají nativní POL a vztahují se pouze na VRF kolekci o
550 NFT v každé kapitole. Public kolekce dostávají týdenní Token Rewards, ale z
Collection Rewards jsou záměrně vyloučené.

| Cíl setu | Počet globálně vyplatitelných cílů v jedné VRF kapitole | Odměna za cíl | Maximální závazek větve |
| --- | ---: | ---: | ---: |
| Vlastnit všech 10 pozadí jednoho Orange `mainId` | 10 | 1 000 POL | 10 000 POL |
| Vlastnit všech 10 `mainId` v jednom bloku `1-9` | 9 | 3 000 POL | 27 000 POL |
| Vlastnit všech 10 `mainId` v Rainbow bloku 10 | 1 | 10 000 POL | 10 000 POL |
| **Celkem na kapitolu** | **20 cílů** |  | **47 000 POL** |

Způsobilost se ověřuje podle aktuálního vlastnictví v okamžiku claimu. Sběratel
může chybějící části získat mintem, převodem nebo nákupem na sekundárním trhu.
Mechanika má motivovat obchodování a dokončování setů, protože pozadí a `mainId`
mají užitek v kombinaci, ne pouze samostatně.

Nejde o příslib výnosu. Každý cíl se v jedné VRF kapitole vyplatí pouze jednou
globálně, vyhrává první platný claim, rozpočet musí být aktivní, claimant platí
gas a pořízení setu může stát více než odměna.

Každá kapitola má izolovaný rozpočet `47 000 POL` a claimy se automaticky
odemknou až při plném krytí. Nativní minty přispívají efektivními 15 %, pokud je
jejich kapitola nastavená jako `fundingCollection`; možný je i explicitní vklad.
Minty placené v BIGGI nepřispívají žádným POL.

Při úzkém modelovém předpokladu 500 nativních placených ticketů, počáteční ceny
`500 POL`, opakovaného růstu `0,33 %` a žádné změny konfigurace dosáhne jedna
kapitola `47 000 POL` po 341 nativních mintech a skončí přibližně s
`95 292,139316239340579355 POL` přiřazenými Collection Rewards. Skutečný okamžik
mění platby v BIGGI, mix prodejů, konfigurace ownera a chapter routing.

Na Polygon bloku `92774712` bylo nakonfigurováno všech pět chapter rozpočtů, ale
každý byl na `0/47 000 POL`; všechny claimy byly správně zamčené.

## 7. Týdenní BIGGI Token Rewards

Token Rewards se vztahují na registrované VRF i Public kolekce. Tickety z
TicketHubu způsobilé nejsou. Jednotky podle bloku očí jsou:

| Blok očí | Jednotky za NFT a způsobilý týden |
| ---: | ---: |
| 1-10 | `10, 20, 30, 40, 50, 60, 70, 80, 90, 100` |

Kontrakt kontroluje aktuální vlastnictví a pro každou kolekci a token ID ukládá
poslední claimnutý EVM týden. Převod NFT neresetuje týdenní claim stav tokenu.

Token Rewards nejprve vyplácí ze svého BIGGI zůstatku. Preventivní funding cestou
je nasazený Supply Controller: pod nastaveným prahem může volat
`BiggiToken.mintToTokenRewards` v rámci Guardian Rewards a globálního capu.
Supply Guardian je autorizovaný, ownerem ovládaný helper tohoto Controlleru.
Přímá fallback větev uvnitř Token Rewards místo toho volá owner-only funkci
`BiggiToken.mint`; protože Token Rewards není aktuálním ownerem tokenu, tato
větev není funkční. Claim se proto revertuje, pokud se zůstatek vyčerpá dříve,
než proběhne preventivní maintenance. Původní výchozí sazba je `1 BIGGI` za
jednotku, ale aktivní emission controller ji může jen snížit podle týdenního
rozpočtu.

### 7.1 Týdenní emission controller

Aktuální konfigurace:

| Parametr | Hodnota |
| --- | ---: |
| Cílové týdenní jednotky | 100 000 |
| Minimální budget při nulovém inflow | 50 000 BIGGI |
| Weak budget při kladném inflow pod 10 000 | 100 000 BIGGI |
| Normal budget při inflow alespoň 10 000 | 500 000 BIGGI |
| Strong budget při inflow alespoň 200 000 | 1 000 000 BIGGI |
| Emergency-mode budget | 25 000 BIGGI |
| Maximální týdenní budget | 1 000 000 BIGGI |
| Limit podle zůstatku | 1 % z Token Rewards balance |

Controller sleduje týdenní nárůst Treasury účetnictví pro BIGGI z buybacku a
ecosystem plateb. Vybere úroveň, omezí ji maximem a jedním procentem zůstatku
Token Rewards a nastaví:

```text
týdenní odměna za jednotku = týdenní budget / 100 000 cílových jednotek
částka claimu               = min(jednotky * týdenní sazba,
                                  jednotky * legacy sazba)
```

Pokud by claim překročil zbývající týdenní budget, revertne namísto částečného
spotřebování claim stavu tokenu. Ve snapshotu měl týden `2956` nulový pozorovaný
inflow, `200M BIGGI` balance Token Rewards, budget `50 000 BIGGI`, vyplaceno nula
a sazbu `0,5 BIGGI` za jednotku.

## 8. Buyback větev

Buyback Agent dostává 20 % příjmu Distributoru, tedy 12 % celé nativní platby za
mint. Nakonfigurovaná cesta na QuickSwap V2 je:

```text
POL -> WPOL -> BIGGI
```

Aktuální policy parametry:

| Parametr | Hodnota |
| --- | ---: |
| Limit slippage swapu | 5 % (`500 bps`) |
| Deadline transakce | 600 sekund |
| Minimální interval | 300 sekund |
| Denní nativní kvóta | `0` (tímto nastavením neomezená) |
| Threshold buyback upkeep | 0,5 POL |

Po úspěšném swapu se všechna získaná BIGGI povolí Treasury a rozdělí
`34 % / 33 % / 33 %` mezi Token Rewards, Reserve a DripDistributor. Tokeny se
nepálí. Buyback je tedy recirkulační mechanismus, nikoli trvalé snížení supply
nebo záruka ceny.

Pokud automatický quote nebo swap nelze dokončit, nativní částka se pošle do
Treasury jako explicitně evidovaný fallback. Po úspěšném buybacku Agent
notyfikuje Drip. Selhání Dripu je záměrně non-blocking a dokončený buyback
nevrátí.

Ve snapshotu není samotný Agent paused, ale automatický buyback je vypnutý a
`BuybackUpkeepProxy` je paused. Nebyl utracen žádný native ani získáno žádné
BIGGI.

## 9. Zpětnovazební Drip

Drip je opačný tok spuštěný úspěšným buybackem. Neběží jako samostatná povinná
periodická CRE úloha.

```text
úspěšný buyback získá X BIGGI
          |
          +-- Treasury recirkuluje všech X BIGGI (34/33/33)
          |
          +-- Buyback Agent nahlásí X do DripLM
                         |
                         +-- cílový prodej = 70 % z X
                         +-- podle potřeby vezme inventory z DripDistributor
                         +-- prodá BIGGI -> POL na QuickSwap
                         +-- 50 % POL -> Reserve
                         +-- 50 % POL -> Moderator Center
```

Prodávané BIGGI pochází z Drip inventory; nejde o přímé vrácení přesně stejných
tokenových jednotek právě koupených buybackem. Skutečný prodej může být menší než
70% cíl, pokud chybí inventory, quote nebo proveditelný swap.

DripDistributor začal s `200M BIGGI` a má historický příjmový cap `700M BIGGI`,
který tvoří počátečních 200M plus Guardian DEX rámec 500M. Eviduje total received,
total claimed a dostupný inventory. Inventory může claimnout pouze nakonfigurovaný
DripLM.

Aktuální swap parametry jsou 70% cílový prodej, 2% slippage, deadline 600 sekund
a rozdělení výnosu 50/50 mezi Reserve a Moderator.

### 9.1 Živá V1 a připravená V2

Kanonické živé wiring stále používá:

- DripLM V1: `0xE258843bca54803a366413571b3B4d6a28eAF2eC`;
- Moderator V1: `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D`.

Hardened náhrady jsou nasazené a source-verified, ale nejsou aktivované:

- `BiggiDripLMToModeratorV2`:
  `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A`, paused;
- `ModeratorCenterV2`:
  `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8`, paused.

V2 zachovává selhané doručení do Reserve a Moderatoru jako oddělené pending
závazky. Wiring je připravený, ale Moderator V2 není operationally ready, protože
nejsou nakonfigurované moderatorské sloty. Samotný deploy živou větev nepřepnul.

## 10. Reserve, Liquidity Manager a LP Vault

Reserve drží nativní POL a BIGGI a vede účetní buckety `WAITING` a `DEX_REFILL`.
Strict kontrola callerů notifikací je zapnutá. Invariant vyžaduje, aby součet
účetních bucketů nepřekročil skutečný BIGGI balance.

Reserve dostává:

- 21 % z nativního NFT mintu;
- 33 % ecosystem BIGGI plateb routovaných přes Treasury;
- 33 % BIGGI nakoupených buybackem a routovaných přes Treasury;
- 50 % nativního výnosu z úspěšného Drip prodeje.

Liquidity cesta je:

```text
Reserve -> LiquidityManager -> QuickSwap addLiquidityETH -> LiquidityVault
```

Po existenci počáteční likvidity LiquidityManager odvodí množství BIGGI z poměru
poolu, stáhne obě aktiva z Reserve, použije minimální částky, přidá likviditu,
vrátí nevyužitá aktiva a synchronizuje LP účetnictví. LP tokeny se mintují přímo
do Vaultu.

Aktuální parametry:

| Komponenta | Parametr | Hodnota |
| --- | --- | ---: |
| LiquidityManager | token percentage | 100 % |
| LiquidityManager | slippage | 3 % |
| LiquidityManager | deadline | 600 sekund |
| LiquidityManager | automatic top-up | vypnutý |
| Orchestrator | POL na akci | 0,5-50 POL |
| Orchestrator | cooldown | 3 600 sekund |
| Orchestrator | denní kvóta | `0` (tímto nastavením neomezená) |
| KeeperProxy | amount mode | 5 % POL v Reserve |
| KeeperProxy | minimální interval | 900 sekund |
| KeeperProxy | minimální Reserve | 1 POL |
| KeeperProxy | maximální akce | 20 POL |

Jedinou zamýšlenou CRE liquidity cestou je `LiquidityKeeperProxy`. Legacy
`LiquidityAutomation` nesmí běžet současně.

LP Vault je governance custody, nikoli neměnný lock. LiquidityManager může podle
své role synchronizovat a vybírat, owner může povolit páry, uvolnit LP a provést
rescue aktiv. Tuto pravomoc musí chránit finální governance.

Plánovaný počáteční seed páru je `8 000 000 BIGGI + 5 000 POL`. Ve snapshotu
QuickSwap BIGGI/WPOL pár existuje, ale má rezervy `0/0` a nulovou LP supply. Před
tímto seedem nemůže smysluplně fungovat buyback, Drip swap, snapshot baseline ani
likviditní automatizace podle poměru poolu.

## 11. Ochrana supply a DEX Guard

`BiggiSupplyController` může použít omezené guardian token funkce pro dvě větve:

| Větev | Trigger/konfigurace | Refill | Cooldown |
| --- | --- | ---: | ---: |
| DEX/Drip | BIGGI rezerva páru pod 50 % baseline | 20 000 000 BIGGI | 30 minut |
| Token Rewards | balance pod 5 000 000 BIGGI | 200 000 000 BIGGI | 12 hodin |

Circuit breaker je zapnutý s critical floor `500 BIGGI` pro DEX i Token Rewards.
DEX baseline je nyní nula, protože počáteční likvidita ještě nebyla vložena a
snapshottována.

Ve snapshotu je `BiggiToken.supplyController`
`0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` a
`BiggiToken.supplyGuardian`
`0xdCA0bEda4c96eCE2E23e30f6Aa95697106d99B49`. Controller není paused. Guardian
ukazuje na tento Controller a je na něm povoleným callerem. Aktuální zůstatek
Token Rewards je `200 000 000 BIGGI`, takže refill nyní není potřeba.

`BiggiDexReserveGuard` nezávisle používá 50% poměr k baseline, refill 20M a
cooldown 30 minut. Volitelná kontrola odchylky ceny je aktuálně vypnutá; maximální
nastavená odchylka je 20 %, quote oracle není nastavený a jeho vynucení není
vyžadováno.

Pokud jsou k dispozici SupplyController i DEX Guard, automatizace musí definovat
jednu odpovědnost nebo pořadí/cooldown, který zabrání dvojitému refillu.
`BiggiSupplyGuardian` je ownerem ovládaný provozní helper: může přes Controller
vyžádat maintenance a ruční refill, ale sám nepřetržitě nesleduje stav ani
nemintuje. Autonomní provádění vyžaduje autorizovaného keepera nebo CRE caller.
CRE Receiver v tomto snapshotu ještě není pro Supply Controller autorizovaný,
což odpovídá paused prelaunch stavu.

## 12. Community a Moderator větve

`BiggiCommunityCenter` dostává efektivně 6 % z nativního mintu. Podporuje
ownerem vytvořené eventy a grants s claimovatelnými alokacemi vítězů. Částky
vyhrazené aktivním eventům se evidují jako locked závazky a nelze je vybrat jako
volný surplus.

Moderator alokace je jiná větev: dostává 50 % nativního POL vytvořeného úspěšným
Drip prodejem, nikoli 6% mint podíl Community Center.

Připravený model Moderator V2 má deset slotů, právě jednoho aktivního leadera,
unikátní referral hashe, on-chain přiřazení placených ticketů, týdenní účetnictví,
jednodenní settlement delay a pull-based claimy. Výchozí relativní koeficienty:

```text
základní koeficient leadera    = 100
základní koeficient moderátora = 30
ticket boost                   = 10 za přiřazený placený ticket
týdenní váha slotu             = unikátní buyers * (base + 10 * ticket count)
```

Placený ticket lze přiřadit pouze jednou. Chapter rozsahy se registrují z
živého TicketHubu, ověřuje se vlastnictví, marketingové tickety jsou vyloučené a
konfigurace je verzovaná, takže otevřený týden zachová historickou verzi.
Milestones mají samostatně financovaný budget. V2 zůstává paused, dokud nejsou
nastavené payout sloty, referral hashe a právě jeden leader.

## 13. Automatizace Chainlink CRE

Zamýšlený produkční workflow má pět větví:

| Větev | On-chain cíl |
| --- | --- |
| Supply | `SupplyController.performUpkeep(bytes)` |
| Buyback | `BuybackUpkeepProxy.performUpkeep(bytes)` |
| Liquidity | `LiquidityKeeperProxy.performUpkeep(bytes)` |
| DEX Guard | `DexReserveGuard.performUpkeep(bytes)` |
| Rewards Week | `TokenRewardsEmissionController.rollCurrentWeek()` |

U upkeep targetů workflow nejprve čte `checkUpkeep("0x")`. Pokud je akce
potřebná, odešle autorizovaný report přes `BiggiCREAutomationReceiver`. Receiver
ověří Keystone Forwarder, očekávané workflow ID a ownera, allowlist targetu a
selectoru a limity payloadu, teprve potom call forwarduje.

Drip není šestá periodická větev. Úspěšný buyback volá `dripOnBuy(acquired)`
přímo. Legacy Drip keeper zůstává paused.

Aktuální on-chain stav:

- Receiver `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` je paused;
- produkční Keystone Forwarder je
  `0x76c9cf548b4179F8901cda1f8623568b58215E62`;
- očekávané workflow ID a workflow owner jsou nulové/nezamknuté;
- pět call allowlistů a role targetů nejsou plně zapojené;
- LiquidityKeeperProxy a BuybackUpkeepProxy jsou paused;
- simulace pětivětvého CRE dry-run může projít bez aktivace mainnetu.

Workflow se nesmí aktivovat před počáteční likviditou, snapshoty baseline,
finálním zapojením rolí, zamknutím workflow identity a strict launch preflightem.

## 14. Pořadí aktivace

Produkční pořadí závislostí je:

1. potvrdit kanonický Polygon router, factory, WPOL, pair, ownera a manifesty;
2. vložit počáteční likviditu `8M BIGGI + 5 000 POL`;
3. vytvořit DEX baseline snapshoty a ověřit rezervy páru a LP custody;
4. dokončit post-liquidity konfiguraci tokenomiky;
5. nakonfigurovat právě jednu liquidity automatizační cestu;
6. nakonfigurovat CRE workflow ID, ownera, Receiver calls a role targetů;
7. spustit strict Polygon gate a archivovat evidence;
8. samostatně nakonfigurovat Moderator/Drip V2, pokud má nahradit V1;
9. převést citlivý ownership na zamýšlený Safe/multisig;
10. aktivovat nejprve pouze Originals a nechat budoucí kapitoly neaktivní.

Public mint Originals zůstává nezávisle zamčený, dokud není mintnuto všech 550
Originals ticketů.

## 15. Governance, rizika a negarantované výsledky

Současný owner může měnit řadu ekonomických nastavení, včetně obecného mintu
tokenu do hard capu, pause stavu tokenu, cen ticketů a bloků, platební konverze,
wiringu příjemců, buyback/slippage limitů, supply thresholdů, emission budgetů,
pohybů Reserve, uvolnění LP a rescue funkcí. Aktuální owner je EOA, nikoli finální
Safe.

Externí závislosti zahrnují Polygon, Chainlink VRF, CRE, QuickSwap, WPOL,
RPC/indexing služby, IPFS gatewaye a peněženky uživatelů. Rizika zahrnují chybu
smart kontraktu, kompromitaci owner klíče, MEV, slippage, nízkou likviditu,
selhání oracle nebo RPC, neúspěšnou automatizaci, chybu governance, dostupnost
metadat a chování marketplace.

Konkrétní negarantované výsledky:

- buyback negarantuje růst ceny a získaná BIGGI nepálí;
- drip může vytvářet prodejní tlak BIGGI a může selhat nebo proběhnout částečně;
- liquidity automatizace nezabrání všem výkyvům ani impermanent loss;
- Collection Rewards jsou soutěžní a podmíněné plným budgetem;
- sazba Token Rewards může klesnout podle týdenního budgetu a supply limitů;
- testy, source verification a simulace nejsou externí audit ani formální
  verifikace.

## 16. Aktuální mainnet snapshot

| Stav | Hodnota |
| --- | --- |
| BIGGI total supply | `1 200 000 000 BIGGI` |
| Zbývá do globálního capu | `1 000 000 000 BIGGI` |
| Guardian DEX minted | `0` |
| Guardian Rewards minted | `0` |
| Reserve BIGGI balance | `600 000 000 BIGGI` |
| Reserve POL balance | `0 POL` |
| Drip dostupný inventory | `200 000 000 BIGGI` |
| Token Rewards BIGGI balance | `200 000 000 BIGGI` |
| Rezervy páru / LP supply | `0 / 0 / 0` |
| Buyback native spent / BIGGI acquired | `0 / 0` |
| Financování Collection Rewards | pětkrát `0 / 47 000 POL` |
| Aktuální owner | `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` |
| Public launch preflight | není ready, 11 očekávaných blokátorů |

Deployment a wiring kontroly procházejí. Zbývající blokátory jsou aktivační
podmínky, hlavně počáteční likvidita, paused automatizace, chybějící produkční
CRE identita/role a aktivace kapitoly.

## 17. Kanonické adresy tokenomiky

| Komponenta | Adresa / stav |
| --- | --- |
| BIGGI token | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| Reserve V4 | `0x2786e46e01a5d229118fEdC102267217C7e94574` |
| Treasury | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |
| MultiCollectionDistributor | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| Collection Rewards | `0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43` |
| Token Rewards | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| Emission Controller | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` |
| DripDistributor | `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3` |
| Buyback Agent | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| Buyback Policy | `0x50485231A0602DE7a7b64e2760EF21133c77a43C` |
| DripLM V1, živé wiring | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` |
| Moderator V1, živé wiring | `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D` |
| DripLM V2, staged/paused | `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A` |
| Moderator V2, staged/paused | `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8` |
| Community Center | `0x81C6E90a991d7D210c43B00B7EB1a5450cc372Ae` |
| Supply Controller | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` |
| Supply Guardian | `0xdCA0bEda4c96eCE2E23e30f6Aa95697106d99B49` |
| DEX Reserve Guard | `0x350370c248495758b80Ea1C564Df1290cA76588B` |
| Liquidity Manager | `0xfb770C5A5AC6e41C85f076DB7C3434eAcd8e0F19` |
| Liquidity Vault | `0xFe234394845B601B2c671c0dD631fA6290c02bb9` |
| Liquidity Orchestrator | `0xC72DB11941d8Ab76baF84B1af9dB43E09060b681` |
| Liquidity Keeper Proxy | `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` |
| CRE Receiver | `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` |
| QuickSwap V2 Router | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` |
| QuickSwap V2 Factory | `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` |
| WPOL | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| BIGGI/WPOL Pair | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |

Kanonická adresní data zůstávají v `biggi-project/bekend/addresses.master.json`.

## 18. Reprodukovatelné ověření

Ze složky `biggi-project/bekend`:

```bash
npm run check:master:polygon
npm run check:master:core:polygon
npm run audit:collection-rewards:polygon
npm run preflight:launch:polygon
npm run preflight:master:cre:polygon
```

Primární zdrojové složky:

- `BIGGI_MASTER/TOKENOMICMAINNET`
- `BIGGI_MASTER/CORE`
- `BIGGI_MASTER/chainlink/biggi-cre-automation`

Provozní aktivace se musí řídit dokumenty
`TOKENOMICMAINNET/MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md`,
`TOKENOMICMAINNET/INITIAL_LIQUIDITY_RUNBOOK_CS.md` a strict launch gate.
Každá pozdější změna konfigurace nebo deploymentu musí aktualizovat verzi a
snapshot tohoto dokumentu.
