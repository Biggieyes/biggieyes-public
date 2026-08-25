# BIGGI_MASTER scripts

## Mainnet runbook

Step-by-step cesky runbook pro produkcni nasazeni je zde:

- [MAINNET_DEPLOY_ORDER_CS.md](../../contracts/default_workspace%20(10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/MAINNET_DEPLOY_ORDER_CS.md)
- [MAINNET_DEX_SETUP_CS.md](../../contracts/default_workspace%20(10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/MAINNET_DEX_SETUP_CS.md)
- [MAINNET_VISIBILITY_LAUNCH_CS.md](../../contracts/default_workspace%20(10)/contracts/BIGGI_MASTER/MAINNET_VISIBILITY_LAUNCH_CS.md)

## Deploy

Run from `biggi-project/bekend`:

```bash
npm run deploy:master
```

or:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/deployMasterStack.js --network polygon
```

Polygon mainnet:

```bash
npm run deploy:master:polygon
```

Minimal visibility launch on Polygon mainnet:

```bash
npm run validate:master:visibility:polygon -- --strict
npm run deploy:master:visibility:polygon
```

Strict alias:

```bash
npm run validate:master:visibility:polygon:strict
```

Mainnet env template:

```bash
scripts/master/.env.polygon.example
```

Minimal visibility env template:

```bash
scripts/master/.env.visibility.example
```

Deploy command itself reads network/private-key config from:

```bash
biggi-project/bekend/.env
```

So for real deploy either:

- copy visibility values into backend `.env`
- or export them in the same shell before running Hardhat

For pure private visibility launch with `SALE_CAP=0`, distributor / reserve / buyback / BIGGI token wiring is intentionally optional.
If you later open paid sale with `SALE_CAP > 0`, set `DISTRIBUTOR` first or 60% of paid mint revenue will remain inside `TicketHub`.
Visibility deploy supports optional `TOKEN_SINK_DEPOSIT_MODE=1`; when enabled, `TOKEN_SINK` must implement `receiveEcosystemBiggi(uint256)` and separately allowlist the deployed `TicketHub/Main2`.

### Important env

- `SALE_CAP`, `MARKETING_CAP` (`sale + marketing = 550`)
- `VRF_COORDINATOR`, `VRF_KEY_HASH`, `VRF_SUB_ID` (optional, for real VRF router deploy)
- `VRF_ROUTER` (optional existing router address; script will wire MAIN/MAIN2 approvals when possible)
- `NFT_REWARDS` (optional existing `BiggiNFTRewards` address)
- `PAIR`, `QUOTE_TOKEN` (required on non-local unless `DEPLOY_MOCK_PAIR=1`)
- `STRICT_NOTIFY_CALLERS` (`1` default; set `0` to keep reserve notify hook permissive)
- `CIRCUIT_BREAKER_ENABLED` (`1` default)
- `CB_DEX_CRITICAL_FLOOR` (default `500` BIGGI)
- `CB_REWARDS_CRITICAL_FLOOR` (default `500` BIGGI)
- supply controller params:
  - `SUPPLY_DEX_RESERVE_DROP_BPS` (default `5000`)
  - `SUPPLY_DEX_REFILL_AMOUNT` (default `20000000` BIGGI)
  - `SUPPLY_DEX_COOLDOWN_SEC` (default `1800`)
  - `SUPPLY_MIN_RESERVE_FLOOR` (default `0` BIGGI)
  - `SUPPLY_AUTO_REFRESH_BASELINE` (`1|0`, default `0`)
  - `SUPPLY_REWARDS_THRESHOLD` (default `5000000` BIGGI)
  - `SUPPLY_REWARDS_REFILL_AMOUNT` (default `200000000` BIGGI)
  - `SUPPLY_REWARDS_COOLDOWN_SEC` (default `43200`)
- token rewards emission params:
  - `TOKEN_REWARDS_EMISSION_CONTROLLER` (optional existing controller)
  - `DEPLOY_TOKEN_REWARDS_EMISSION_CONTROLLER` (`1|0`, default `1`)
  - `TOKEN_REWARDS_EMISSION_ENABLED` (`1|0`, default `1`)
  - `TOKEN_REWARDS_TARGET_WEEKLY_UNITS` (default `100000`)
  - `TOKEN_REWARDS_MIN_WEEKLY_BUDGET` (default `50000` BIGGI)
  - `TOKEN_REWARDS_WEAK_WEEKLY_BUDGET` (default `100000` BIGGI)
  - `TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET` (default `500000` BIGGI)
  - `TOKEN_REWARDS_STRONG_WEEKLY_BUDGET` (default `1000000` BIGGI)
  - `TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET` (default `25000` BIGGI)
  - `TOKEN_REWARDS_MAX_WEEKLY_BUDGET` (default `1000000` BIGGI)
  - `TOKEN_REWARDS_BALANCE_BUDGET_BPS` (default `100`, i.e. 1% of TokenRewards balance)
  - `TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD` (default `10000` BIGGI)
  - `TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD` (default `200000` BIGGI)
- dex guard params:
  - `DEX_GUARD_MIN_RESERVE_RATIO_BPS` (default `5000`)
  - `DEX_GUARD_REFILL_AMOUNT` (default `20000000` BIGGI)
  - `DEX_GUARD_COOLDOWN_SEC` (default `1800`)
  - `DEX_GUARD_AUTO_REFRESH_BASELINE` (`1|0`, default `1`)
  - `DEX_GUARD_PRICE_CHECK_ENABLED` (`1|0`, default `0`)
  - `DEX_GUARD_MAX_DEVIATION_BPS` (default `2000`)
  - `DEX_GUARD_QUOTE_ORACLE` (optional oracle address)
  - `DEX_GUARD_MAX_ORACLE_STALENESS_SEC` (default `86400`)
  - `DEX_GUARD_REQUIRE_QUOTE_ORACLE` (`1|0`, default `0`; set `1` when price check must reject missing/invalid oracle)
  - `DEX_GUARD_REFRESH_PRICE_ANCHOR` (`1|0`, default follows `DEX_GUARD_PRICE_CHECK_ENABLED`; deploy tries `refreshPriceAnchor()` after baseline when pair has reserves)
- policy / buyback params:
  - `POLICY_SWAP_SLIPPAGE_BPS` (default `500`)
  - `POLICY_TX_DEADLINE_SEC` (default `600`)
  - `POLICY_MIN_BUYBACK_INTERVAL_SEC` (default `300`)
  - `POLICY_BUYBACKS_PAUSED` (`1|0`, default `0`)
  - `POLICY_MAX_DAILY_BUYBACK_NATIVE` (default `0`)
  - `BUYBACK_FALLBACK_SLIPPAGE_BPS` (default `200`)
  - `BUYBACK_FALLBACK_DEADLINE_SEC` (default `600`)
  - `BUYBACK_FALLBACK_COOLDOWN_SEC` (default `300`)
- `MARKETING_SUPPORT` (optional; if omitted, initial 200M marketing support mints to `TREASURY`)
- `DEV_WALLET` (optional; if omitted, `TicketHub` and `Main2` sales routing defaults to deployer/initial owner)
- BIGGI NFT payments are wired by `deployMasterStack.js` to `BiggiTreasury`: `TicketHub/Main2.setTokenSink(treasury, 10000)`, `setTokenSinkDepositMode(true)`, and `Treasury.setEcosystemBiggiCaller(TicketHub/Main2, true)`.
- `EXPECT_OWNER` (recommended for production; final Safe/timelock used by post-deploy strict ownership checks)
- optional branch addresses: `TOKEN_REWARDS_EMISSION_CONTROLLER`, `DRIP_LM`, `MODERATOR_CENTER`, `BUYBACK_AGENT`, `BUYBACK_ROUTER`, `COMMUNITY_CENTER`, `POLICY`, `LIQUIDITY_MANAGER`, `LIQUIDITY_VAULT`, `LIQUIDITY_ORCHESTRATOR`, `LIQUIDITY_KEEPER_PROXY`, `LIQUIDITY_AUTOMATION`, `DRIP_KEEPER_PROXY`, `BUYBACK_UPKEEP_PROXY`, `MULTI_COLLECTION_READER`, `CHAPTER_SERIES_READER`, `MULTICALL`, `ROUTER`, `FACTORY`, `WETH`
- optional tokenomic reader addresses: `RESERVE_TREASURY_READER`, `BUYBACK_READER`, `LIQUIDITY_BRANCH_READER`, `LIQUIDITY_HELPER_READER`, `SUPPLY_CONTROLLER_READER`, `SUPPLY_GUARDIAN_READER`, `DEX_RESERVE_GUARD_READER`, `SYSTEM_READER`, `TOKENOMICS_SYSTEM_ADDON_READER`, `BIGGI_TOKENOMICS_READER`, `TOKEN_REWARDS_READER`
- `DEPLOY_LIQUIDITY_BRANCH` (`1|0`, default `1` on local networks)
- `DEPLOY_BUYBACK_BRANCH` (`1|0`, default `1` on local networks)
- `DEPLOY_DRIP_LM` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`; deploys `BiggiDripLMToModerator` when `DRIP_LM` is not supplied)
- `DEPLOY_MODERATOR_CENTER` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`; deploys `ModeratorCenter` when `MODERATOR_CENTER` is not supplied)
- `DEPLOY_BUYBACK_AGENT` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`)
- `DEPLOY_BUYBACK_ROUTER` (`1|0`, default local `1` when buyback agent is deployed; deploys `MockBuybackRouter` only on local networks)
- `MOCK_BUYBACK_ROUTER_SEED_BIGGI` (optional BIGGI amount for local mock buyback router funding, default `0`)
- `DEPLOY_COMMUNITY_CENTER` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`)
- `DEPLOY_POLICY` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`)
- `DEPLOY_DRIP_KEEPER_PROXY` (`1|0`, default `1` on local networks)
- `DEPLOY_BUYBACK_UPKEEP_PROXY` (`1|0`, default `1` on local networks)
- `DEPLOY_MULTI_COLLECTION_READER` (`1|0`, default `1` on local networks)
- `DEPLOY_CHAPTER_SERIES_READER` (`1|0`, default `1` on local networks)
- `DEPLOY_TOKENOMIC_READERS` (`1|0`, default `1` on local networks; deploys the tokenomic reader layer when prerequisites exist)
- individual tokenomic reader flags: `DEPLOY_RESERVE_TREASURY_READER`, `DEPLOY_BUYBACK_READER`, `DEPLOY_LIQUIDITY_BRANCH_READER`, `DEPLOY_LIQUIDITY_HELPER_READER`, `DEPLOY_SUPPLY_CONTROLLER_READER`, `DEPLOY_SUPPLY_GUARDIAN_READER`, `DEPLOY_DEX_RESERVE_GUARD_READER`, `DEPLOY_SYSTEM_READER`, `DEPLOY_TOKENOMICS_SYSTEM_ADDON_READER`, `DEPLOY_BIGGI_TOKENOMICS_READER`, `DEPLOY_TOKEN_REWARDS_READER`
- `DEPLOY_MULTICALL` (`1|0`, default `1` on local networks)
- `DEPLOY_NFT_REWARDS` (`1|0`, default `1` on local networks)
- `ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK` (`1|0`, default `1`; on local networks falls back missing `BUYBACK_AGENT/COMMUNITY_CENTER` to `TREASURY`)
- `ALLOW_PENDING_PAIR` (`1|0`, default `0`; production default is strict real `PAIR`. Use `1` only as an explicit fallback when tokenomics must deploy before the final DEX pair exists.)
- `LIQUIDITY_PATH` (`keeper_proxy|automation|none`, default `keeper_proxy`; deploy path selector)
- liquidity defaults (optional overrides):
  - `LIQ_TOKEN_PCT`, `LIQ_SLIPPAGE_BPS`, `LIQ_DEADLINE_SEC`
  - `LIQ_ORCH_MIN_POL_PER_TX`, `LIQ_ORCH_MAX_POL_PER_TX`, `LIQ_ORCH_MIN_DEX_REFILL_BIGGI`, `LIQ_ORCH_COOLDOWN_SEC`, `LIQ_ORCH_DAILY_QUOTA_POL`
  - `LIQ_KEEPER_MODE`, `LIQ_KEEPER_FIXED_POL`, `LIQ_KEEPER_PERCENT_BPS`, `LIQ_KEEPER_MIN_INTERVAL_SEC`, `LIQ_KEEPER_MIN_RESERVE_POL`, `LIQ_KEEPER_MAX_PER_TX`, `LIQ_KEEPER_MIN_DEX_REFILL_BIGGI`
  - `LIQ_AUTO_MIN_POL_WEI`, `LIQ_AUTO_MAX_POL_WEI`, `LIQ_AUTO_MIN_INTERVAL_SEC`
  - `BUYBACK_MIN_NATIVE_WEI`
