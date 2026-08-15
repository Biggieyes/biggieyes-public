# BiggiLiquidityManager Mainnet Dossier

## Source of truth

- Source file: `../../BiggiLiquidityManager.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address token_, address router_, address liquidityVault_, address initialOwner, address reserve_)`

## Runtime role

`BiggiLiquidityManager` is the execution branch that turns reserve-side BIGGI and POL into DEX liquidity.

Core runtime flow:

1. quote required BIGGI amount for requested POL
2. pull BIGGI from `BiggiReserveV4`
3. pull POL from `BiggiReserveV4`
4. call router liquidity add flow
5. return leftovers and sync LP accounting in `LiquidityVault`

It also supports reserve-triggered auto pairing through `onReserveTopUpRequest()`.

Auto pairing is not unconditional per mint. The reserve can call `onReserveTopUpRequest()` after native or DEX-refill BIGGI arrives, but the manager only executes when `autoTopUpEnabled` is true, reserve POL is above `autoTriggerMinPolWei`, router/vault wiring is present, and quote-derived token demand can be pulled from `dexRefillBiggi`.

## Owner/admin surface

- `setRouter(address)`
- `setFactory(address)`
- `setReserve(address)`
- `setLiquidityVault(address)`
- `setKeeper(address)`
- `setTokenPct(uint8)`
- `setSlippageBps(uint256)`
- `setTxDeadlineSec(uint256)`
- `setAutoTopUpConfig(bool,uint256,uint256)`

## Main write paths

- `onReserveTopUpRequest()`
- `executePairing(uint256)`
- `executePairingFromReserve(uint256)`

## Integration map

- `BiggiReserveV4` is the only intended asset source
- `LiquidityVault` is the LP custody target
- DEX router and optional factory drive quoting and add-liquidity execution
- `BiggiLiquidityOrchestrator` can act as higher-level trigger logic
- `BiggiLiquidityKeeperProxy` / `LiquidityAutomation` can trigger the same pairing later when reserve balances pass configured limits

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `LIQUIDITY_MANAGER` | `0xfb770C5A5AC6e41C85f076DB7C3434eAcd8e0F19` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
