# BIGGI Chainlink CRE Support Brief

Date: 2026-08-25

## Project Summary

BIGGI is migrating an existing Polygon mainnet tokenomics automation stack to Chainlink CRE. The onchain tokenomics contracts are already deployed and source verified on PolygonScan. CRE is intended to replace/coordinate keeper-style automation for existing contract entry points, not to redesign tokenomics.

MNDA status: signed. The signed MNDA is intentionally not stored in the repository.

## CRE Account And Access State

- Organization ID: `org_d09xtsv4XAgGOXMi`
- Organization name: `My Org`
- Deploy access: `Not enabled`
- `cre account list-key`: no linked owners found
- `cre workflow list --target production-settings`: no workflows found
- Workflow deployment registry configured in project: `private`

On 2026-08-25, `cre account access --non-interactive` unexpectedly entered the submission flow and reported a submitted request without collecting a use-case description. The organization still reports `Deploy Access: Not enabled`. Support should confirm which request is active and whether the original detailed application remains attached to the organization.

Observed issue for support: deployment access is still disabled, so there is no production workflow visible in the Chainlink dashboard yet.

## Toolchain Verified Locally

- CRE CLI: `v1.30.0`
- Bun: `1.3.14`
- `@chainlink/cre-sdk`: `1.15.0`
- TypeScript: `5.9.3`
- `viem`: `2.34.0`
- `zod`: `3.25.76`

## Canonical Workflow

Path:

```text
biggi-project/bekend/cre-workflows/biggi-cre/my-workflow
```

Production target:

```text
production-settings
```

Production workflow name:

```text
biggi-tokenomics-production
```

Registry:

```text
private
```

Schedule:

```text
0 */5 * * * *
```

The workflow reads Polygon mainnet state and submits signed CRE reports to the custom receiver only when a target needs execution.

## Canonical Receiver

Receiver:

```text
0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6
```

Source:

```text
contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiCREAutomationReceiver.sol
```

Polygon official CRE KeystoneForwarder used by the receiver:

```text
0x76c9cf548b4179F8901cda1f8623568b58215E62
```

Receiver security model:

- `onReport(bytes metadata, bytes report)` entry point.
- Only the configured KeystoneForwarder can call it.
- Receiver is pausable and currently paused.
- Target and selector allowlist is currently closed.
- Optional workflow identity locking is supported through `expectedWorkflowId` and `expectedWorkflowOwner`.
- Report payload is ABI encoded as `(address target, bytes callData)`.

## Automation Branches

| Branch | Target | Selector | Gas limit |
| --- | --- | --- | --- |
| Supply | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` | `performUpkeep(bytes)` / `0x4585e33b` | `900000` |
| Buyback | `0x3C260f987d1aD7cA3dC8D61a3B731b2068c38875` | `performUpkeep(bytes)` / `0x4585e33b` | `1400000` |
| Liquidity | `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` | `performUpkeep(bytes)` / `0x4585e33b` | `1600000` |
| DEX reserve guard | `0x350370c248495758b80Ea1C564Df1290cA76588B` | `performUpkeep(bytes)` / `0x4585e33b` | `1400000` |
| Rewards week roll | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` | `rollCurrentWeek()` / `0x69fa508a` | `500000` |

Drip is not a separate periodic CRE branch. It is triggered by successful buyback logic through `dripOnBuy(acquired)`.

## Latest Simulation Evidence

Safe dry-run simulation was run against `test-settings`:

```powershell
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive --limits .\limits.chainlink-production-2026-08-25.json
```

Result:

- Simulation completed.
- Binary hash: `f3a6e9044f4eee55f87c4926eb19fef77f22d58e77dfa729ab52fb2342665ac0`
- Config hash: `05b79e06fc8fe58a91d360b3e7c5d858982e8dbb18a439fbb3111a100c4dea68`
- Enforced profile: `my-workflow/limits.chainlink-production-2026-08-25.json` (`5,000,000` EVM gas, `5 KB` EVM report, `15` EVM reads, `25 KB` consensus observation).
- Dry-run result: `{"needed":1,"submitted":0,"failed":0,"dryRun":true}`
- Supply, buyback, liquidity and DEX guard reported `no action needed`.
- Rewards week roll reported `action needed; dry-run skipped write`.

