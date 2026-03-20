# Agent documentation — BiggiLiquidityManager.sol

**Role:** Reserve pairing executor

## Purpose
Pulls BIGGI and POL from reserve, adds LP through router, routes LP to vault, and handles rollback paths.

## Top-level declarations
- Contracts/libraries: BiggiLiquidityManager
- Interfaces in file: IUniswapV2Router02, IUniswapV2Factory, IUniswapV2Pair, ILiquidityVault, IReserveV4

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`

## Key public state to inspect
- `immutable`
- `router`
- `factory`
- `reserve`
- `liquidityVault`
- `keeper`
- `tokenPct`
- `slippageBps`
- `txDeadlineSec`
- `autoTopUpEnabled`
- `autoTriggerMinPolWei`
- `autoRequestPolWei`

## Key functions
- `WETH()`
- `getAmountsOut()`
- `addLiquidityETH()`
- `getPair()`
- `token0()`
- `token1()`
- `getReserves()`
- `syncPairBalance()`
- `lmPullBiggiDexRefill()`
- `lmPullPolDexRefill()`
- `notifyBiggiReceived()`
- `setRouter()`
- `setFactory()`
- `setReserve()`
- `setLiquidityVault()`
- `setKeeper()`
- `setTokenPct()`
- `setSlippageBps()`
- `setTxDeadlineSec()`
- `setAutoTopUpConfig()`
- … plus 12 more

## Integration points
- Review file-local interfaces and imports before changing any external call patterns.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- Confirm failed add-liquidity refund paths and owner refund assumptions match intended reserve accounting before production deployment.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).