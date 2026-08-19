# BIGGI Mainnet FAQ (community + investori)

Datum: 2026-06-03

## 1) Proc je mainnet architektura rozdelena na CORE a TOKENOMICMAINNET?
Aby byly jasne oddeleny:
- business/core logika kolekci a VRF,
- operational a ekonomicke vetve (treasury, reserve, drip, guards).
To zjednodusuje monitoring, audit i rizikove rizeni.

## 2) Je token supply fixni, nebo muze rust?
Model je cap-bounded: existuje globalni cap a mint vetve maji explicitni limity.
V praxi to znamena, ze se pouzivaji kontrolovane refill vetve pro kontinuitu systemu, ale ne neomezena emise.

## 3) Co se deje pri kritickem poklesu rezerv na DEX?
Pouziva se kombinace:
- BiggiSupplyController (automaticke threshold/cooldown vetve),
- BiggiDexReserveGuard (sekundarni ochrana),
- volitelne circuit-breaker limity.
Cilem je stabilizovat provoz bez nekontrolovaneho chovani.

## 4) Muze v TokenRewards dojit odmena?
System je navrzeny s refill logikou a guard pravidly.
Prakticky: beha threshold + refill kontrola, aby rewards v kritickych scenarich meli obsluznou kontinuitu.
Finalni parametry se uzamknou pred produkci.

## 5) Kolik keeperu realne potrebuje tokenomika?
Doporuceny guarded profil:
1. SupplyController upkeep
2. Buyback upkeep
3. Jedna liquidity vetve (ne dve najednou)
4. DexReserveGuard upkeep
Volitelne lze pridat drip fallback keeper jako redundantni vrstvu.

## 6) Je VRF pripraveny?
VRF logika je v kodu integrovana.
Pred ostrym startem je nutne doplnit finalni produkcni hodnoty:
- coordinator
- keyHash
- subscription
- callback gas limity
a potvrdit end-to-end test na produkcnim retezu.

## 7) Jak je resena bezpecnost?
Bezpecnost je postavena na:
- role separation (owner/keeper/guardian),
- pausability a emergency controls,
- explicitnich limitech a cooldowns,
- readers + monitoring + release checklistu.
Navic je pripravena per-contract audit dokumentace.

## 8) Jak souvisi liquidity vault a LP tokeny?
LiquidityVault slouzi jako custody vrstva pro LP/likviditni aktiva.
LiquidityManager/Orchestrator ridi, kdy a jak se likvidita obsluhuje.
Smysl: minimalizovat riziko ad-hoc manipulace pres EOA.

## 9) Je pripraveny i scaling pro vice kolekci?
Ano, architektura pocita s multi-collection flow:
- MultiCollectionDistributor
- CollectionRewards
- navazne route do community/moderator/tokenomics vetvi
Nastaveni je navrzene tak, aby slo rozsirovat bez prepisu core logiky.

## 10) Co jeste chybi do uplneho mainnet completion?
1. Finalni adresy a ownership transfer.
2. Aktivace keeper topologie na produkci.
3. Finalni VRF wiring.
4. Finalni fork rehearsal + release sign-off + explorer verification.

## Poznamka
Dokument popisuje aktualni stav kodu a release-pripravy k 2026-06-03.
Neni to investicni doporuceni ani finalni release announcement.

## Interni navazny material
Pro onboarding noveho moderatora je pripraven dokument:
`README_MODERATOR_MAINNET_CS.md`

Detailni README primo ke moderatorskemu kontraktu:
`README_ModeratorCenter_CS.md`

English version:
`README_MODERATOR_MAINNET_EN.md`
