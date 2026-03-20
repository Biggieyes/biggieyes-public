# Agent documentation — BiggiDripDistributor.sol

**Role:** Drip token inventory accounting

## Purpose
Custodies drip BIGGI inventory, tracks available tokens, and serves Drip LM / treasury top-ups.

## Top-level declarations
- Contracts/libraries: BiggiDripDistributor, notification
- Interfaces in file: None

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`
- `./Library/BiggiErrorsLib.sol`
- `./Library/BiggiCapsLib.sol`

## Key public state to inspect
- `immutable`
- `dripLM`
- `treasury`
- `tokensPerMintOperator`
- `tokensPerMint`
- `availableTokens`
- `totalReceived`
- `totalClaimed`
- `totalNotified`
- `historicalStateSeeded`
- `constant`
- `collections`

## Key functions
- `syncAvailableToBalance()`
- `setCollection()`
- `setDripLM()`
- `setTreasury()`
- `setTokensPerMintOperator()`
- `setTokensPerMint()`
- `setTokensPerMintFromOperator()`
- `seedHistoricalState()`
- `pause()`
- `unpause()`
- `notifyMint()`
- `notifyTokenMint()`
- `depositTokens()`
- `claim()`
- `claimTo()`
- `rescueERC20()`
- `rescueNative()`
- `biggiBalance()`
- `effectiveAvailable()`
- `getAvailable()`
- … plus 6 more

## Integration points
- Inventory/accounting layer; available balances and caps must stay aligned with actual token transfers.

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