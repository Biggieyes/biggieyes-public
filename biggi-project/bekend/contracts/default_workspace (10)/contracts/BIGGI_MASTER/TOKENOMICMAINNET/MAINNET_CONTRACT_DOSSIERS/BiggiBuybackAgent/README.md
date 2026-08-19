# BiggiBuybackAgent Mainnet Dossier

## Source of truth

- Source file: `../../BiggiBuybackAgent.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address biggiToken, address initialOwner)`

## Runtime role

`BiggiBuybackAgent` is the POL-to-BIGGI buyback executor.

It receives distributor native share through `receiveMintShare()`. Depending on configuration, it either:

- auto-swaps native value for BIGGI and routes BIGGI to treasury for split accounting
- keeps native balance for later manual buyback
- falls back to forwarding native value to treasury when the auto-flow fails

Runtime policy comes from `BiggiPolicy` when configured. Without policy, the contract falls back to local slippage, deadline, and cooldown values.

Keeper execution must resolve protected swap output first. `previewAutoMinOut(uint256)` exposes the same quote/slippage calculation used by the agent's auto-flow so the upkeep proxy can refuse execution when the protected minimum output is zero.

## Main write paths

- `receiveMintShare()`
- `buybackAllToTreasury(uint256)`
- `buybackAmountToTreasury(uint256,uint256)`
- `toggleAutoBuyback(bool)`
- `previewAutoMinOut(uint256)` view helper for keeper/front-end safety checks

## Owner/admin surface

- `setRouter(address)`
- `setTreasury(address)`
- `setPolicy(address)`
- `setDripLM(address)`
- `setDistributor(address)`
- `setKeeper(address)`
- `setSwapPath(address[])`
- `clearSwapPath()`
- `setFallbacks(uint256,uint256,uint256)`
- `toggleAutoBuyback(bool)`
- `pause()`
- `unpause()`
- `rescueERC20(address,address,uint256)`
- `rescueNative(address,uint256)`

## Integration map

- `BiggiPolicy` provides buyback policy and quota rules
- `BiggiTreasury` receives acquired BIGGI or fallback native value
- `dripLM` can be notified on successful BIGGI buybacks
- distributor is the intended runtime source for native buyback funding
- `BiggiBuybackUpkeepProxy` previews protected `minOut` and does not call buyback execution with `minOut == 0`

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `BUYBACK_AGENT` | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