- drip/moderator defaults (optional overrides):
  - `DRIP_LM_SELL_PCT` (default `70`)
  - `DRIP_LM_SLIPPAGE_BPS` (default follows `LIQ_SLIPPAGE_BPS`, default `300`)
  - `DRIP_LM_TX_DEADLINE_SEC` (default follows `BUYBACK_FALLBACK_DEADLINE_SEC`, default `600`)
  - `DRIP_LM_RESERVE_SHARE_BPS` and `DRIP_LM_MODERATOR_SHARE_BPS` (default `5000/5000`, must sum to `10000`)

If env values are missing, deploy script can auto-load hints from local `addresses.json` (mainnet snapshot).
If hinted addresses have no deployed code on target network, script ignores them and auto-deploys required parts (local mode).

Deploy writes `addresses.master.json`.
It also includes `BUYBACK_AGENT_EFFECTIVE` and `COMMUNITY_CENTER_EFFECTIVE` for the real distributor recipients used after fallback/validation.
When the drip/moderator branch is active, it writes `DRIP_LM` and `MODERATOR_CENTER`; the deploy flow wires `DripDistributor.dripLM`, `BuybackAgent.dripLM`, `DripKeeperProxy.dripLM`, `DripLM.{router,dripDistributor,reserve,buybackAgent,moderatorCenter}`, and `ModeratorCenter.multiCollection`.
When available, `BUYBACK_ROUTER` and `MOCK_BUYBACK_ROUTER` are also exported.
When tokenomic readers are deployed, their addresses are exported under the corresponding `*_READER` keys; `BIGGI_TOKENOMIK_READER` is also written as an alias of `BIGGI_TOKENOMICS_READER`.
It also stores the applied parameter profile under `PARAMS` (supply/TokenRewards emission/guard/policy/fallback values).

