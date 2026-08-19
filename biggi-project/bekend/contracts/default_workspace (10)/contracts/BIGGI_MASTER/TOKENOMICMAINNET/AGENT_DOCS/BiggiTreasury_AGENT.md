# Agent documentation — BiggiTreasury.sol

**Role:** Treasury split and top-up module

## Purpose
Receives BIGGI and POL, splits/refills token rewards, drip distributor, reserve, and accounts buyback and ecosystem BIGGI inflows separately.

## Top-level declarations
- Contracts/libraries: BiggiTreasury
- Interfaces in file: IBiggiDripDistributorDeposit, IBiggiReserveNotify

## Imports / external dependencies
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- `./TOKENOMIC_LIBRARY/BiggiBpsLib.sol`
- `./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol`

## Key public state to inspect
- `immutable`
- `distributor`
- `buybackAgent`
- `tokenRewards`
- `reserveAddr`
- `dripDistributor`
- `ecosystemBiggiCallers`
- `totalBiggiReceived`
- `totalEcosystemBiggiReceived`
- `totalPolReceived`
- `historicalTotalsSeeded`

## Key functions
- `depositTokens()`
- `setDistributor()`
- `setBuybackAgent()`
- `setTokenRewards()`
- `setReserve()`
- `setDripDistributor()`
- `setEcosystemBiggiCaller()`
- `seedHistoricalTotals()`
- `depositPolFromDistributor()`
- `receiveMintShare()`
- `_recordPolFromDistributor()`
- `buybackDepositAndSplit()`
- `ownerDepositAndSplit()`
- `receiveEcosystemBiggi()`
- `_splitBuybackBiggi()`
- `_approveToken()`
- `biggiBalance()`
- `polBalance()`
- `totalBiggiReceivedFromBuyback()`
- `totalBiggiReceivedFromEcosystem()`
- `totalPolReceivedFromDistributor()`
- `rescueERC20()`
- `rescueETH()`

## Integration points
- Split/forwarding hub; downstream accounting assumptions depend on its routing remaining stable.
- `receiveEcosystemBiggi(uint256)` is the intended BIGGI NFT-payment ingress from allowlisted `BiggiTicketHub` and `BiggiMain2` callers.
- Plain ERC20 transfers to treasury do not trigger split logic.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- Ecosystem callers must be explicitly allowlisted; otherwise `receiveEcosystemBiggi` reverts.
- Reserve strict notify mode requires `BiggiReserveV4.notifyCallers(BiggiTreasury) == true`.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).
