# Agent documentation — ModeratorCenter.sol

**Role:** Moderator slot/payout manager

## Purpose
Ownable slot registry with password/referral/payout logic for moderator program.

## Top-level declarations
- Contracts/libraries: ModeratorCenter, uint256
- Interfaces in file: None

## Imports / external dependencies
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/Address.sol`

## Key public state to inspect
- `constant`
- `constant`
- `slots`
- `reporters`
- `leaderCoefBps`
- `moderatorCoefBps`
- `saleBoostBpsPerTicket`
- `milestone100`
- `milestone500`
- `milestone1000`
- `weekUniqueCount`
- `weekTicketCount`
- `usedThisWeekForSlot`
- `globalUniquePerWeek`
- `usedThisWeekGlobally`
- `milestonePaid`
- `multiCollection`
- `weekAllocated`

## Key functions
- `configureSlot()`
- `setPasswordHash()`
- `setReferralHash()`
- `setPayoutAddress()`
- `setReporter()`
- `setCoefs()`
- `setMilestones()`
- `setGlobalUniquePerWeek()`
- `setMultiCollection()`
- `registerReferral()`
- `recordTicketSale()`
- `notifyAllocation()`
- `distributeWeekRewards()`
- `_slotForReferral()`
- `_tryPayMilestones()`
- `_payToSlot()`
- `getSlotInfo()`
- `getWeekStats()`
- `withdrawToOwner()`

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