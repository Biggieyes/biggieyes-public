# Agent documentation — BiggiTokenomikReader.sol

**Role:** Whole tokenomics dashboard reader

## Purpose
High-level aggregated reader across distributor, buyback, reserve, liquidity, drip, treasury, etc.

## Top-level declarations
- Contracts/libraries: BiggiTokenomikReader
- Interfaces in file: IUniswapV2Pair, IUniswapV2Router02, IMultiCollectionDistributor, IBuybackAgent, IReserveV4, ILiquidityManager, ILiquidityVault, IDripDistributor, IBiggiDripLMView, ITokenRewards

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol`

## Key public state to inspect
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`

## Key functions
- `token0()`
- `token1()`
- `getReserves()`
- `totalSupply()`
- `decimals()`
- `WETH()`
- `getAmountsOut()`
- `totalReceived()`
- `pending()`
- `collectionRewards()`
- `reserve()`
- `buybackAgent()`
- `treasury()`
- `communityCenter()`
- `nativeBalance()`
- `biggiBalance()`
- `totalNativeReceived()`
- `totalNativeSpent()`
- `totalBiggiAcquired()`
- `autoBuybackEnabled()`
- … plus 41 more

## Integration points
- Read-only surface for UI/agents; changing return shapes will break dashboards and scripts first.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- No file-specific issue flagged in this pass beyond standard tokenomics/change-management caution.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).