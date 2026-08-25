# Pre-Liquidity Automation Readiness

Initial record: 2026-08-19
Last verified: 2026-08-25
Network: Polygon mainnet

This document records what is ready before the first BIGGI/WPOL liquidity seed and what must remain inactive until liquidity and CRE deployment access are available.

## Read-Only Checks Run

From `biggi-project/bekend`:

```powershell
npm run compile:master
npm run check:master:core:polygon
npm run preflight:launch:polygon
npm run preflight:master:cre:polygon
npx hardhat run --config hardhat.biggi-master.cjs scripts/checkDripBranch.js --network polygon
npm run prepare:master:cre-receiver:polygon
npm run rehearse:master:cre-automation:fork
```

CRE simulation attempted:

```powershell
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive --limits .\limits.chainlink-production-2026-08-25.json
```

Result: blocked by CRE credential validation while the organization still reports `Deploy Access: Not enabled`.
Retry result: simulation completed successfully in dry-run mode.

- Binary hash: `f3a6e9044f4eee55f87c4926eb19fef77f22d58e77dfa729ab52fb2342665ac0`
- Config hash: `05b79e06fc8fe58a91d360b3e7c5d858982e8dbb18a439fbb3111a100c4dea68`
- Explicit official-quota profile: EVM gas `5,000,000`, EVM report `5 KB`, EVM reads `15`, consensus observation `25 KB`.
- User logs:
  - `[supply-controller] no action needed`
  - `[buyback] no action needed`
  - `[liquidity] no action needed`
  - `[dex-reserve-guard] no action needed`
  - `[rewards-week-roll] action needed; dry-run skipped write`
- Result: `{"needed":1,"submitted":0,"failed":0,"dryRun":true}`

## Confirmed Ready

- Core relationship check: OK, no issues.
- BIGGI initial distribution: already completed.
- Token balances:
  - Reserve: `600,000,000 BIGGI`
  - DripDistributor: `200,000,000 BIGGI`
  - TokenRewards: `200,000,000 BIGGI`
- TicketHub:
  - paused: `false`
  - marketing minted: `50`
  - sale minted: `0`
  - ticket price: `500 POL`
  - token sink: Treasury, `10000` bps, deposit mode enabled.
- DripDistributor:
  - dripLM: `0xE258843bca54803a366413571b3B4d6a28eAF2eC`
  - treasury: `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7`
  - tokensPerMintOperator: DripLM
  - available/effective balance: `200,000,000 BIGGI`
  - paused: `false`
  - MAIN and MAIN2 are whitelisted.
- DripLM:
  - router: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff`
  - reserve: `0x2786e46e01a5d229118fEdC102267217C7e94574`
  - dripDistributor: `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3`
  - buybackAgent: `0x5A77E90c467576C82B8d0E74eD112B829C625BB4`
  - moderatorCenter: `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D`
  - shares: `5000 / 5000`
  - sellPct: `70`
  - slippageBps: `200`
  - txDeadlineSec: `600`
- Treasury:
  - distributor: `0xCE892698159D8D799D5eF7f0dF0111487511fD22`
  - buybackAgent: `0x5A77E90c467576C82B8d0E74eD112B829C625BB4`
  - reserve: `0x2786e46e01a5d229118fEdC102267217C7e94574`
  - dripDistributor: `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3`
  - tokenRewards: `0xA455775BBe0BC863f644516147b95Ef5103b29FA`
- Distributor:
  - reserve: `0x2786e46e01a5d229118fEdC102267217C7e94574`
  - buybackAgent: `0x5A77E90c467576C82B8d0E74eD112B829C625BB4`
  - treasury: `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7`
- CRE receiver prepare plan:
  - existing receiver: `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6`
  - readyToExecute: `true`
  - blockers: `0`
- CRE Polygon-fork automation rehearsal:
  - five production branches passed through the receiver;
  - six adversarial/recovery checks passed;
  - five duplicate/stale-report checks passed with no duplicate state effect;
  - configured gas headroom remained at least `64.61%` before KeystoneForwarder/DON overhead;
  - worst-case workflow reads: `6 / 15`;
  - no mainnet transaction was sent;
  - evidence: `EVIDENCE/cre-automation-adversarial-gas-fork.json`.

## Must Stay Inactive Before Liquidity

- Buyback automation.
- Liquidity keeper.
- Liquidity orchestrator.
- DEX reserve guard execution.
- CRE receiver unpause.
- CRE write workflow activation.
- Legacy DripKeeper; it must remain paused because drip is triggered by BuybackAgent via DripLM.

## Current Blockers

Launch preflight:

- BuybackUpkeepProxy is paused.
- BIGGI/WPOL pair has no liquidity.
- MAIN2 is paused.
- CRE receiver is paused.
- CRE workflow ID is not locked.
- CRE workflow owner is not locked.
- LiquidityOrchestrator is paused.
- LiquidityKeeperProxy is paused.
- BuybackAgent auto-buyback is disabled.
- CRE calls and target-side roles are not wired.
- Originals Chapter 1 is inactive.

CRE preflight:

- Receiver target/selector allowlist is still closed for the five production targets.
- The closed allowlist is intentional until workflow ID/owner are known and CRE deploy access is enabled.
- The previous buyback threshold and LiquidityManager unit mismatches were corrected on Polygon on 2026-08-25; evidence is `EVIDENCE/pre-liquidity-remediation-execution-polygon.json`.

CRE account:

- Deploy access: `Not enabled`.
- No production workflows found.
- No linked owners found.
- `cre account access --non-interactive` unexpectedly reported a submitted request without collecting a description; confirm the active request with Chainlink support.
- CRE CLI v1.30.0 exports `10,000,000` EVM gas in its embedded simulation limits while the current official service-quota page lists `5,000,000`; the checked-in dated limits profile enforces the lower official value pending support confirmation.

## Planned Initial Liquidity

Proposed seed:

- `8,000,000 BIGGI`
- `5,000 POL`
- LP recipient: `LiquidityVault`
- Post-seed LM sync: `1 POL` plus proportional BIGGI

Implied initial price:

- `1 POL = 1,600 BIGGI`
- `1 BIGGI = 0.000625 POL`

Dry-run status:

- Parameters are coherent.
- Owner wallet balance observed: `1.824440220558510091 POL`.
- Deployment wallet balance observed: `1.387342241466426688 POL`.
- Only current blocker is insufficient native balance on the owner wallet for `5,000 POL + 1 POL + gas`.

## Later Activation Order

1. Seed BIGGI/WPOL liquidity.
2. Run launch preflight again.
3. Correct the BuybackUpkeepProxy threshold to `0.5 POL`, then activate tokenomics keepers except legacy DripKeeper.
4. Confirm CRE deploy access is enabled.
5. Deploy CRE workflow to production settings.
6. Read workflow ID and owner from current CRE CLI/UI.
7. Lock receiver workflow ID/owner.
8. Allowlist the five receiver target/selector pairs.
9. Set receiver as keeper/allowed caller on target contracts where required.
10. Unpause CRE receiver last.
