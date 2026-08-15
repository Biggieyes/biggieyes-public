# BiggiMain - Mainnet Prep Dossier

## Source of truth
- Source file: `BiggiMain.sol`
- Frozen ABI: `./ABI.json`
- External linked library: `CORE_LIBRARY/BiggiNamesLib.sol`
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address initialOwner)
```

## Main role
- VRF-backed chapter collection
- receives redeem requests from `BiggiTicketHub`
- requests randomness through `BiggiVRFRouter`
- finalizes NFT mint with metadata and price snapshots
- tracks block/background mint counts and character reward mints

## Owner/admin surface
```solidity
setModules(address compute_, address vrfRouter_)
setTicketHub(address hub)
setPendingRetryDelay(uint64 delaySec)
setContractURI(string calldata newUri)
setBlockCurrentPrice(uint16 blockIdx, uint256 newPrice)
setURI(uint8 category, uint16 idx, string calldata uri)
batchSetNFTBackgroundAndBlock(...)
ownerRetryPendingMint(address user)
emergencyResolvePendingMint(address user, uint256 preferredIndex)
pause()
unpause()
```

## Privileged runtime paths
- `redeemFromTicketHub(...)` can only be called by the configured ticket hub
- `fulfillRandomFromRouter(...)` can only be called by the configured VRF router

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `MAIN` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
