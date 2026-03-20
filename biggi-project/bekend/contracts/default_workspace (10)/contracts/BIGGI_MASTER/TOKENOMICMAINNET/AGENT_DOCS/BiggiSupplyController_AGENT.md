# Agent documentation — BiggiSupplyController.sol

**Role:** Supply maintenance execution layer

## Purpose
Execution contract that decides/refills drip inventory and token rewards based on reserve and balance thresholds.

## Top-level declarations
- Contracts/libraries: BiggiSupplyController
- Interfaces in file: IUniswapV2PairLite, IBiggiSupplyToken, IERC20Lite

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`

## Key public state to inspect
- `immutable`
- `immutable`
- `immutable`
- `pair`
- `baselineReserve`
- `minimumReserveFloor`
- `reserveDropBps`
- `autoRefreshBaselineOnDexRefill`
- `dexRefillAmount`
- `dexCooldown`
- `lastDexRefill`
- `rewardsThreshold`
- `rewardsRefillAmount`
- `rewardsCooldown`
- `lastRewardsRefill`
- `keepers`

## Key functions
- `getReserves()`
- `token0()`
- `token1()`
- `mintToDripDistributor()`
- `mintToTokenRewards()`
- `balanceOf()`
- `pause()`
- `unpause()`
- `setKeeper()`
- `setPair()`
- `setDexConfig()`
- `setRewardsConfig()`
- `snapshotBaseline()`
- `previewMaintenance()`
- `performMaintenance()`
- `checkDexDepletion()`
- `checkRewardsThreshold()`
- `_single()`
- `checkUpkeep()`
- `performUpkeep()`
- … plus 5 more

## Integration points
- Review file-local interfaces and imports before changing any external call patterns.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- `performUpkeep(bytes)` currently ignores performData and delegates to `performMaintenance()`. This is acceptable but less deterministic for offchain simulation/debugging.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).