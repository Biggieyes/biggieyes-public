# Agent documentation — BiggiTokenRewardsReader.sol

**Role:** Token rewards reader

## Purpose
Read-only snapshot helper for TokenRewards balances, cap, metadata, and status.

## Top-level declarations
- Contracts/libraries: BiggiTokenRewardsReader
- Interfaces in file: IBiggiTokenRewards

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol`

## Key public state to inspect
- `immutable`

## Key functions
- `mainNFT()`
- `main2NFT()`
- `biggi()`
- `unitReward()`
- `getBlockWeights()`
- `rewardsCap()`
- `rewardsMinted()`
- `rewardsCapRemaining()`
- `tokenRemainingMintable()`
- `totalDistributed()`
- `distributedThisWeek()`
- `lastWeekDistributed()`
- `currentWeek()`
- `lastRecordedWeek()`
- `tokenMeta()`
- `claimablePreview()`
- `claimablePreviewFor()`
- `nextClaimWeekFor()`
- `nextClaimWeekForCollection()`
- `isAllowedCollection()`
- … plus 8 more

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