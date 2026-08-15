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
- `./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol`

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
- `receiveMintShare()` and DEX_REFILL BIGGI notifications both attempt to trigger `liquidityManager.onReserveTopUpRequest()`.
- `notifyBiggiReceived()` intentionally skips this auto-trigger when `msg.sender == liquidityManager` so leftover returns from LM do not recurse into another pairing attempt.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- `notifyBiggiReceived(uint256)` is caller-restricted in the current source through `notifyCallers` plus the BIGGI token address. Final mainnet wiring must explicitly allow intended callers such as treasury/LM return paths where needed.
- Reserve uses bucket accounting; any direct token transfer not followed by correct notify path can desync expectations until manually accounted for.
- Do not remove the DEX_REFILL notify trigger without replacing it with another path; distributor native can arrive before treasury/buyback BIGGI reaches reserve.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).
