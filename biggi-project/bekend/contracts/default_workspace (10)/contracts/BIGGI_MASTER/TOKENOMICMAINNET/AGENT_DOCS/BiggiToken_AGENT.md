# Agent documentation — BiggiToken.sol

**Role:** BIGGI ERC20 token

## Purpose
Core token with initial distribution, caps, pausability, and guardian/controller mint endpoints.

## Top-level declarations
- Contracts/libraries: BiggiToken
- Interfaces in file: IBiggiDripDistributorNotify

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/ERC20.sol`
- `@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol`
- `@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol`
- `@openzeppelin/contracts/utils/Pausable.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `./TOKENOMIC_LIBRARY/BiggiCapsLib.sol`

## Key public state to inspect
- `constant`
- `reserveAddr`
- `dripDistributorAddr`
- `tokenRewardsAddr`
- `rewardsOperator`
- `supplyController`
- `supplyGuardian`
- `distributed`
- `guardianDexMinted`
- `guardianRewardsMinted`

## Key functions
- `notifyTokenMint()`
- `setReserve()`
- `setDripDistributor()`
- `setTokenRewards()`
- `setRewardsOperator()`
- `setSupplyController()`
- `setSupplyGuardian()`
- `initialDistribute()`
- `transferFromReserveTo()`
- `refillRewardsIfBelow()`
- `mint()`
- `mintToDripDistributor()`
- `mintToTokenRewards()`
- `pause()`
- `unpause()`
- `_update()`
- `remainingMintable()`
- `tokenMeta()`
- `rescueERC20()`

## Integration points
- Core source of truth for BIGGI balances, mint budgets, pause state, and initial distribution.
- `refillRewardsIfBelow()` is an optional rewards-operator helper and now consumes the same `guardianRewardsMinted` / `GUARDIAN_REWARDS_MINT_CAP` budget as `mintToTokenRewards()`.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- Guardian/controller refill model changes tokenomics from fully-static post-launch supply into capped dynamic refill budgets. Audit messaging/docs should reflect that clearly.
- Mainnet deploy should leave `rewardsOperator` unset unless there is a deliberate operator process for that helper.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).
