# BIGGI CRE automation

Canonical Chainlink CRE project for BIGGI tokenomics on Polygon mainnet.

## Runtime

The workflow runs every five minutes and evaluates five independent branches:

| Branch | Target | Action |
| --- | --- | --- |
| Supply | `BiggiSupplyController` | `checkUpkeep` -> `performUpkeep` |
| Buyback | `BiggiBuybackUpkeepProxy` | `checkUpkeep` -> `performUpkeep` |
| Liquidity | `BiggiLiquidityKeeperProxy` | `checkUpkeep` -> `performUpkeep` |
| DEX guard | `BiggiDexReserveGuard` | `checkUpkeep` -> `performUpkeep` |
| Rewards | `BiggiTokenRewardsEmissionController` | `rollCurrentWeek` when the current week is not initialized |

Drip is intentionally not a separate scheduled branch. A successful buyback calls `dripOnBuy(acquired)` directly. The legacy drip keeper must remain paused.

## Receiver

Do not deploy the generated `contracts/evm/src/AutomationReceiver.sol` for BIGGI production. It is retained only as reference from the Chainlink migration template.

BIGGI uses `BiggiCREAutomationReceiver`, which starts paused, takes an explicit owner, accepts only the Polygon Keystone Forwarder and enforces workflow identity plus target/selector allowlists.

From `biggi-project/bekend`:

```powershell
npm.cmd run prepare:master:cre-receiver:polygon
npm.cmd run deploy:master:cre-receiver:polygon
npm.cmd run verify:master:cre-receiver:polygon
```

Do not wire or activate the receiver until the deployed workflow ID and owner are known.

## Local validation

```powershell
cd biggi-project\bekend\cre-workflows\biggi-cre
& "$env:USERPROFILE\.bun\bin\bun.exe" install --cwd .\my-workflow
& "$env:USERPROFILE\.bun\bin\bun.exe" run --cwd .\my-workflow typecheck
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive
```

The test config uses `dryRun: true`: it reads finalized Polygon mainnet state and never submits a transaction.

## Production gate

The deployed paused receiver is `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6`. The same address is recorded in `config.production.json`, `.env.core.polygon` and `addresses.master.json`.

Deployment remains blocked while `cre whoami` reports `Deploy Access: Not enabled`. Deploy access is necessary but not sufficient. Keep the receiver paused and do not activate this workflow until the source-of-truth gate in [BIGGI_MASTER_SOURCE_OF_TRUTH_CS.md](../../contracts/default_workspace%20%2810%29/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BIGGI_MASTER_SOURCE_OF_TRUTH_CS.md) is satisfied: real Polygon DEX, real BIGGI/WETH pair, initial liquidity, final tokenomics wiring, `DEV_WALLET`, `EXPECT_OWNER`, workflow identity, receiver allowlist, keeper roles, metadata consistency and strict Polygon gate.

After access is enabled and the gate prerequisites are satisfied:

1. Simulate the workflow again.
2. Deploy the private-registry workflow.
3. Read the workflow ID and owner from CRE.
4. Set `CRE_EXPECTED_WORKFLOW_ID` and `CRE_EXPECTED_WORKFLOW_OWNER` locally.
5. Run `npm.cmd run wire:master:cre-receiver:polygon`.
6. Run all launch preflights.
7. Activate the receiver, then the workflow, as the final automation steps.

See [MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md](../../contracts/default_workspace%20%2810%29/contracts/BIGGI_MASTER/TOKENOMICMAINNET/MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md).
