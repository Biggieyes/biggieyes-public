# TOKENOMICS_DEEP_AUDIT_2026-06-07_CS

Stav: kontrakty `TOKENOMICMAINNET` nejsou nasazene na mainnet. Audit je proveden nad aktualnim lokalnim source tree a `artifacts-master` jako finalni priprava pred mainnet deployem.

## Rozsah

- root tokenomic kontrakty v `TOKENOMICMAINNET`
- `TOKENOMIC_LIBRARY`
- `TOKENOMIC_READERS`
- buyback, treasury, drip, reserve, liquidity, supply, guard, keeper a moderator vetev
- ABI balicek v `TOKENOMICMAINNET/ABI`
- master deploy/check flow pres lokalni final gate

## Provedene upravy

- `BiggiTreasury`
  - pridany `ReentrancyGuard`
  - kriticke route settery (`setDistributor`, `setBuybackAgent`, `setTokenRewards`, `setReserve`, `setDripDistributor`) odmitaji nulovou adresu
  - `buybackDepositAndSplit`, `ownerDepositAndSplit` a `receiveEcosystemBiggi` vyzaduji pred token pull nastaveny `tokenRewards`, `reserveAddr` a `dripDistributor`
  - POL/BIGGI entrypointy a rescue funkce jsou `nonReentrant`
- `BiggiBuybackAgent`
  - rescue ERC20 pouziva `SafeERC20`
  - rescue native pouziva `call` misto `transfer`
  - rescue cile nesmi byt nulove
  - `_guardsAndQuota` je `view`
- testy
  - pridana kontrola nulovych treasury route setteru
  - pridana kontrola nulovych buyback rescue recipientu
  - pridana kontrola, ze nekompletni treasury BIGGI split fail-closed a nezanecha tokeny v treasury

## Aktualni vysledek

- `npm run compile:master`: OK
- `npm run test:master`: OK, 66 passing
- `npm run gate:master:local`: OK
- strict local status: `Consistency checks: OK`
- `node scripts/tools/compareTokenomicAbi.js`: 44 contracts, 0 issues
- `node scripts/tools/compareAbiToSource.js`: 25 contracts, 0 issues
- reader smoke: 5 passing
- liquidity/supply/moderator targeted smoke: 22 passing
- ecosystem BIGGI payment smoke: 4 passing
- buyback/treasury/drip smoke: 8 passing

## Konzistence vetvi

- Mint native tok zustava: distributor splituje native do collection rewards, reserve, buyback, treasury a community center podle `BiggiBpsLib`.
- Buyback vetev: `BiggiBuybackAgent` prijme native od distributoru, provede buyback pres router, preda BIGGI do treasury, treasury rozdeli BIGGI `34/33/33`; pri failu swapu jde native pres `receiveBuybackFallback`.
- Treasury BIGGI split: `34%` token rewards, `33%` reserve, `33%` drip distributor. Split se nespusti bez vsech tri recipientu.
- Drip vetev: `BiggiDripLMToModerator` muze po uspesnem buybacku claimnout BIGGI z drip distributoru, prodat cast a poslat native do reserve a `ModeratorCenter` podle nastavenych BPS.
- Reserve/liquidity vetev: reserve bucket `dexRefillBiggi` je ucetne hlidany a LM pull odepisuje bucket pred prevodem; orchestrator kontroluje wiring reserve-LM-vault.
- Supply guard vetev: controller/guardian/DEX guard maji limity, cooldown, pause a circuit breaker testy.
- Readery: aktualni reader layer vraci treasury/reserve/buyback/liquidity/supply/guard/system stav a exposeuje readiness pro ecosystem BIGGI route.

## Zbyvajici mainnet vstupy

Tyto hodnoty nejsou soucast lokalniho auditu a musi byt doplneny az pri finalnim mainnet deployi:

- finalni owner / Safe / `EXPECT_OWNER`
- finalni `DEV_WALLET`
- realny `ROUTER`, `FACTORY`, `WETH`, `PAIR`, `QUOTE_TOKEN`
- overeni, ze `PAIR` obsahuje BIGGI a quote token a ma pocatecni likviditu
- volitelny `DEX_GUARD_QUOTE_ORACLE` a oracle staleness/require nastaveni
- finalni VRF hodnoty nebo finalni `VRF_ROUTER`
- keeper/upkeep registrace a funding
- finalni buyback policy, slippage, deadline, cooldown a quota hodnoty

Poznamka: `addresses.master.json` po lokalnim gate obsahuje localhost adresy. Nepouzivat jako mainnet manifest.
