# BIGGI CRE Technical Spec

Date: 2026-08-19

## Objective

Move BIGGI tokenomics automation to Chainlink CRE while keeping all tokenomics execution inside already deployed Polygon mainnet contracts.

CRE does not mint NFTs and does not own tokenomics policy. It only evaluates keeper conditions and submits signed reports for already allowed onchain execution.

## Workflow Paths

Canonical production write workflow:

```text
biggi-project/bekend/cre-workflows/biggi-cre/my-workflow
```

Read-only health workflow:

```text
biggi-project/bekend/cre/biggi-tokenomics-automation
```

The read-only health workflow is not the production writer.

## Network

- Network: Polygon mainnet
- EIP-155 chain ID: `137`
- CRE chain name in project config: `polygon-mainnet`
- CRE chain selector: `4051577828743386545`
- KeystoneForwarder: `0x76c9cf548b4179F8901cda1f8623568b58215E62`

## Workflow Behavior

At every cron tick:

1. Read the latest finalized block number.
2. For each configured target, run the appropriate read/check.
3. If action is required, prepare deterministic calldata.
4. Encode report payload as `abi.encode(address target, bytes callData)`.
5. Submit the report through CRE EVM write capability to `BiggiCREAutomationReceiver`.

The workflow must preserve deterministic behavior. It must not use Node-only APIs inside the CRE WASM runtime.

## Target Execution Map

| Key | Target | Check | Execute | Selector |
| --- | --- | --- | --- | --- |
| `supply-controller` | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` | `checkUpkeep(bytes)` | `performUpkeep(bytes)` | `0x4585e33b` |
| `buyback` | `0x3C260f987d1aD7cA3dC8D61a3B731b2068c38875` | `checkUpkeep(bytes)` | `performUpkeep(bytes)` | `0x4585e33b` |
| `liquidity` | `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` | `checkUpkeep(bytes)` | `performUpkeep(bytes)` | `0x4585e33b` |
| `dex-reserve-guard` | `0x350370c248495758b80Ea1C564Df1290cA76588B` | `checkUpkeep(bytes)` | `performUpkeep(bytes)` | `0x4585e33b` |
| `rewards-week-roll` | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` | week-roll condition | `rollCurrentWeek()` | `0x69fa508a` |

Only `LIQUIDITY_KEEPER_PROXY` should be active for the liquidity CRE branch. Do not run a parallel legacy `LIQUIDITY_AUTOMATION` branch.

## Fork-Rehearsed Gas And Failure Behavior

Reproduction command:

```powershell
npm run rehearse:master:cre-automation:fork
```

Canonical evidence: `EVIDENCE/cre-automation-adversarial-gas-fork.json`

| Branch | Receiver + target gas | Configured limit | Headroom |
| --- | ---: | ---: | ---: |
| Supply | `259225` | `900000` | `71.20%` |
| Buyback | `140949` | `1400000` | `89.93%` |
| Liquidity | `384586` | `1600000` | `75.96%` |
| DEX reserve guard | `229761` | `1400000` | `83.59%` |
| Rewards week roll | `176949` | `500000` | `64.61%` |

These are direct `BiggiCREAutomationReceiver.onReport` measurements using production implementations deployed inside a Polygon mainnet fork. They exclude KeystoneForwarder and DON overhead and are not estimates of billing cost. All values remain below both the configured write limits and the current `5,000,000` CRE EVM transaction gas quota.

The workflow performs at most six EVM reads per run: four `checkUpkeep` calls plus `currentWeek` and `weekState`. This is below the current per-run EVM read quota of `15`.

The checked-in `my-workflow/limits.chainlink-production-2026-08-25.json` profile mirrors the official quota page as verified on 2026-08-25. It is passed explicitly during simulation because CRE CLI v1.30.0 currently exports an embedded `10,000,000` EVM gas default while the official production service quota lists `5,000,000`. Chainlink support should confirm which value the tenant will enforce.

Adversarial checks cover unauthorized forwarders, wrong workflow identity, target reverts, receiver recovery and Buyback retry behavior. `BiggiBuybackUpkeepProxy` intentionally catches an agent revert and emits `PerformFailed`; monitoring must consume that event because the receiver transaction remains successful and the next workflow tick retries the still-eligible upkeep.

The receiver does not maintain a report nonce. Replay protection is therefore target-level. The fork rehearsal repeated each successful report with production cooldowns: Supply and Buyback produced no second effect, Liquidity and DEX guard rejected the stale action without state change, and Rewards week roll remained idempotent. All five checks passed.

## Receiver State Before Activation

Receiver:

```text
0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6
```

State verified from repo-generated preflight/reporting:

- Paused: `true`
- `expectedWorkflowId`: zero bytes32
- `expectedWorkflowOwner`: zero address
- Target selector allowlist: closed for all five production branches
- Metadata hash allowlist count: `0`
- Max report bytes: `4096`
- Max calldata bytes: `2048`

This is intentional. Receiver activation must happen only after workflow deploy identity is known.

## Required Activation Order

1. Confirm Chainlink CRE deploy access is enabled for the organization.
2. Confirm Polygon mainnet CRE EVM write support for the tenant.
3. Deploy workflow to `production-settings`.
4. Read exact workflow ID and workflow owner from the current CLI/UI.
5. Configure receiver expected workflow ID/owner.
6. Allowlist the five target/selector pairs.
7. Configure target-side keeper/allowed-caller roles for the receiver where required.
8. Correct `BUYBACK_UPKEEP_PROXY.minNativeThresholdWei` from the live `1 wei` value to the canonical `0.5 POL`; the activation script performs this before proxy unpause and rejects values below `0.001 POL`.
9. Keep legacy/parallel keepers paused to avoid duplicate execution.
10. Unpause receiver only after DEX liquidity and final tokenomics launch gates are satisfied.
11. Monitor first executions in the CRE dashboard and on PolygonScan.

## Launch Gate Snapshot

Evidence:

```text
EVIDENCE/launch-readiness-polygon.json
```

Current status:

- `okForDeployOnly`: `true`
- `okForPublicLaunch`: `false`
- Blockers: `9`

Known blockers:

- `BUYBACK_UPKEEP_PROXY` is paused.
- `BUYBACK_UPKEEP_PROXY.minNativeThresholdWei` is the unsafe dust value `1 wei` instead of the canonical `0.5 POL`.
- BIGGI/WPOL pair has no initial liquidity.
- `MAIN2` is paused.
- CRE receiver is paused.
- CRE workflow ID is not locked.
- CRE workflow owner is not locked.
- `LIQUIDITY_ORCHESTRATOR` is paused.
- `LIQUIDITY_KEEPER_PROXY` is paused.

## Chainlink Confirmation Needed

The receiver currently parses workflow identity from metadata. Chainlink support should confirm the stable production metadata layout before receiver identity locking is finalized.
