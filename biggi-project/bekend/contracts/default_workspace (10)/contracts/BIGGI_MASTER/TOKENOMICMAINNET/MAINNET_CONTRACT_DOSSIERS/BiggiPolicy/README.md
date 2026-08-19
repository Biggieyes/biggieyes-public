# BiggiPolicy Mainnet Dossier

## Source of truth

- Source file: `../../BiggiPolicy.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner)`

## Runtime role

`BiggiPolicy` is the buyback policy and quota contract.

It stores the mutable policy values consumed by `BiggiBuybackAgent`:

- swap slippage in BPS
- transaction deadline
- minimum buyback interval
- pause flag for buybacks
- max daily native spend

It also tracks per-day quota consumption through `consumeDailyBuybackQuota(uint256)`.

## Owner/admin surface

- `setSwapSlippageBps(uint256)`
- `setTxDeadlineSec(uint256)`
- `setMinBuybackInterval(uint256)`
- `setBuybacksPaused(bool)`
- `setMaxDailyBuybackNative(uint256)`
- `setBuybackAgent(address)`

## Integration map

- `BiggiBuybackAgent` reads policy values at runtime
- `BiggiBuybackAgent` is the intended caller for quota consumption

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `POLICY` | `0x50485231A0602DE7a7b64e2760EF21133c77a43C` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
