# BiggiMainReader - Mainnet Dossier

## Source of truth
- Source file: `CORE_READERS/BiggiMainReader.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: current TicketHub-aware reader live and verified on Polygon mainnet as of 2026-08-17.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address mainContract, address ticketHub_, address collectionRewards_)
```

## Main role
- read-only aggregation layer for `BiggiMain`
- reads ticket sale state from `BiggiTicketHub`
- reads reward counters from `BiggiCollectionRewards`
- exposes block price, mint count, reward counter, and ticket search helpers

## Read surface
```solidity
getAllBlockPrices()
getAllBlockMintCounts()
getAllBackgroundMintCounts()
getMintDataByTokenId(uint256 tokenId)
getRewardsCounters()
getFrontendSnapshot()
getTicketHubFrontendSnapshot(address user, address treasury)
findTicket(address owner)
```

`getTicketHubFrontendSnapshot(user, treasury)` is the frontend payment-readiness view for TicketHub. It returns the ticket caps, user ticket count, ticket price in native wei, computed ticket price in BIGGI, pause state, token sink settings, treasury allowlist state, and `ecosystemTreasuryRouteOk`.

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `MAIN_READER` | `0x4937CdcF1668255Cb46c78E19547ea96C94391Ef` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
