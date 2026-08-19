# Agent documentation — BiggiLiquidityKeeperProxy.sol

**Role:** Keeper proxy for liquidity pairing

## Purpose
Automation-compatible proxy that sizes and triggers reserve->LM pairing through orchestrator.

## Top-level declarations
- Contracts/libraries: BiggiLiquidityKeeperProxy
- Interfaces in file: ILiquidityOrchestrator, IReserveForKeeper

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable2Step.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`

## Key public state to inspect
- `orchestrator`
- `reserve`
- `allowedCaller`
- `amountMode`
- `fixedAmount`
- `percentBps`
- `minIntervalSec`
- `lastPerformTs`
- `minReservePol`
- `maxPerTx`
- `minDexRefillBiggi`

## Key functions
- `triggerPairing()`
- `polBalance()`
- `dexRefillBiggi()`
- `setOrchestrator()`
- `setReserve()`
- `setAllowedCaller()`
- `setStrategy()`
- `setLimits()`
- `pauseAll()`
- `unpauseAll()`
- `checkUpkeep()`
- `performUpkeep()`
- `adminTrigger()`
- `computedAmountNow()`
- `_computeAmount()`

## Integration points
- This contract is orchestration/config glue. It should not become a new source of business logic unless deliberately planned.

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