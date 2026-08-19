# README - ModeratorCenter

Tento dokument popisuje primo kontrakt `ModeratorCenter.sol`.

Neni to onboarding k celemu projektu. Je to provozni popis moderatorske payout vrstvy.

## Zdroj pravdy

- zdrojovy kontrakt: `ModeratorCenter.sol`
- dossier README: `MAINNET_CONTRACT_DOSSIERS/ModeratorCenter/README.md`

## Co je `ModeratorCenter`

`ModeratorCenter` je kontrakt pro moderatorsky a referral program.

Drzi:

- `10` slotu
- payout adresy pro jednotlive sloty
- referral hash a password hash pro slot
- tydenske statistiky referral a ticket sales
- tydenske alokace a distribuce odmen
- milestone odmeny podle kumulativnich prodeju

Je to payout a accounting vrstva. Neni to prodejni, NFT, treasury ani VRF kontrakt.

## Co kontrakt nedela

`ModeratorCenter`:

- neprodava NFT
- nemintuje BIGGI
- neridi treasury
- nespousti VRF
- nerozdeluje collection rewards ani token rewards

## Hlavni role

`owner`:

- konfiguruje sloty
- nastavuje payout adresy
- nastavuje referral hash a password hash
- nastavuje reportery
- nastavuje koeficienty a milestone castky
- nastavuje `multiCollection`
- spousti tydenni distribuci

`reporter`:

- muze zapisovat ticket sale pres `recordTicketSale(bytes32,address)`

bezny uzivatel:

- muze registrovat referral pres `registerReferral(bytes32)`

`multiCollection`:

- muze posilat oficialni weekly allocation pres `notifyAllocation()`

## Odkud tecou penize

Zamysleny flow je:

- `multiCollection -> notifyAllocation() -> weekAllocated[week]`

Kontrakt umi prijmout i obycejny native transfer pres `receive()` nebo `fallback()`, ale ten:

- zvysi balance kontraktu
- nezapise se do `weekAllocated[week]`

Pro ciste ucetnictvi se ma pouzivat `notifyAllocation()`.

## Jak se pocita aktivita

Slot ma:

- `weekUniqueCount`
- `weekTicketCount`
- `cumulativeTicketSales`

Referral identita se hleda pres `referralHash`.

`registerReferral(bytes32)` zapisuje unikatniho uzivatele pro slot a tyden.

`recordTicketSale(bytes32,address)`:

- zvysuje weekly ticket count
- zvysuje `cumulativeTicketSales`
- muze zvysit i weekly unique count
- muze spustit milestone payout

## Jak se pocita tydenni odmena

Pro kazdy aktivni slot se pocita vaha:

`uniqueCount * effectiveCoef`

Kde:

- `uniqueCount` je pocet unikatnich referral adres za tyden
- `effectiveCoef` je zakladni coef plus boost podle `ticketCount`

Zakladni coef:

- `leaderCoefBps` pro leader slot
- `moderatorCoefBps` pro bezny moderator slot

Boost:

- `saleBoostBpsPerTicket * ticketCount`

Tydenni pool se potom rozdeli pomerne podle vah.

## Milestones

Kontrakt umi milestone payout podle `cumulativeTicketSales`.

Nastavitelne prahy jsou:

- `milestone100`
- `milestone500`
- `milestone1000`

Milestone je pro dany slot a threshold vyplacen jen jednou.

## Dulezite provozni vlastnosti

- pokud slot nema payout adresu, odmena jde na `owner()`
- pokud je `globalUniquePerWeek = true`, jedna adresa se v danem tydnu pocita globalne jen jednou
- distribuce selze, kdyz neni co rozdelovat nebo neni zadny eligible slot

## Minimalni checklist

Pred pouzitim zkontrolovat:

1. `multiCollection` je nastaveny
2. aktivni sloty maji referral hash
3. aktivni sloty maji payout adresu
4. reporteri jsou spravne nastaveni
5. koeficienty a milestone castky odpovidaji zamyslenemu programu
6. weekly allocation jde pres `notifyAllocation()`

## Jedna veta

`ModeratorCenter` je on-chain payout vrstva, ktera sbira referral a sales statistiky moderatoru a podle nich rozdeluje tydenske native odmeny.
