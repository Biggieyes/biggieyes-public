# BIGGI Tokenomic Readers

Read-only helper contracts for the tokenomic mainnet branch.

These readers aggregate reserve, treasury, liquidity, supply, buyback, and tokenomic system state without carrying write authority.

Deployment status: tokenomic readers are deployed on Polygon mainnet as of 2026-06-16; canonical addresses are in `addresses.master.json`.

The master deploy flow now supports this reader layer through `DEPLOY_TOKENOMIC_READERS=1` or individual `DEPLOY_*_READER` flags. Local final gate deploys them automatically. `scripts/master/checkMasterStatus.js` reads their addresses from `addresses.master.json` and verifies their immutable target addresses in strict mode.

## Files

- `BiggiBuybackReader.sol`: immutable targets `BUYBACK_AGENT`, `TREASURY`, optional `POLICY`, optional `BUYBACK_UPKEEP_PROXY`; treasury snapshot includes buyback and ecosystem BIGGI counters.
- `BiggiDexReserveGuardReader.sol`: immutable target `DEX_RESERVE_GUARD`; status includes pair/quote token, reserve baseline, local price anchor, price-check config, quote-oracle address, oracle support mode, oracle answer, oracle freshness, and oracle validity.
- `BiggiLiquidityBranchUserReader.sol`: immutable targets `RESERVE`, `LIQUIDITY_MANAGER`, `LIQUIDITY_VAULT`.
- `BiggiLiquidityHelperReader.sol`: immutable targets `RESERVE`, `LIQUIDITY_MANAGER`, `LIQUIDITY_VAULT`, `ROUTER`.
- `BiggiReserveTreasuryReader.sol`: immutable targets `RESERVE`, `TREASURY`; treasury snapshot includes buyback and ecosystem BIGGI counters. Also exposes `wiringSnapshot()` and `ecosystemBiggiRouteSnapshot(ticketHub, publicCollection, expectedTokenRewards, expectedDripDistributor)` for frontend health checks.
- `BiggiSupplyControllerReader.sol`: immutable target `SUPPLY_CONTROLLER`.
- `BiggiSupplyGuardianReader.sol`: immutable target `SUPPLY_GUARDIAN`.
- `BiggiSystemReader.sol`: immutable targets `BIGGI_TOKEN`, `SUPPLY_CONTROLLER`, `SUPPLY_GUARDIAN`.
- `BiggiTokenomicsSystemAddonReader.sol`: immutable targets `MASTER_CONFIG`, `BIGGI_TOKEN`; `getStatus()` returns core, rewards, pump, liquidity, and collections bundles from master config plus supply/guardian/guard state, including compact DEX guard oracle readiness.
- `BiggiTokenomikReader.sol`: immutable targets `BIGGI_TOKEN`, `ROUTER`, `PAIR`, `DISTRIBUTOR`, `BUYBACK_AGENT_EFFECTIVE`, `RESERVE`, `LIQUIDITY_MANAGER`, `LIQUIDITY_VAULT`, `DRIP_DISTRIBUTOR`, `TOKEN_REWARDS`. Requires a UniswapV2-compatible router with `WETH()` and `getAmountsOut()`. Distributor status includes pending amounts for buyback, collection rewards, reserve, treasury, and community center; TokenRewards status includes `emissionController` and `emissionControllerEnabled`.
- `BiggiTokenRewardsReader.sol`: immutable target `TOKEN_REWARDS`; exposes reward balance, rarity weights, controller address/enabled status, claim previews, and `emissionPreview(user, units)` for dynamic weekly budget display.

## Scaling Collections

`BiggiTokenomicsSystemAddonReader.getStatus().collections` mirrors `BiggiMasterTokenomicsConfig.collectionsBundle()`. This bundle is intentionally compact and represents the current configured core collection pair, not a full multi-chapter collection registry.

For all future chapters and scaled collection discovery, frontend/admin tooling should use the CORE reader layer:

