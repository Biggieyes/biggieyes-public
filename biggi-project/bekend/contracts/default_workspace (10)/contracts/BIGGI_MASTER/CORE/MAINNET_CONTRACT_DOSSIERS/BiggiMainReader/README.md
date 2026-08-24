# BiggiMainReader - Mainnet Dossier

## Source of truth
- Source file: `CORE_READERS/BiggiMainReader.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: current CollectionRewards-aware reader live and verified on Polygon mainnet as of 2026-08-24.
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
| `MAIN_READER` | `0xde05be77024eABf37E4eA4fbBD58F161081be2f3` |

Deployment transaction: `0xdc90981a1a510f0f72e8c645fde0af725e3bad5036f70280157b86f43bfdb659`.

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
