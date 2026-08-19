# Agent documentation — BiggiLiquiditySetup.sol

**Role:** Bootstrap setup helper

## Purpose
Owner deployment/setup helper for router/factory/vault/reserve/token allowances and initial pairing wiring.

## Top-level declarations
- Contracts/libraries: LiquiditySetup
- Interfaces in file: IFactory, IRouter, IBiggiTokenWithReserve, ILiquidityManager, IVault, IReserveSetup

## Imports / external dependencies
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`

## Key public state to inspect
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `immutable`
- `slippageBps`
- `deadlineSec`
- `executedInitial`

## Key functions
- `getPair()`
- `WETH()`
- `addLiquidityETH()`
- `transferFromReserveTo()`
- `setRouter()`
- `setFactory()`
- `setReserve()`
- `setLiquidityVault()`
- `setKeeper()`
- `setTokenPct()`
- `setSlippageBps()`
- `setTxDeadlineSec()`
- `setAutoTopUpConfig()`
- `addWhitelistedPair()`
- `whitelistPair()`
- `setLiquidityManager()`
- `setSlippageBps()`
- `setDeadlineSec()`
- `setupReserveLMVault()`
- `runDexConnections()`
- … plus 1 more

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