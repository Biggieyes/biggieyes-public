# ModeratorCenter - mainnet analyza pro whitepaper

## Aktualizace 2026-08-26

Hardenovana V2 byla nasazena a source-verified, ale zustava paused a neni
prepojena do zive tokenomiky:

- `ModeratorCenterV2`: `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8`
- `BiggiDripLMToModeratorV2`: `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A`
- owner obou kontraktu: `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`
- detailni stav: `MODERATOR_V2_MAINNET_STATUS_2026-08-26_CS.md`

Nize uvedene nalezy popisuji puvodni V1. V2 jejich hardening implementuje,
ale moderatorsky program stale nelze popisovat jako live, dokud nejsou
nakonfigurovane sloty a proveden samostatny finalni aktivacni gate.

Datum kontroly: 2026-08-25
Sit: Polygon PoS mainnet (`chainId = 137`)
Snapshot: blok `92658352`, cas `2026-08-25T21:15:55Z`

## Verdikt

`ModeratorCenter` je nasazeny a jeho bytecode odpovida kanonickemu zdroji, ale
moderatorsky program neni aktivni ani pripraveny k produkcnimu spusteni.

Pro whitepaper lze popsat:

- nasazenou architekturu,
- zamysleny tok prostredku,
- aktualni neaktivni stav,
- presny vypocet vah.

Nelze zatim tvrdit, ze moderatorske odmeny jsou live, plne integrovane,
trustless, sybil-resistant nebo produkcne bezpecne. Pred aktivaci je doporucen
redeploy hardenovane verze V2.

Tato kontrola neni externi audit ani formalni verifikace. Je to manualni
source review, porovnani deployed bytecode, mainnet state audit a runtime
reprodukce nalezenych hranicnich stavu.

## Zdroj pravdy

- kontrakt: `TOKENOMICMAINNET/ModeratorCenter.sol`
- financni adapter: `TOKENOMICMAINNET/BiggiDripLMToModerator.sol`
- ABI: `TOKENOMICMAINNET/ABI/ModeratorCenter.abi.json`
- adresa: `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D`
- deployed bytecode `ModeratorCenter` presne odpovida aktualnimu artefaktu
- Polygonscan verified source presne odpovida kanonickemu zdroji
- kompilator: Solidity `0.8.24`, optimizer `200`, `viaIR = true`

Kopie `BIGGI_MAINNET_SOURCE/ModeratorCenter.sol` neni aktualni a nesmi se
pouzivat jako zdroj pro whitepaper ani dalsi deploy.

## Aktualni mainnet stav

