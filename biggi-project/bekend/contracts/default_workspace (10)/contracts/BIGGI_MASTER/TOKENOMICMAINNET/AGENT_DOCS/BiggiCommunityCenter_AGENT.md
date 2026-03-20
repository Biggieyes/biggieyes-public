# Agent documentation — BiggiCommunityCenter.sol

**Role:** Community treasury/actions module

## Purpose
Ownable, pausable payout/community action contract for smaller allocations or campaigns.

## Top-level declarations
- Contracts/libraries: BiggiCommunityCenter, balance
- Interfaces in file: None

## Imports / external dependencies
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`
- `@openzeppelin/contracts/utils/Address.sol`
- `@openzeppelin/contracts/access/Ownable.sol`

## Key public state to inspect
- `distributor`
- `poolBalance`
- `totalLocked`
- `nextEventId`
- `events`

## Key functions
- `setDistributor()`
- `depositFromDistributor()`
- `receiveMintShare()`
- `ownerDeposit()`
- `createEvent()`
- `claim()`
- `getEvents()`
- `getEvent()`
- `getEventWinners()`
- `balanceOfEvent()`
- `assignedAmountOf()`
- `userStatus()`
- `canClaim()`
- `rescuePool()`
- `emergencyWithdraw()`
- `pause()`
- `unpause()`

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