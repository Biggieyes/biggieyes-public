# BiggiTokenRewards - Mainnet Prep Dossier

## Source of truth
- Source file: `BiggiTokenRewards.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address mainNFT_, address main2NFT_, address biggiToken_, address owner_)
```

## Main role
- calculates weekly reward units from owned NFTs
- transfers BIGGI from balance first, then mints remainder
- enforces a global mint cap from `BiggiCapsLib`
- supports registry-based or allowlist-based collection validation

## Owner/admin surface
```solidity
pauseAll()
unpauseAll()
setTreasure(address treasure_)
setRegistry(address registry_)
clearRegistry()
setUnitReward(uint256 newUnit)
setBlockWeights(uint8[11] calldata weights)
setCollectionAllowed(address coll, bool allowed)
```

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `TOKEN_REWARDS` | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
