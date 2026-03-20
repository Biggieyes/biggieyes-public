# Agent documentation — BiggiDripKeeperProxy.sol

**Role:** Automation proxy for drip branch

## Purpose
External automation wrapper that triggers drip-related maintenance/actions under owner-configured rules.

## Top-level declarations
- Contracts/libraries: DripKeeperProxy
- Interfaces in file: None

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`

## Key public state to inspect
- `dripLM`
- `keepers`

## Key functions
- `setDripLM()`
- `setKeeper()`
- `pause()`
- `unpause()`
- `performDrip()`
- `_forwardDripCall()`
- `checkUpkeep()`
- `performUpkeep()`
- `ownerCallDripLM()`

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