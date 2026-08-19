# Agent documentation — BiggiLiquidityAutomation.sol

**Role:** Liquidity branch automation helper

## Purpose
Calculates/executes liquidity maintenance decisions based on reserve, router, and liquidity manager state.

## Top-level declarations
- Contracts/libraries: LiquidityAutomation
- Interfaces in file: ILiquidityManager, IReserveV4View, IRouterLike

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`

## Key public state to inspect
- `lm`
- `immutable`
- `minPolWei`
- `maxPolWei`
- `minIntervalSec`
- `lastUpkeepTime`

## Key functions
- `executePairing()`
- `router()`
- `reserve()`
- `tokenPct()`
- `getPolAvailable()`
- `availableForDexRefill()`
- `WETH()`
- `getAmountsOut()`
- `setLimits()`
- `setMinInterval()`
- `setLM()`
- `checkUpkeep()`
- `performUpkeep()`
- `_computeRequested()`
- `_safeGetPol()`
- `_safeBiggi()`

## Integration points
- Review file-local interfaces and imports before changing any external call patterns.

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