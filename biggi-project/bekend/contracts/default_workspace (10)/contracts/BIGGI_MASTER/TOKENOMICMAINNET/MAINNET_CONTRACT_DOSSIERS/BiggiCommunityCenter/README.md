# BiggiCommunityCenter Mainnet Dossier

## Source of truth

- Source file: `../../BiggiCommunityCenter.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner)`

## Runtime role

`BiggiCommunityCenter` is the owner-curated community grants and event payout pool.

It receives POL into `poolBalance` from:

- distributor through `depositFromDistributor()` or `receiveMintShare()`
- owner through `ownerDeposit()`
- direct donations through `receive()`

Owner creates events with:

- title and IPFS metadata
- event time window
- fixed winner list
- fixed amount per winner

At creation time, the prize amount is locked from available pool balance. Winners later claim their assigned POL through `claim(uint256)`.

## Owner/admin surface

- `setDistributor(address)`
- `createEvent(...)`
- `ownerDeposit()`
- `rescuePool(address,uint256)`
- `emergencyWithdraw(address)`
- `pause()`
- `unpause()`

## Integration map

- distributor is the intended official POL source
- winners claim directly from the contract
- downstream readers or frontend helpers can use the getter set for event status and winner allocations

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `COMMUNITY_CENTER` | `0x81C6E90a991d7D210c43B00B7EB1a5450cc372Ae` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
