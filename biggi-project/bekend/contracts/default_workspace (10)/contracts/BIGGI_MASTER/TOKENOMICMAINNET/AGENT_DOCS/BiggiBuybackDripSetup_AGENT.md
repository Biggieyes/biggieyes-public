# Agent documentation — BiggiBuybackDripSetup.sol

**Role:** Setup orchestrator

## Purpose
One-shot/owner wiring helper for buyback, drip LM, drip distributor, and supply controller pair setup.

## Top-level declarations
- Contracts/libraries: BiggiBuybackDripSetup
- Interfaces in file: IBiggiBuybackAgent, IBiggiDripLiquidityManager, IDripDistributorSetup, IBiggiTokenSupplySetup, IBiggiSupplyControllerSetup

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable.sol`

## Key public state to inspect
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `tokenAddr`
- `supplyController`
- `executed`

## Key functions
- `setRouter()`
- `setTreasury()`
- `setPolicy()`
- `setDripLM()`
- `setSwapPath()`
- `clearSwapPath()`
- `setFallbacks()`
- `toggleAutoBuyback()`
- `setRouter()`
- `setReserve()`
- `setDripDistributor()`
- `setBuybackAgent()`
- `setSellPct()`
- `setSlippageBps()`
- `setTxDeadlineSec()`
- `setDripLM()`
- `setTreasury()`
- `setTokensPerMint()`
- `setCollection()`
- `setSupplyController()`
- … plus 12 more

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