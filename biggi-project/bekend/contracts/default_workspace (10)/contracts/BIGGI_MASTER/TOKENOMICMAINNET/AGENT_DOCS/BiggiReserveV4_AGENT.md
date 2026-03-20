# Agent documentation — BiggiReserveV4.sol

**Role:** Reserve and liquidity bucket contract

## Purpose
Holds POL and BIGGI, tracks WAITING/DEX_REFILL buckets, and serves LiquidityManager pull API.

## Top-level declarations
- Contracts/libraries: BiggiReserveV4
- Interfaces in file: IBiggiReserveV4, ILiquidityManagerTrigger

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable2Step.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `./Library/BiggiErrorsLib.sol`

## Key public state to inspect
- `constant`
- `constant`
- `immutable`
- `liquidityManager`
- `distributor`
- `totalPolReceived`
- `waitingBiggi`
- `dexRefillBiggi`

## Key functions
- `lmPullBiggiDexRefill()`
- `lmPullPolDexRefill()`
- `onReserveTopUpRequest()`
- `setLiquidityManager()`
- `setDistributor()`
- `pause()`
- `unpause()`
- `receiveMintShare()`
- `onBiggiMintedToReserve()`
- `notifyBiggiReceived()`
- `ownerTopUpDexRefill()`
- `requestTopUpToLM()`
- `_tryTriggerTopUpToLM()`
- `lmPullBiggiDexRefill()`
- `lmPullPolDexRefill()`
- `biggiBalance()`
- `polBalance()`
- `getPolAvailable()`
- `availableForDexRefill()`

## Integration points
- Core source of truth for reserve-side POL/BIGGI bucket accounting and liquidity-manager pull permissions.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- `notifyBiggiReceived(uint256)` is intentionally permissive in this snapshot; only real token balance caps accounting, but caller authorization is not strict. Consider whitelist or token/owner-only if you want stricter guarantees.
- Reserve uses bucket accounting; any direct token transfer not followed by correct notify path can desync expectations until manually accounted for.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).