| Polozka | Hodnota |
| --- | --- |
| Owner | `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` |
| Owner typ | EOA, nikoliv Safe/timelock |
| Autorizovany allocator (`multiCollection`) | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` (`DRIP_LM`) |
| Aktivni sloty | `0 / 10` |
| Nastavene referral hashe | `0 / 10` |
| Nastavene payout adresy | `0 / 10` |
| Nastaveni reporteri | zadny `setReporter` mainnet zapis |
| Leader zakladni vaha | `100` |
| Moderator zakladni vaha | `30` |
| Boost za ticket | `10` |
| Milestone 100 / 500 / 1000 | `0 / 0 / 0 wei` |
| Globalni unique rezim | `true` |
| Zbytek kontraktu | `0 POL` |
| Otevrene alokace | `0 POL` |
| Dosavadni prodeje/referrals | `0` |

Od deploye probehly pouze tri prime transakce:

1. deploy dne 2026-06-16,
2. `setMultiCollection(DRIP_LM)`,
3. `transferOwnership(0x402C...92b2)`.

## Skutecny financni tok

`ModeratorCenter` nedostava primy podil z kazdeho NFT mintu. Aktualni cesta je:

`buyback -> BIGGI acquired -> treasury split -> DripDistributor -> DRIP_LM`

`DRIP_LM` se po uspesnem buybacku pokusi prodat BIGGI a native vystup deli:

- `50 %` do Reserve,
- `50 %` pres `ModeratorCenter.notifyAllocation()`.

Mainnet `DRIP_LM` ma aktualne:

- `sellPct = 70`,
- `reserveShareBps = 5000`,
- `moderatorShareBps = 5000`,
- `slippageBps = 200`,
- `txDeadlineSec = 600`,
- spravne nastavene adresy routeru, DripDistributoru, Reserve, BuybackAgentu a
  ModeratorCenteru.

Drip je reakce na uspesny buyback. Neni to samostatny periodicky
`ModeratorCenter` claim ani samostatna CRE vetev.

## Presny vypocet odmen

Pro aktivni slot `i` v tydnu `w`:

```text
base(i) = isLeader ? leaderCoefBps : moderatorCoefBps
effective(i,w) = base(i) + saleBoostBpsPerTicket * ticketCount(i,w)
weight(i,w) = uniqueCount(i,w) * effective(i,w)
share(i,w) = pool(w) * weight(i,w) / sum(all eligible weights)
```

Nazev `Bps` je zavadejici: hodnoty `100`, `30` a `10` nejsou primo procenta
z poolu. Jsou to relativni vahove jednotky; jmenovatel `10000` se pri weekly
distribution nepouziva.

Tyden je definovan jako:

```text
floor(block.timestamp / 604800)
```

Hranice tydne je tedy epochova hranice ve ctvrtek `00:00 UTC`, nikoliv pondeli.

## Pozitivni bezpecnostni vlastnosti

- `notifyAllocation()` muze volat pouze nastavena allocator adresa.
- Weekly alokace jsou oddelene podle week ID.
- `totalAllocatedOutstanding` chrani alokovane POL pred `withdrawToOwner()`.
- Distribuce, registrace a zapis prodeje maji reentrancy guard.
- Smycky jsou omezeny pevnym poctem deseti slotu.
- Owner muze vybrat pouze nealokovany zbytek.
- Milestone replay je blokovan mapovanim `milestonePaid`.
- Aktualni kontrakt nema prostredky ani aktivni sloty, takze nalezy dnes
  nevystavuji uzivatelske vklady okamzitemu odcerpani.

## Nalezy blokujici produkcni aktivaci

### H-01: Distribuce pred koncem tydne vytvari nespravedlive vysledky

Owner muze zavolat distribuci aktualniho tydne kdykoliv a opakovane. Pri dalsi
alokaci se rozdeli jen novy zbytek, ale podle novych kumulativnich vah. Predchozi
platby se znovu nevyrovnaji.

Runtime reprodukce:

- slot A byl jediny aktivni pri prvnich `100 wei` a dostal `100 wei`,
- pote pribyl stejne vahovy slot B a dalsich `100 wei`,
- konecny vysledek byl A `150 wei`, B `50 wei`,
- jednorazove finalni vyporadani by dalo `100 / 100`.

Oprava: povolit settlement jen pro uzavreny tyden, po definovanem allocation
cutoffu, a pouze jednou. Alternativou je prubezne per-slot debt accounting.

### H-02: Reporter muze zapsat neexistujici nebo duplicitni prodej

`recordTicketSale(referralHash, buyer)` neobsahuje ticket ID, chapter ID,
sale ID ani on-chain dukaz. Autorizovany reporter muze stejny prodej nebo
stejneho kupujiciho zapisovat opakovane. Kazdy zapis zvysi `ticketCount` a
`cumulativeTicketSales`, cimz meni vahy a milestone stav.

Navic neni TicketHub ani jiny produkcni reporter aktualne nastaven. V repu neni
produkni volani `recordTicketSale`; existuje pouze v testech.

Oprava: zapisovat atomicky z TicketHubu nebo z minimalniho adapteru s
jednorazovym `saleId`; ukladat `usedSaleId`; zahrnout chapter a ticket ID.

### H-03: Milestone se oznaci jako zaplaceny i bez skutecne platby

Kontrakt nastavi `milestonePaid = true` pred platbou. `_payToSlot()` pri nulovem
zustatku pouze vrati rizeni a pri nedostatecnem zustatku posle jen cast.
Milestone zustane trvale oznaceny jako zaplaceny a event obsahuje plnou
konfigurovanou castku, nikoliv skutecne odeslanou castku.

Runtime reprodukce pri milestone `1 POL` a nulovem free balance:

- `milestonePaid(slot, 100) = true`,
- skutecna platba `0 wei`,
- event `MilestonePaid` uvedl `1 POL`.

Oprava: oznacit milestone jako vyporadany az po plne platbe, nebo vest presnou
`milestoneOwed` pohledavku a emitovat skutecne zaplacenou castku.

### H-04: Historicke odmeny lze zmenit tesne pred distribuci

Distribuce stareho tydne pouziva aktualni stav `enabled`, `isLeader`, `payout`
a aktualni globalni koeficienty. Owner tedy muze po skonceni aktivity zmenit
prijemce, vypnout slot nebo zmenit vahy a teprve potom tyden rozdelit.

Oprava: versionovana konfigurace s ucinnosti od dalsiho tydne a snapshot
parametru pouzity pri settlementu.

### H-05: Alokace bez eligible aktivity muze zustat trvale zamcena

`notifyAllocation()` prijme POL i tehdy, kdy neni aktivni zadny slot nebo v
danem tydnu nevznikl zadny `uniqueCount`. Po prechodu do dalsiho tydne nelze
aktivitu do stareho tydne doplnit. Distribuce stareho poolu pak vzdy revertne
na `no eligible moderators this week` a alokaci nelze prevest ani vybrat.

To je v aktualnim stavu zasadni: vsech deset slotu je disabled. Buyback/drip
vetev proto nesmi byt aktivovana drive nez opravena moderatorska V2 a jeji
konfigurace.

Oprava: definovat rollover/refund policy, neprijimat alokaci do neotevreneho
epochu a umoznit bezpecne finalizovat tyden bez eligible aktivity.

## Stredni nalezy

### M-01: Verejna referral registrace je sybilovatelna

`registerReferral()` nevyzaduje nakup, podpis ani dukaz lidske identity. Jedna
osoba muze vytvaret nove adresy a zvysovat `uniqueCount`. Pri globalni unique
politice muze navic uzivatel predem registrovat jinou referral identitu a
zablokovat spravne unique prirazeni pozdejsimu prodeji.

Financni vaha nema byt odvozena z volne self-registration. Pouzit overeny sale
flow nebo podepsane referral binding pravidlo.

### M-02: Push distribuce muze zablokovat cely tyden

Kontrakt posila POL v jedne smycce. Jedina payout adresa, ktera prijem revertne,
zpusobi revert cele distribuce. Bezpecnejsi je pripisovat `claimable` zustatky a
nechat kazdy slot vybrat odmenu samostatne.

### M-03: Fallback v DRIP_LM muze obejit weekly accounting

Kdyz `notifyAllocation()` selze, `DRIP_LM` zkusi obycejny native transfer na
fallback `ModeratorCenter`. Ten prijme POL, ale nezvysi `weekAllocated` ani
`totalAllocatedOutstanding`. `DRIP_LM` pritom muze operaci povazovat za uspesnou.

Oprava: fallback odstranit. Neuspesny `notifyAllocation()` musi byt explicitni
failure nebo musi vest samostatny retry balance.

### M-04: Financovani a aktivita se mohou priradit do jinych tydnu

Prodeje i alokace pouzivaji tyden podle okamziku vlastni transakce. Pokud se
buyback/drip provede az v dalsim tydnu, jeho pool nebude automaticky navazan na
tyden, ve kterem vznikly prodeje.

Whitepaper musi definovat, zda pool patri k buyback tydnu nebo sale tydnu. V2
pak musi tuto politiku vynutit explicitnim week ID a settlement cutoffem.

### M-05: Centralizovana administratorska prava

Owner EOA muze menit sloty, payouty, referral hashe, reportery, vahy, milestone,
allocator a cas distribuce. Muze take vybrat vsechny nealokovane prostredky.

Pred aktivaci presunout ownership na Safe; pro ekonomicke parametry zvazit
timelock a verejne eventy s odlozenou ucinnosti.

### M-06: Chybi globalni pause/emergency rezim

Kontrakt nema `Pausable`. Jednotlive sloty a reportery lze vypnout, ale neni
jednoznacny nouzovy stav pro referral/sale/distribution flow.

### M-07: Frontend referral flow neni end-to-end funkcni

Frontend odesila referral na `/api/registerReferral`, ale odpovidajici Netlify
funkce ani redirect v repu neexistuje. Produkcni URL vraci `404`. Frontend
zaroven nevola on-chain `ModeratorCenter.registerReferral()`.

Pred spustenim je nutne zvolit jedinou kanonickou cestu a doplnit autentizaci,
deduplikaci, testy a monitoring.

### M-08: Znovupouziti slotu dedi cizi historii

Zmena referral hashe, payout adresy nebo moderatora nevynuluje
`cumulativeTicketSales` ani `milestonePaid`. Novy clovek ve stejnem slotu tak
muze zdedit starsi prodeje a soucasne prijit o jiz oznacene milestone.

Oprava: slot identity verzovat podle moderatora/programu, nebo oddelit
historicke ucetnictvi od znovupouzitelneho slot indexu.

### M-09: Milestone nema definovany funding bucket

Milestone se neplati z weekly allocation, ale pouze z `unallocatedBalance()`.
Kontrakt nema specialni milestone funding funkci ani evidenci zavazku a owner
muze tento volny zustatek vybrat. Whitepaper proto nesmi spojovat weekly pool a
milestone pool, dokud V2 nezavede oddelene a auditovatelne financovani.

## Nizsi nalezy a dokumentacni rizika

- Referral hash nemusi byt unikatni. Prvni shoda v poli muze zastinit dalsi
  slot, vcetne stavu, kdy prvni slot je disabled.
- Payout muze byt nulovy; odmena pak bez dalsiho upozorneni jde ownerovi.
- `passwordHash` je verejne citelny a kontrakt jej nikde nepouziva. Nesmi se
  povazovat za bezpecnou login vrstvu ani obsahovat hash slabeho hesla.
- Celociselne deleni muze nechat trvale alokovany dust. Reprodukce se dvema
  stejnymi sloty a poolem `1 wei` skoncila s `distributed = 0` a
  `totalAllocatedOutstanding = 1 wei`.
- Event `SlotConfigured` neobsahuje hodnotu `enabled`, takze samotny event
  nestaci k rekonstrukci slotu.
- Kontrakt je neupgradeovatelny. Opravy vyzaduji novy deploy a migracni plan.
- `moderator.mhd` obsahuje stare adresy, starou ticket cenu a dalsi historicke
  parametry. Nesmi byt podkladem pro novy whitepaper.

## Testy a overeni

Provedeno:

- cely `BIGGI_MASTER` Hardhat suite: `91 passing`,
- cilene moderator/drip testy: `5 passing`,
- deployed source a bytecode kontrola,
- mainnet state a transaction-history kontrola,
- runtime reprodukce milestone, early settlement, duplicate referral a dust.

Stavajicich pet moderator testu pokryva happy path, global unique a oddeleni
alokaci mezi tydny. Nepokryva vyse uvedene adversarialni scenare.

## Doporucena V2 pred aktivaci

1. Uzavrit tyden a settlement provest jednou po cutoffu.
2. Definovat rollover/refund pro epoch bez eligible aktivity.
3. Snapshotovat sloty, payouty a vahove parametry pro kazdy tyden.
4. Navazat sale zapis na TicketHub a jednorazovy `saleId`.
5. Odstranit volnou self-registration z financni vahy.
6. Nahradit push payout za `claimable` pull model.
7. Opravit milestone na presne funded/debt accounting.
8. Verzionovat identitu slotu a jeho kumulativni historii.
9. Vynutit unikatni referral identitu a nenulovy payout aktivniho slotu.
10. Odstranit on-chain `passwordHash` z autentizacniho modelu.
11. Pridat pause/emergency stav.
12. Odstranit raw fallback z `DRIP_LM -> ModeratorCenter`.
13. Presunout ownership na Safe a definovat timelock/change policy.
14. Dopsat unit, invariant, fork a end-to-end testy pred novym deployem.

## Formulace vhodna pro whitepaper

Bezpecna formulace v aktualnim stavu:

> BIGGI ma na Polygon mainnet nasazenou, zatim neaktivni moderatorskou payout
> vrstvu. Je navrzena pro maximalne deset slotu a pro pomerne rozdeleni
> autorizovanych native alokaci podle overene referral a prodejni aktivity.
> Produkcni aktivace bude nasledovat az po hardeningu sale attribution,
> tydenniho settlementu, payoutu a administratorske spravy.

Nevhodne formulace:

- moderatorske odmeny jsou live,
- odmeny jsou trustless nebo plne automaticke,
- referral unique je sybil-resistant,
- leader dostava automaticky `1 %` a moderator `0.3 %` z poolu,
- kazdy mint posila pevny podil primo moderatorum,
- milestone event dokazuje skutecne vyplacenou plnou castku.
