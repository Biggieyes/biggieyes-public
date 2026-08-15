# Agent documentation — BiggiMainReader.sol

## Role
Reader pro VRF chapter collection po refactoru CORE vrstvy.

## Purpose
Agreguje data pro frontend z více kontraktů:
- `BiggiMain` — finální VRF NFT stav
- `BiggiTicketHub` — ticket price + ticket minted + ticket ownership
- `BiggiCollectionRewards` — counters orange/block/rainbow

## Important compatibility note
Po refactoru už `BiggiMain` nedrží:
- `ticketPrice()`
- `ticketMinted()`
- reward counters `orangeWinnersCount()` / `blockWinnersCount()` / `rainbowRewardClaimedGlobal()`

Tyto hodnoty musí reader číst z:
- `BiggiTicketHub`
- `BiggiCollectionRewards`

## Constructor
`constructor(address mainContract, address ticketHub, address collectionRewards)`

- `mainContract` je povinný
- `ticketHub` může být `address(0)`
- `collectionRewards` může být `address(0)`

## Key outputs
- block prices
- block/background mint counts
- mint data by NFT tokenId
- reward counters pro konkrétní VRF collection
- ticket discovery přes TicketHub
- unified frontend snapshot
- `getTicketHubFrontendSnapshot(user, treasury)` pro TicketHub caps, user ticket count, native/BIGGI price, pause state, token sink config, treasury allowlist, and `ecosystemTreasuryRouteOk`

## Safe-edit guidance
- Nepřesměrovávej ticket stav zpět na `BiggiMain`
- Nepředpokládej, že `collectionRewards.defaultMain()` odpovídá reader main kontraktu
- Reward counters vždy čti namespaced přes `address(main)`

## Known risks
- Pokud `ticketHub` nebo `collectionRewards` nejsou nastavené, reader vrací nuly / prázdná data místo revertu.
- To je záměr pro FE kompatibilitu.

## Checklist before edit
1. Ověř, že `BiggiMain` stále drží `getMintData()` a `characterClaimed()`.
2. Ověř, že `BiggiTicketHub` stále drží `ticketPrice()`, `ticketMinted()`, `exists()`, `ownerOf()`.
3. Ověř, že `BiggiCollectionRewards` stále exportuje mappings:
   - `orangeWinnersCount(address)`
   - `blockWinnersCount(address)`
   - `rainbowRewardClaimedGlobal(address)`