No production deploy, upload, activation, or transaction was performed from this support package step.

## Polygon-Fork Automation Rehearsal

Command:

```powershell
npm run rehearse:master:cre-automation:fork
```

Evidence: `EVIDENCE/cre-automation-adversarial-gas-fork.json`

- Chain ID: `137`, Polygon mainnet fork.
- Production implementations were deployed only inside the local fork and executed through `BiggiCREAutomationReceiver`.
- All five branches passed: Supply, Buyback, Liquidity, DEX reserve guard and Rewards week roll.
- All six adversarial checks passed: unauthorized forwarder, wrong workflow identity, contained target revert, receiver recovery, retryable buyback failure and buyback recovery.
- Workflow worst-case read count is `6`, below the CRE per-run quota of `15`.
- Measured direct `receiver.onReport` gas was `140949` to `384598`; every configured branch limit retained at least `64.61%` headroom.
- Measurements include receiver plus target execution but exclude KeystoneForwarder/DON overhead.
- No mainnet transaction was sent.

The Buyback proxy intentionally catches an agent revert and emits `PerformFailed`; the upkeep remains eligible and the next report can retry. Production monitoring must therefore alert on `PerformFailed`, not only on receiver transaction status.

## Initial Liquidity Gate

The production seed remains blocked. A fresh dry-run on 2026-08-25 confirmed:

- requested seed: `8,000,000 BIGGI + 5,000 POL`;
- BIGGI/WPOL pair reserves and LP supply: zero;
- token owner wallet native balance: `1.824440220558510091 POL`;
- deployment wallet native balance: `1.387342241466426688 POL`;
- Reserve BIGGI balance: `600,000,000 BIGGI`;
- blocking condition: insufficient native POL for the seed, `1 POL` post-seed accounting sync and gas.
- Polygon fork rehearsal: all checks passed; no mainnet transaction was sent.

## Current CRE Preflight

Evidence file:

```text
EVIDENCE/cre-preflight-polygon.json
```

Preflight result:

- Total checks: `47`
- Errors: `5`
- Warnings: `0`

The 5 errors are expected before production activation. The receiver has not yet allowlisted the final targets/selectors:

- supply-controller `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` selector `0x4585e33b`
- buyback `0x3C260f987d1aD7cA3dC8D61a3B731b2068c38875` selector `0x4585e33b`
- liquidity `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` selector `0x4585e33b`
- dex-reserve-guard `0x350370c248495758b80Ea1C564Df1290cA76588B` selector `0x4585e33b`
- rewards-week-roll `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` selector `0x69fa508a`

## Support Questions For Chainlink

1. Can Chainlink confirm deploy-access status and expected approval path for organization `org_d09xtsv4XAgGOXMi`?
2. Is Polygon mainnet EVM write support enabled for this tenant under CRE Early Access?
3. For a production workflow using `deployment-registry: private`, what exact workflow owner value is placed in receiver metadata when no linked workflow owner is listed by `cre account list-key`?
4. What is the stable metadata byte layout for `workflowId` and `workflowOwner` in `onReport(bytes metadata, bytes report)`?
5. After deployment, what exact CLI/UI command should be used to obtain the production workflow ID and owner for receiver locking?
6. Is submitting up to five independent `writeReport` outputs from one 5-minute cron invocation supported/recommended?
7. Is the current custom receiver pattern compatible with CRE production reports on Polygon mainnet?
8. Should the receiver use workflow ID locking, workflow owner locking, metadata hash allowlisting, or a combination?
9. Why does CRE CLI v1.30.0 `cre workflow limits export` return `10,000,000` EVM gas while the current service-quota page lists `5,000,000`, and which value will production enforce?
10. What is the recommended cutover sequence from paused local keepers/legacy automation to CRE without duplicate execution?
