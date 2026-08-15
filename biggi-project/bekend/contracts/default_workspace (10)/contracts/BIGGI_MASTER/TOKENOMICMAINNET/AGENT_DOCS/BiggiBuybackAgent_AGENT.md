# Agent documentation — BiggiBuybackAgent.sol

**Role:** Buyback execution module

## Purpose
Receives native funds, swaps to BIGGI through router, forwards BIGGI to Treasury, optionally coordinates with policy and drip LM.

## Top-level declarations
- Contracts/libraries: BiggiBuybackAgent, so
- Interfaces in file: IUniswapV2Router02, IBiggiTreasury, IBiggiPolicy, IDripLM

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol`
- `./TOKENOMIC_LIBRARY/BiggiSwapLib.sol`

## Key public state to inspect
- `immutable`
- `router`
- `wrappedNative`
- `treasury`
- `policy`
- `dripLM`
- `keeper`
- `fallbackSwapSlippageBps`
- `fallbackTxDeadlineSec`
- `fallbackMinIntervalSec`
- `lastBuybackAt`
- `totalNativeReceived`
- `totalNativeSpent`
- `totalBiggiAcquired`
- `autoBuybackEnabled`
- `paused`

## Key functions
- `WETH()`
- `swapExactETHForTokens()`
- `swapExactETHForTokensSupportingFeeOnTransferTokens()`
- `getAmountsOut()`
- `buybackDepositAndSplit()`
- `swapSlippageBps()`
- `txDeadlineSec()`
- `minBuybackInterval()`
- `buybacksPaused()`
- `maxDailyBuybackNative()`
- `consumeDailyBuybackQuota()`
- `dripOnBuy()`
- `setRouter()`
- `setTreasury()`
- `setPolicy()`
- `setDripLM()`
- `setKeeper()`
- `setSwapPath()`
- `clearSwapPath()`
- `setFallbacks()`
- … plus 17 more

## Integration points
- Review file-local interfaces and imports before changing any external call patterns.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- File name uses `BuyBack` while contract name is `BiggiBuybackAgent`. Keep deployment tooling aware of this naming mismatch or rename deliberately in a controlled migration.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).
