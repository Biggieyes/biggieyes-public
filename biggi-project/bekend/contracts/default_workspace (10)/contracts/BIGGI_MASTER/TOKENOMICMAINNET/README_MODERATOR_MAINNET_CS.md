# BIGGI Mainnet README pro Moderatora

Tento dokument je onboarding pro moderatora nebo community cloveka, ktery nepotrebuje cist Solidity, ale musi rozumet skutecnemu mainnet flow.

## Jedna veta

BIGGI je chapter-based NFT a tokenomicky system, kde se pres ticket a on-chain nahodu mintuje hlavni NFT, po vycerpani chapter se odemyka public kolekce a cast prijmu se vraci do reserve, rewards, buyback, treasury a community vetvi.

## Co je na BIGGI jine

BIGGI nespolaha na jeden prosty mint. Kombinuje:

1. ticket vrstvu
2. VRF reveal vrstvu
3. chapter progression
4. public unlock az po chapter completion
5. sberatelske kombinace s reward logikou
6. tokenomicke a community vetve

## Zjednoduseny flow pro uzivatele

1. uzivatel koupi ticket
2. ticket ma svou cenu a ta roste
3. uzivatel ticket redeemne
4. `BiggiMain` pozada `BiggiVRFRouter` o nahodu
5. po callbacku se mintne konkretni hlavni NFT
6. po dokonceni chapter se odemkne `BiggiMain2`
7. sberatel muze plnit kombinace a brat rewards

## Hlavni kontrakty v jedne rade

`BiggiTicketHub`:

- prodava tickety
- drzi ticket ownership
- pri redeem vola `BiggiMain`

`BiggiMain`:

- mystery kolekce
- mintuje po VRF callbacku

`BiggiMain2`:

- public chapter kolekce
- odemyka se az po chapter completion

`BiggiVrfRouter`:

- bridge do Chainlink VRF

`BiggiSeriesRegistry` a `BiggiChapterController`:

- drzi chapter wiring a unlock pravidla

`BiggiMultiCollectionDistributor`:

- rozdeluje cast native prijmu do dalsich vetvi

## Jak tecou penize

Pri native platbe v collection flow jde cast prijmu do distributoru a odtud dal do dalsich vetvi:

- collection rewards
- reserve
- buyback
- treasury
- community

Prakticky to znamena, ze prijem z mintu nekonci v jedne penezence. Krmi vice runtime vetvi ekosystemu.

Pri platbe v `BIGGI` tokenu je flow jine nez pri native coin, ale i tenhle path zivi reserve a dalsi navazane vetve.

## Co dela BIGGI token

`BiggiToken`:

- ma globalni cap
- umi initial distribution do reserve, drip, rewards a marketing vetve
- umi bounded dalsi mint jen pres supply authority branch

Dulezita pravda:

- BIGGI nema nekonecny tisk
- ale cast supply je vyhrazena jako kontrolovany refill budget pro kriticke scenare

## Hlavni tokenomicke vetve

`BiggiReserveV4`:

- drzi reserve-side POL a BIGGI accounting

`BiggiTreasury`:

- prijima cast native prijmu
- prijima BIGGI z buybacku a dale ho splituje

`BiggiBuybackAgent`:

- prijima native share
- nakupuje BIGGI na DEX
- routuje ho do treasury

`BiggiLiquidityManager` a `BiggiLiquidityVault`:

- obsluhuji liquidity branch

`BiggiSupplyController`, `BiggiSupplyGuardian`, `BiggiDexReserveGuard`:

- hlidaji refill a obrannou logiku

## Community vs Moderator vrstva

`BiggiCommunityCenter`:

- eventy, granty a community payouts

`ModeratorCenter`:

- referral sloty moderatoru
- weekly allocation
- payout podle referral a sales aktivity

Nejsou to stejne kontrakty a nemaji stejnou roli.

## Co moderator dela

Moderator:

- vysvetluje ticket -> reveal -> public mint flow
- pomaha uzivatelum chapat chapter progression
- pracuje s referral identitou nebo referral flow
- privadi komunitu

Moderator:

- nevybira komu padne jake NFT
- neovlada VRF
- neovlada treasury
- neslibuje garantovany zisk ani garantovane rewardy

## Co ma moderator rikat po pravde

Spravne:

- BIGGI je cap-bounded system
- cast supply muze byt pozdeji mintnuta jen v definovanych refill branchech
- buyback je mechanika ekosystemu, ne garance ceny
- rewards zavisi na pravidlech, holdingu a aktivnich vetvich

Nespravne:

- dalsi BIGGI uz nikdy nemohou vzniknout
- buyback garantuje rust ceny
- admin muze libovolne rozdat mystery NFT
- kazdy uzivatel neco urcite vyhraje

## Co si ma moderator zapamatovat nejvic

1. ticket neni finalni NFT
2. reveal je pres VRF nahodu
3. public kolekce se odemyka az po chapter completion
4. mint revenue se vraci do vice ekonomickych vetvi
5. BIGGI token je cap-bounded, ale ma kontrolovane refill branche
6. moderator vysvetluje a privadi komunitu, ale neridi random, treasury ani payout authority

## Navazny dokument

Pro primo moderatorskou payout logiku:

- `README_ModeratorCenter_CS.md`
