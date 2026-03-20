# Agent documentation — BiggiDripLMToModerator.sol

**Role:** Drip LM to moderator payout bridge

## Purpose
Sells or routes drip branch value and distributes outputs toward moderator center according to configured rules.

## Top-level declarations
- Contracts/libraries: BiggiDripLMToModerator
- Interfaces in file: IUniswapV2Router02, IBiggiDripDistributor, IModeratorCenter

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/utils/Address.sol`
- `./Library/BiggiErrorsLib.sol`
- `./Library/BiggiSwapLib.sol`

## Key public state to inspect
- `immutable`
- `router`
- `dripDistributor`
- `reserve`
- `buybackAgent`
- `moderatorCenter`
- `sellPct`
- `slippageBps`
- `txDeadlineSec`
- `reserveShareBps`
- `moderatorShareBps`

## Key functions
- `WETH()`
- `swapExactTokensForETHSupportingFeeOnTransferTokens()`
- `getAmountsOut()`
- `availableTokens()`
- `claim()`
- `claimTo()`
- `setTokensPerMintFromOperator()`
- `notifyAllocation()`
- `setRouter()`
- `setDripDistributor()`
- `setReserve()`
- `setBuybackAgent()`
- `setModeratorCenter()`
- `setSellPct()`
- `setShares()`
- `setSlippageBps()`
- `setTxDeadlineSec()`
- `dripOnBuy()`
- `rescueToken()`
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