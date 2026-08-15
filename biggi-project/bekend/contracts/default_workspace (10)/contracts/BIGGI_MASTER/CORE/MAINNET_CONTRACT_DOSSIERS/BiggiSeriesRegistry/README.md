# BiggiSeriesRegistry - Mainnet Prep Dossier

## Source of truth
- Source file: `BiggiSeriesRegistry.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address initialOwner)
```

## Main role
- creates series and chapters
- binds chapter VRF collection, public collection, and ticket hub
- tracks chapter ownership of collection addresses
- stores token-reward and collection-reward eligibility flags

## Owner/admin surface
```solidity
createSeries(string calldata name)
createChapter(uint256 seriesId)
setChapterCollections(uint256 chapterId, address vrfCollection, address publicCollection, address ticketHub)
setRewardsEligibility(uint256 chapterId, bool tokenRewardsVRF, bool tokenRewardsPublic, bool collectionRewardsVRF)
```

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `REGISTRY` | `0x5CFe3ed77386e71cd89EA3f5d0a8906F78785013` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
