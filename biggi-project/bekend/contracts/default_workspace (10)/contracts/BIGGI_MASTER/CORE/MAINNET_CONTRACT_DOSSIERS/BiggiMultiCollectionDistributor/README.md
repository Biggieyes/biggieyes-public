# BiggiMultiCollectionDistributor - Mainnet Prep Dossier

## Source of truth
- Source file: `BiggiMultiCollectionDistributor.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address initialOwner)
```

## Main role
- receives native mint-share from whitelisted collections
- splits incoming value using `BiggiBpsLib`
- forwards value to collection rewards, reserve, buyback, treasury, and community sinks
- accumulates failed forwards as pending balances for owner retry
- optionally attributes received volume by chapter and series through registry
- registry attribution is non-blocking; failed registry calls emit `ChapterAttributionFailed` and native recipient routing continues

## Owner/admin surface
```solidity
addCollection(address coll)
removeCollection(address coll)
setRegistry(address registry_)
clearRegistry()
setCollectionRewards(address addr)
setReserve(address addr)
setBuybackAgent(address addr)
setTreasury(address addr)
setCommunityCenter(address addr)
retryPending(address recipient)
retryPendingAmount(address recipient, uint256 amount)
withdrawEther(address payable to, uint256 amount)
pause()
unpause()
```

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `DISTRIBUTOR` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
