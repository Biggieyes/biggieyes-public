# CORE reader compatibility audit

Status 2026-06-16: CORE readers are deployed on Polygon mainnet and are recorded in `addresses.master.json`.

## Summary
CORE reader vrstva byla dočištěna tak, aby respektovala refactor rozdělení:
- `BiggiMain` = VRF NFT state
- `BiggiTicketHub` = ticket state
- `BiggiCollectionRewards` = reward counters per VRF collection

## Fixed issue
Původní `BiggiMainReader` četl z `BiggiMain` funkce, které už po refactoru neexistují:
- `ticketPrice()`
- `ticketMinted()`
- `orangeWinnersCount()`
- `blockWinnersCount()`
- `rainbowRewardClaimedGlobal()`

To bylo nekompatibilní.

## Current model
`BiggiMainReader` nově bere 3 adresy:
- `main`
- `ticketHub`
- `collectionRewards`

A snapshot skládá z těchto zdrojů.

## Compatibility status
- `BiggiMainReader` — fixed
- tokenomics reader layer — carried forward from reader v3 package

## Remaining recommendation
Udělání jednoho FE deployment/config souboru, který bude držet správné adresy pro:
- main
- ticketHub
- collectionRewards
- registry
- chapterController
- public collection
- tokenomics readers