For the planned full mainnet deploy with initial liquidity already available, keep `ALLOW_PENDING_PAIR=0`, provide real `PAIR/QUOTE_TOKEN/ROUTER/FACTORY/WETH`, and let the deploy flow snapshot `SupplyController` and `DexReserveGuard` baselines. If `DEX_GUARD_PRICE_CHECK_ENABLED=1`, keep `DEX_GUARD_REFRESH_PRICE_ANCHOR=1` unless you intentionally want to set the anchor manually.

## Post-deploy essence configure

`configureMasterEssence.js` is an idempotent post-deploy configurator. It reads `addresses.master.json`, compares the live on-chain state with the canonical BIGGI_MASTER wiring, and applies only missing/mismatched setters.

Default mode is dry-run:

```bash
npm run configure:master:polygon
```

Execute mode:

```bash
npm run configure:master:polygon:execute
```

Recommended production sequence after deploy and after adding final VRF/DEX/router addresses:

```bash
npm run configure:master:polygon
npm run configure:master:polygon:execute
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

What it wires or verifies:

- core chapter stack: `Main`, `TicketHub`, `Main2`, `SeriesRegistry`, `ChapterController`
- rewards stack: `CollectionRewards`, `TokenRewards`, optional `NFTRewards`, optional `VRFRouter`
- TokenRewards dynamic emission controller when `TOKEN_REWARDS_EMISSION_CONTROLLER` is present
- BIGGI token payment route: `TicketHub/Main2 -> Treasury.receiveEcosystemBiggi()`
- distributor recipients: collection rewards, reserve, buyback, treasury, community
- tokenomics: token, reserve, treasury, drip distributor, supply controller, supply guardian, DEX guard
- optional pump/liquidity branches: buyback agent, policy, drip LM, liquidity manager/vault/orchestrator/keeper/automation
- `MasterTokenomicsConfig` frontend/backoffice address bundles

Important:

- the script never sets zero addresses as replacements
- readers are immutable; configure verifies target bundles indirectly but does not rewrite reader constructor targets
- `BiggiToken.initialDistribute()` is not called by default because it is irreversible; use `--initial-distribute` only if the token was manually deployed and all final token destinations are confirmed
- on non-local networks the configurator requires code at contract addresses before using them

## Check status

```bash
npm run check:master
```

This reads `addresses.master.json` and prints key wiring/health signals for:

- chapter scaling contracts
- VRF router wiring + approvals
- MAIN metadata completeness + reward matrix consistency
- token/drip/tokenRewards
- token rewards dynamic emission controller
- nftRewards wiring
- treasury + buyback + policy
- collection rewards + multi-collection distributor + optional community/moderator
- supply controller + dex reserve guard
- liquidity manager/vault/orchestrator/keeper/automation
- drip keeper + buyback upkeep proxies
- master config + optional core readers + optional tokenomic readers + multicall

Tokenomic reader checks verify immutable target wiring for reserve/treasury, buyback, liquidity, supply, DEX guard, system/addon, aggregate tokenomics, and token rewards readers when their addresses are present in the addresses file.

For non-default network:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network polygon
```

