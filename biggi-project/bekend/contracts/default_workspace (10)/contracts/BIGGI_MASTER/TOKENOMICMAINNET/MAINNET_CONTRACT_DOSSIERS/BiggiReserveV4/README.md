# BiggiReserveV4 Mainnet Dossier

## Source of truth

- Source file: `../../BiggiReserveV4.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address biggi, address owner_)`

## Runtime role

`BiggiReserveV4` is the reserve branch for both native POL inflow and BIGGI bucket accounting.

It tracks two BIGGI buckets:

- `WAITING`
- `DEX_REFILL`

It receives:

- distributor POL through `receiveMintShare()`
- BIGGI bucket notifications through `onBiggiMintedToReserve(uint256,bytes32)`
- compatibility BIGGI notifications through `notifyBiggiReceived(uint256)`

It can then release assets to `BiggiLiquidityManager` through:

- `lmPullBiggiDexRefill(address,uint256)`
- `lmPullPolDexRefill(address,uint256)`

Reserve can request the liquidity branch in two runtime moments:

- after distributor POL/native reaches `receiveMintShare()`
- after BIGGI is added to the `DEX_REFILL` bucket through `onBiggiMintedToReserve(..., DEX_REFILL)` or `notifyBiggiReceived(uint256)`

The liquidity attempt remains threshold-based in `BiggiLiquidityManager`; a mint does not force LP creation if POL, BIGGI, router, vault, quote, or slippage conditions are not ready.

## Owner/admin surface

- `setLiquidityManager(address)`
- `setDistributor(address)`
- `setNotifyCaller(address,bool)`
- `setNotifyCallerCheck(bool)`
- `ownerTopUpDexRefill(uint256)`
- `pause()`
- `unpause()`

## Integration map

- `BiggiLiquidityManager` is the only intended runtime puller for reserve liquidity operations
- `BiggiTreasury` may notify reserve when reserve-side BIGGI is split from buybacks or ecosystem BIGGI NFT payments
- `BiggiToken` and explicitly allowed callers can feed bucketed BIGGI accounting
- `notifyBiggiReceived()` does not auto-trigger LM when the caller is the liquidity manager returning leftovers

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `RESERVE` | `0x2786e46e01a5d229118fEdC102267217C7e94574` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
