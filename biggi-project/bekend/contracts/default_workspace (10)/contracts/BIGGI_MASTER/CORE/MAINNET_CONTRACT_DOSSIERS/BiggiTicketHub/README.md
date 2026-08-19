# BiggiTicketHub - Mainnet Dossier

## Source of truth
- Source file: `BiggiTicketHub.sol`
- Current-source ABI: `./ABI.json`
- Deployment status: the chapter-aware central hub is deployed and source-verified on Polygon mainnet.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address initialOwner, address mainCollection_)
```

## Main role
- mints sale and marketing tickets
- serves all configured chapters from one central hub
- keeps each chapter inactive until its sale is explicitly opened
- stores per-ticket mint-price snapshots
- forwards redeem requests into the bound VRF collection
- routes native mint-share to a distributor
- routes BIGGI inflow to sink and reserve wiring when configured
- supports treasury deposit mode for BIGGI paid ticket mints

## Owner/admin surface
```solidity
setMainCollection(address main_)
setDevWallet(address wallet_)
setTicketCaps(uint16 saleCap_, uint16 marketingCap_)
configureChapter(uint256 chapterId, address main_, uint16 saleCap_, uint16 marketingCap_, string ticketBaseURI_)
setChapterActive(uint256 chapterId, bool active_)
setChapterTicketBaseURI(uint256 chapterId, string calldata newUri)
setDistributor(address dist)
clearDistributor()
setBiggiToken(address token)
setBiggiRate(uint256 _biggiPerEth)
setTokenSink(address sink, uint256 bps)
setTokenSinkDepositMode(bool enabled)
setReserveAddress(address _reserve)
setTicketPrice(uint256 _ticketPrice)
setPriceIncreasePerMint(uint256 _priceIncreasePerMint)
setTicketBaseURI(string calldata newUri)
setContractURI(string calldata newUri)
mintMarketingTicket(address to)
mintMarketingTicketForChapter(uint256 chapterId, address to)
mintMarketingTicketsForChapter(uint256 chapterId, address to, uint16 amount)
pause()
unpause()
```

## Runtime invariants
- `saleCap + marketingCap` must equal `MAX_TICKETS`
- each chapter has 500 sale tickets plus 50 fully functional marketing tickets
- paid mint and redeem remain closed until `setChapterActive(chapterId, true)`
- every chapter uses a distinct ticket metadata base URI and ticket image
- the 10-ticket wallet limit is counted independently for each chapter
- `setMainCollection(...)` requires the target main to accept this hub binding
- `setBiggiRate(...)` rejects zero and BIGGI minting rejects a zero computed token payment
- `mintTicket()` distributes only the current ticket price and refunds native overpay
- mainnet-prep BIGGI payment routing uses `tokenSink = BiggiTreasury`, `tokenSinkBps = 10000`, `tokenSinkDepositMode = true`
- treasury deposit mode requires `BiggiTreasury.setEcosystemBiggiCaller(TicketHub, true)`
- if deposit mode is disabled, `tokenSink` receives a plain BIGGI transfer and does not split through treasury

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `TICKET_HUB` | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| `OLD_TICKET_HUB` | `0xe6d742D7DC66fA63434E6794C69798A5272e9873` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
