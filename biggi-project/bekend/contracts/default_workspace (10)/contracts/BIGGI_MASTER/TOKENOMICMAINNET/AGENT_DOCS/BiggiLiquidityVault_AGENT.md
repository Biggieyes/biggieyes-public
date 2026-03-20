# Agent documentation — BiggiLiquidityVault.sol

**Role:** LP custody vault

## Purpose
Stores LP tokens, whitelists pairs, and only allows liquidity-manager-controlled sync/deposit/withdraw paths.

## Top-level declarations
- Contracts/libraries: LiquidityVault, addresses, address
- Interfaces in file: None

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/Address.sol`

## Key public state to inspect
- `liquidityManager`
- `whitelistedPairs`

## Key functions
- `setLiquidityManager()`
- `addWhitelistedPair()`
- `removeWhitelistedPair()`
- `releaseLP()`
- `depositLP()`
- `withdrawToLM()`
- `syncPairBalance()`
- `lpBalanceOf()`
- `lpBalanceReal()`
- `lpSnapshot()`
- `rescueERC20()`
- `rescueNative()`

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