# Agent documentation — BiggiTreasury.sol

**Role:** Treasury split and top-up module

## Purpose
Receives BIGGI and POL, splits/refills token rewards, drip distributor, reserve, and possibly triggers reserve top-up.

## Top-level declarations
- Contracts/libraries: BiggiTreasury
- Interfaces in file: IBiggiDripDistributorDeposit

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `./Library/BiggiBpsLib.sol`
- `./Library/BiggiErrorsLib.sol`

## Key public state to inspect
- `immutable`
- `distributor`
- `buybackAgent`
- `tokenRewards`
- `reserveAddr`
- `dripDistributor`
- `totalBiggiReceived`
- `totalPolReceived`
- `historicalTotalsSeeded`

## Key functions
- `depositTokens()`
- `setDistributor()`
- `setBuybackAgent()`
- `setTokenRewards()`
- `setReserve()`
- `setDripDistributor()`
- `seedHistoricalTotals()`
- `depositPolFromDistributor()`
- `receiveMintShare()`
- `_recordPolFromDistributor()`
- `buybackDepositAndSplit()`
- `ownerDepositAndSplit()`
- `_splitBuybackBiggi()`
- `_approveToken()`
- `biggiBalance()`
- `polBalance()`
- `totalBiggiReceivedFromBuyback()`
- `totalPolReceivedFromDistributor()`
- `rescueERC20()`
- `rescueETH()`

## Integration points
- Split/forwarding hub; downstream accounting assumptions depend on its routing remaining stable.

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