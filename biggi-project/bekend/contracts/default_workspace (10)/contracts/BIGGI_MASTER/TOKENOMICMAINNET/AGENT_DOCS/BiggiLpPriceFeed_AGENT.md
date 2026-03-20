# Agent documentation — BiggiLpPriceFeed.sol

**Role:** LP price estimation helper

## Purpose
Reads pair reserves / supply to expose LP-token price-like metrics for UI/ops.

## Top-level declarations
- Contracts/libraries: BiggiLpPriceFeed
- Interfaces in file: IUniswapV2PairLike

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable.sol`

## Key public state to inspect
- `BIGGI`
- `WETH`
- `pair`
- `roundId`
- `answer`
- `startedAt`
- `updatedAt`
- `answeredInRound`

## Key functions
- `getReserves()`
- `token0()`
- `token1()`
- `decimals()`
- `latestRoundData()`
- `readReserves()`
- `setPair()`
- `setTokens()`
- `setDecimals()`
- `updateFromReserves()`
- `_requirePairMatchesTokens()`

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