Polygon mainnet:

```bash
npm run check:master:polygon
```

Note: default `hardhat` runs are ephemeral per command. For meaningful `check` output, use a persistent network/session where deployed addresses exist.

Local persistent flow:

```bash
npx hardhat node --config hardhat.biggi-master.cjs
```

Then in another terminal:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/deployMasterStack.js --network localhost
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network localhost
```

You can also use npm aliases:

```bash
npm run node:master
npm run deploy:master:local
npm run check:master:local
```

## Strict consistency mode

Status checker supports strict mismatch detection via env flags.

```bash
# strict mode (fails with non-zero exit code on mismatch)
npm run check:master:strict

# strict + require code for all configured addresses
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network localhost

# use deployed addresses file + strict
CHECK_STRICT=1 MASTER_ADDRESSES_FILE=./addresses.json npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network polygon

# strict + ownership target + explicit liquidity path
CHECK_STRICT=1 EXPECT_OWNER=0xYourSafe EXPECT_LIQUIDITY_PATH=keeper_proxy npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network localhost
```

Optional env:

- `CHECK_STRICT=1`
- `CHECK_REQUIRE_CODE=1`
- `MASTER_ADDRESSES_FILE=./addresses.json`
- `EXPECT_STRICT_NOTIFY=1|0` (default follows strict mode)
- `EXPECT_OWNER=<address>` (checks `owner()` on all ownable core/tokenomics contracts)
- `EXPECT_LIQUIDITY_PATH=keeper_proxy|automation|none` (checks `LM.keeper` target)
- `LIQUIDITY_PATH=keeper_proxy|automation|none` (recommended to keep equal to `EXPECT_LIQUIDITY_PATH`)
- parameter expectation env (optional, checker compares only when provided):
  - supply: `SUPPLY_DEX_RESERVE_DROP_BPS`, `SUPPLY_DEX_REFILL_AMOUNT`, `SUPPLY_DEX_COOLDOWN_SEC`, `SUPPLY_MIN_RESERVE_FLOOR`, `SUPPLY_AUTO_REFRESH_BASELINE`, `SUPPLY_REWARDS_THRESHOLD`, `SUPPLY_REWARDS_REFILL_AMOUNT`, `SUPPLY_REWARDS_COOLDOWN_SEC`
  - token rewards emission: `TOKEN_REWARDS_EMISSION_ENABLED`, `TOKEN_REWARDS_TARGET_WEEKLY_UNITS`, `TOKEN_REWARDS_MIN_WEEKLY_BUDGET`, `TOKEN_REWARDS_WEAK_WEEKLY_BUDGET`, `TOKEN_REWARDS_NORMAL_WEEKLY_BUDGET`, `TOKEN_REWARDS_STRONG_WEEKLY_BUDGET`, `TOKEN_REWARDS_EMERGENCY_WEEKLY_BUDGET`, `TOKEN_REWARDS_MAX_WEEKLY_BUDGET`, `TOKEN_REWARDS_BALANCE_BUDGET_BPS`, `TOKEN_REWARDS_WEAK_INFLOW_THRESHOLD`, `TOKEN_REWARDS_STRONG_INFLOW_THRESHOLD`
  - guard: `DEX_GUARD_MIN_RESERVE_RATIO_BPS`, `DEX_GUARD_REFILL_AMOUNT`, `DEX_GUARD_COOLDOWN_SEC`, `DEX_GUARD_AUTO_REFRESH_BASELINE`, `DEX_GUARD_PRICE_CHECK_ENABLED`, `DEX_GUARD_MAX_DEVIATION_BPS`, `DEX_GUARD_QUOTE_ORACLE`, `DEX_GUARD_MAX_ORACLE_STALENESS_SEC`, `DEX_GUARD_REQUIRE_QUOTE_ORACLE`
  - policy/buyback: `POLICY_SWAP_SLIPPAGE_BPS`, `POLICY_TX_DEADLINE_SEC`, `POLICY_MIN_BUYBACK_INTERVAL_SEC`, `POLICY_BUYBACKS_PAUSED`, `POLICY_MAX_DAILY_BUYBACK_NATIVE`, `BUYBACK_FALLBACK_SLIPPAGE_BPS`, `BUYBACK_FALLBACK_DEADLINE_SEC`, `BUYBACK_FALLBACK_COOLDOWN_SEC`
  - liquidity: `LIQ_TOKEN_PCT`, `LIQ_SLIPPAGE_BPS`, `LIQ_DEADLINE_SEC`, `LIQ_ORCH_MIN_POL_PER_TX`, `LIQ_ORCH_MAX_POL_PER_TX`, `LIQ_ORCH_MIN_DEX_REFILL_BIGGI`, `LIQ_ORCH_COOLDOWN_SEC`, `LIQ_ORCH_DAILY_QUOTA_POL`, `LIQ_KEEPER_MODE`, `LIQ_KEEPER_FIXED_POL`, `LIQ_KEEPER_PERCENT_BPS`, `LIQ_KEEPER_MIN_INTERVAL_SEC`, `LIQ_KEEPER_MIN_RESERVE_POL`, `LIQ_KEEPER_MAX_PER_TX`, `LIQ_KEEPER_MIN_DEX_REFILL_BIGGI`, `LIQ_AUTO_MIN_POL_WEI`, `LIQ_AUTO_MAX_POL_WEI`, `LIQ_AUTO_MIN_INTERVAL_SEC`

Optional CLI args (for direct node run, e.g. `node scripts/master/checkMasterStatus.js --strict`):

- `--strict`
- `--require-code`
- `--addresses <file>`
- `--expect-owner <address>`
- `--expect-liquidity-path keeper_proxy|automation|none`

## Mainnet env validation (pre-deploy)

Validate critical env and parameter ranges before one-shot deploy:

```bash
npm run validate:master:polygon
```

Strict mode (warnings become fail):

```bash
node scripts/master/validateMainnetEnv.js --network polygon --strict --expect-liquidity-path keeper_proxy
```

Alias:

```bash
npm run validate:master:polygon:strict
```

Optional flags:

- `--env <path>` (custom env file)
- `--network polygon`
- `--expect-liquidity-path keeper_proxy|automation|none`

Rule:

- keep `LIQUIDITY_PATH` and `EXPECT_LIQUIDITY_PATH` equal
- recommended production path is `keeper_proxy`
- on Polygon mainnet set `DEV_WALLET` and `EXPECT_OWNER` explicitly

## One-command mainnet preflight

Run the full release gate for `BIGGI_MASTER` mainnet prep:

```bash
npm run preflight:master:polygon
```

What it does:

1. `compile:master`
2. `test:master`
3. optional `test:master:fork` when requested
4. strict env validation via `validateMainnetEnv.js`
5. optional strict on-chain consistency check via `checkMasterStatus.js` when you pass an addresses file
   - includes `MAIN.metadataConsistency()`
   - includes `MAIN.assertMetadataConsistency()`
6. writes a JSON report under `reports/`

Recommended usage before deploy:

```bash
npm run preflight:master:polygon -- --expect-liquidity-path keeper_proxy --expect-owner 0xYourSafe
```

Recommended usage after deploy / before handoff:

```bash
npm run preflight:master:polygon -- --addresses ./addresses.master.json --require-code --expect-liquidity-path keeper_proxy --expect-owner 0xYourSafe
```

Important:

- without `--addresses`, preflight cannot perform the on-chain `MAIN` metadata launch gate
- before opening redeem/public mint on production, run preflight or strict check with deployed addresses so `MAIN.assertMetadataConsistency()` is actually validated

Useful overrides:

```bash
node scripts/master/runMainnetPreflight.js --network polygon --skip-tests
node scripts/master/runMainnetPreflight.js --network polygon --with-fork-tests
node scripts/master/runMainnetPreflight.js --network polygon --addresses ./addresses.master.json --require-code
```

Mainnet preflight report output:

- `reports/master-mainnet-preflight-polygon.json`

## One-command local final gate

Run full local preflight in one command:

```bash
npm run gate:master:local
```

What it does:

1. `compile:master`
2. `test:master`
3. starts local hardhat node if needed
4. `deploy:master:local`
5. strict `check:master:local` with:
   - `CHECK_STRICT=1`
   - `CHECK_REQUIRE_CODE=1`
   - `EXPECT_LIQUIDITY_PATH=keeper_proxy` (default)
   - `LIQUIDITY_PATH=keeper_proxy` (default)

Useful overrides:

```bash
node scripts/master/runFinalGateLocal.js --expect-liquidity-path automation
node scripts/master/runFinalGateLocal.js --skip-tests
node scripts/master/runFinalGateLocal.js --expect-owner 0xYourSafe
```

Gate report output:

- `reports/master-final-gate-local.json`

## Ownership batch (offline)

Generate JSON batches for ownership handoff from deployed addresses file:

```bash
npm run batch:ownership -- --to 0xYourSafe
```

Optional:

```bash
npm run batch:ownership -- --addresses ./addresses.master.json --to 0xYourSafe --out ./ownership-transfer-batch.json
```

Output notes:

- `txs`: run from current owner / deployer role
- `acceptOwnershipTxs`: run from target owner / Safe after the `transferOwnership(...)` txs are mined
- `RESERVE`, `LIQUIDITY_ORCHESTRATOR`, and `LIQUIDITY_KEEPER_PROXY` are `Ownable2Step`, so the second phase is required

## Test without deployment

Yes: local smoke tests run fully without chain deployment.

```bash
npm run test:master
```

For mainnet-like simulation you can use fork tests:

```bash
npm run test:master:fork
```

## Canonical production activation plan

Generate the current Polygon state audit and five separate unsigned phase files:

```bash
npm run plan:production-activation:polygon
```

This command is read-only. It does not request a signer, sign transactions, or
broadcast them. The canonical values come from
`config/production-activation.polygon.json`. Phase `10-initial-liquidity` has a
900-second dynamic deadline, so regenerate it immediately before any human-reviewed use.

Execute the same encoded phase order only on a Polygon fork:

```bash
npm run rehearse:production-activation:fork
```

The rehearsal impersonates the owner only inside Hardhat, verifies exact pair
reserves and Vault accounting, wires a synthetic CRE identity, keeps DripKeeper
paused, and activates only Originals Chapter 1. It never sends a mainnet transaction.

Fork notes:

- requires archive-capable RPC (`FORK_URL` or `.env` `POLYGON_RPC_URL`)
- if provider rate-limits, pin block for cache stability:
  - `FORK_BLOCK_NUMBER=<block>`
