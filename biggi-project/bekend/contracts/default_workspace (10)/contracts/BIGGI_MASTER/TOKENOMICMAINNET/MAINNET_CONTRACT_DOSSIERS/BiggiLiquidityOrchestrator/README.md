# BiggiLiquidityOrchestrator Mainnet Dossier

## Source of truth

- Source file: `../../BiggiLiquidityOrchestrator.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address reserve_, address lm_, address owner_)`

## Runtime role

`BiggiLiquidityOrchestrator` is the policy and rate-limit layer above `BiggiLiquidityManager`.

It does not custody funds. It enforces:

- min and max POL per pairing run
- minimum BIGGI refill threshold
- cooldown between runs
- optional daily POL quota
- reserve/LM/vault wiring consistency checks

## Owner/admin surface

- `setKeeper(address)`
- `setReserve(address)`
- `setLM(address)`
- `setLimits(uint256,uint256,uint256,uint256,uint256)`
- `pauseAll()`
- `unpauseAll()`

## Main write paths

- `triggerPairing(uint256)`
- `requestReserveTopUp()`

## Integration map

- reads reserve balances from `BiggiReserveV4`
- triggers execution on `BiggiLiquidityManager`
- checks downstream vault wiring before allowing a run

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `LIQUIDITY_ORCHESTRATOR` | `0xC72DB11941d8Ab76baF84B1af9dB43E09060b681` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
