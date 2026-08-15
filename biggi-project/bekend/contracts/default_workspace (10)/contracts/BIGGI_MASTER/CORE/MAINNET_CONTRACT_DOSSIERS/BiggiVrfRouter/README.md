# BiggiVrfRouter - Mainnet Prep Dossier

## Source of truth
- Source file: `BiggiVrfRouter.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address vrfCoordinator_, address initialOwner, bytes32 keyHash_, uint256 subId_)
```

## Main role
- wraps Chainlink VRF V2 Plus requests
- accepts randomness requests from the bound main contract or approved mains
- accepts randomness requests for rewards from approved reward consumers
- forwards fulfilled randomness to either `fulfillRandomFromRouter(...)` or `fulfillRandom(...)`
- keeps request metadata for debugging and UI

## Owner/admin surface
```solidity
setMain(address main_)
setMainApproval(address main_, bool approved)
setRewardConsumerApproval(address consumer, bool approved)
setVrfParams(bytes32 keyHash_, uint256 subId_, uint32 gas_, uint16 conf_, uint32 numWords_)
```

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `VRF_ROUTER` | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
