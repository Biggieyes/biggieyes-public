# BiggiSupplyController Mainnet Dossier

## Source of truth

- Source file: `../../BiggiSupplyController.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner, address token_, address dripDistributor_, address tokenRewards_, address pair_)`

## Runtime role

`BiggiSupplyController` is the bounded refill controller for BIGGI supply support.

It holds configuration for two branches:

- DEX/refill support
- token rewards support

It is intended to decide when to mint additional BIGGI into the drip or rewards branches under configured thresholds, cooldowns, and circuit-breaker settings.

Current DEX refill execution is not a direct mint into the LP pair. `refillDex(uint256)` calls `BiggiToken.mintToDripDistributor(amount)`, so the DEX refill branch increases `BiggiDripDistributor` inventory. Any actual DEX pair replenishment then depends on downstream drip/sell or liquidity flows.

## Owner/admin surface

- `setKeeper(address,bool)`
- `setAllowedCaller(address,bool)`
- `setPair(address)`
- `setDexConfig(uint256,uint256,uint256,uint256,bool)`
- `setRewardsConfig(uint256,uint256,uint256)`
- `setCircuitBreakerConfig(bool,uint256,uint256)`
- `pause()`
- `unpause()`

## Integration map

- `BiggiToken` is the minting backend through `mintToDripDistributor` and `mintToTokenRewards`
- `BiggiDripDistributor` and `BiggiTokenRewards` are refill destinations
- `BiggiSupplyGuardian` mirrors critical allowlist changes onto this controller

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `SUPPLY_CONTROLLER` | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