- `BiggiChapterSeriesReader.globalSnapshot()`
- `BiggiChapterSeriesReader.chapterSnapshot(chapterId)`
- `BiggiChapterSeriesReader.collectionSnapshot(collection)`
- `BiggiChapterSeriesReader.batchCollectionSnapshot(collections)`
- `BiggiChapterSeriesReader.chapterPaymentSnapshot(chapterId, treasury)`
- `BiggiMultiCollectionDistributorReaderV2.fullSnapshot(source, pendingRecipient)`

This keeps the scalable source of truth in `BiggiSeriesRegistry` and uses tokenomic readers for tokenomics branch health.

## Address Keys In `addresses.master.json`

- `RESERVE_TREASURY_READER`
- `BUYBACK_READER`
- `LIQUIDITY_BRANCH_READER`
- `LIQUIDITY_HELPER_READER`
- `SUPPLY_CONTROLLER_READER`
- `SUPPLY_GUARDIAN_READER`
- `DEX_RESERVE_GUARD_READER`
- `SYSTEM_READER`
- `TOKENOMICS_SYSTEM_ADDON_READER`
- `BIGGI_TOKENOMICS_READER`
- `BIGGI_TOKENOMIK_READER` alias for the same address
- `TOKEN_REWARDS_READER`

## Verification

Reader coverage is included in:

- `test/master/readers.smoke.test.js`
- `test/master/extended-readers-setups.smoke.test.js`
- `npm run gate:master:local`

Latest local gate result: `Final gate local: OK`, with `Consistency checks: OK`.

Focused recheck on 2026-06-03:

- Reader source files checked: 11.
- ABI package files checked against `artifacts-master`: 70 total ABI checks across CORE and TOKENOMIC exports, mismatches: 0.
- Constructor wiring checked against `scripts/master/deployMasterStack.js`: consistent.
- Compile check: `npm run compile:master` OK.
- Runtime check: `npx hardhat test --config hardhat.biggi-master.cjs test/master/readers.smoke.test.js test/master/extended-readers-setups.smoke.test.js test/master/ecosystem-biggi-payments.smoke.test.js` OK, 7 passing.

Focused hardening recheck on 2026-06-07:

- `BiggiDexReserveGuardReader.getStatus()` includes oracle readiness fields from `BiggiDexReserveGuard.quoteOracleStatus()`.
- `BiggiTokenomicsSystemAddonReader.getStatus()` includes compact guard readiness fields for frontend/admin launch checks.
- Runtime checks: `npx hardhat test --config hardhat.biggi-master.cjs test/master/readers.smoke.test.js test/master/extended-readers-setups.smoke.test.js` OK, 5 passing; full `npm run test:master` OK, 66 passing.
- Local final gate: `npm run gate:master:local` OK, report status `ok`.
- ABI check: `node scripts/tools/compareTokenomicAbi.js` OK, 44 contracts, 0 issues.

Deep recheck on 2026-06-07:

- Reader source files checked: 11.
- Reader runtime checks: `npx hardhat test test/master/readers.smoke.test.js test/master/extended-readers-setups.smoke.test.js --config hardhat.biggi-master.cjs` OK, 5 passing.
- Full master verification: `npm run test:master` OK, 66 passing; `npm run gate:master:local` OK.
- ABI check: `node scripts/tools/compareTokenomicAbi.js` OK, 44 contracts, 0 issues.
- ABI-to-source check: `node scripts/tools/compareAbiToSource.js` OK, 25 contracts, 0 issues.

Dynamic TokenRewards reader recheck on 2026-06-10:

- `BiggiTokenRewardsReader.getStatus()` includes `emissionController` and `emissionControllerEnabled`.
- `BiggiTokenRewardsReader.emissionPreview(user, units)` exposes dynamic weekly budget, paid amount, and unit reward.
- `BiggiTokenomikReader.getFullStatus()` includes TokenRewards controller address/enabled status.
- Full master test: `npm run test:master` OK, 79 passing (2026-08-17).
- Local final gate: `npm run gate:master:local` OK, report status `ok`.
- ABI check: `node scripts/tools/compareTokenomicAbi.js` OK, 46 contracts, 0 issues.
- ABI-to-source check: `node scripts/tools/compareAbiToSource.js` OK, 25 contracts, 0 issues.
