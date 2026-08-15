# TOKENOMICMAINNET

Deployment status: deployed on Polygon mainnet. Tokenomics phase 1 and phase 2 are verified and the one-time initial BIGGI distribution is complete; public economic activation still waits for initial liquidity, MAIN2 metadata and CRE activation.

This branch contains the BIGGI token, reserve, treasury, drip, buyback, liquidity, supply protection, moderator, reader, setup, upkeep/CRE, and tokenomic library contracts.

## Current Verification

Last verified: 2026-07-05.

- `npm run compile:master` passed.
- `npm run test:master` passed with `74 passing`.
- Polygon deployment manifest passed with `50/50` project deployments containing bytecode and verified source code.
- `npm run gate:master:local` passed with `Final gate local: OK`.
- Strict local status check returned `Consistency checks: OK`.
- `ABI/` contains 46 contract ABI files plus `index.json` and matches current `artifacts-master`.
- `TOKENOMIC_LIBRARY/` contains 5 libraries; all have ABI snapshots in `ABI/`.
- `TOKENOMIC_READERS/` contains 11 tokenomic reader contracts; master deploy/check flow supports them.

Dynamic TokenRewards emission update on 2026-06-10:

- Added `BiggiTokenRewardsEmissionController` as an optional weekly budget controller for `BiggiTokenRewards`.
- Rarity policy remains in `BiggiTokenRewards`: block weights still produce reward units.
- The controller converts those units into a weekly amount from live protocol state: treasury BIGGI inflow, TokenRewards balance, configured target weekly units, and bounded min/weak/normal/strong/emergency budget tiers.
- The controller cannot raise a claim above the default `rarityUnits * unitReward`; it can only reduce/cap the payout.
- If a claim exceeds the remaining weekly budget, it reverts instead of partially paying and marking all NFTs claimed.
- `BiggiTokenRewardsReader` and `BiggiTokenomikReader` expose controller address/enabled status; `BiggiTokenRewardsReader.emissionPreview(user, units)` exposes live budget preview data.
- `deployMasterStack.js`, `configureMasterEssence.js`, and `checkMasterStatus.js` now understand `TOKEN_REWARDS_EMISSION_CONTROLLER`.
- Verification passed: `npm run compile:master`, `npm run test:master` with 74 passing, deployment manifest 50/50 verified, tokenomic ABI compare with 46 contracts / 0 issues, ABI-to-source compare with 25 contracts / 0 issues.

Focused hardening recheck on 2026-06-07:

- `BiggiDexReserveGuard` now validates the configured pair against both BIGGI and quote token.
- `BiggiDexReserveGuard` supports Chainlink-like `latestRoundData()` and legacy `latestAnswer()` quote oracle inputs.
- `BiggiDexReserveGuard` exposes `quoteOracleStatus()` and configurable oracle staleness.
- `BiggiLpPriceFeed` now exposes `latestAnswer()` in addition to `latestRoundData()`.
- `BiggiDexReserveGuardReader` and `BiggiTokenomicsSystemAddonReader` expose oracle/readiness state for frontend/admin checks.
- Full checks passed: `npm run compile:master`, `npm run test:master`, `npm run gate:master:local`.
- ABI checks passed: `node scripts/tools/compareTokenomicAbi.js` returned 44 contracts, 0 issues; `node scripts/tools/compareAbiToSource.js` returned 25 CORE contracts, 0 issues.

Deep tokenomics audit on 2026-06-07:

- `BiggiTreasury` is now fail-closed for BIGGI split flows: `buybackDepositAndSplit`, `ownerDepositAndSplit`, and `receiveEcosystemBiggi` require `tokenRewards`, `reserve`, and `dripDistributor` to be configured before tokens are pulled.
- `BiggiTreasury` critical route setters reject zero addresses and BIGGI/POL external entrypoints are protected by `ReentrancyGuard`.
- `BiggiBuybackAgent` rescue paths now reject zero recipients, use `SafeERC20`, and use native `call` instead of `transfer`.
- Added smoke coverage for unsafe zero treasury routes, unsafe buyback rescue recipients, and incomplete BIGGI split target handling.
- Verification passed: `npm run compile:master`, `npm run test:master` with 66 passing, `npm run gate:master:local`, `node scripts/tools/compareTokenomicAbi.js`, and `node scripts/tools/compareAbiToSource.js`.

## Main Runtime Branches

- `BiggiToken`: ERC20 supply, initial distribution, guardian mint budgets, reserve lock after initial distribution.
- `BiggiReserveV4`: reserve buckets, strict notify callers, liquidity manager bridge, reserve consistency helpers.
- `BiggiTreasury`: BIGGI/POL accounting, buyback split routing, ecosystem BIGGI split routing for NFT payments, fallback POL accounting.
- `BiggiDripDistributor`: drip allocation and claim accounting.
- `BiggiTokenRewards`: lives in `CORE`; tokenomics wires into it through token, treasury, registry, and readers during final deployment.
- `BiggiTokenRewardsEmissionController`: optional dynamic weekly emission budget for TokenRewards while preserving rarity weights.
- `BiggiSupplyController`: bounded refill automation and circuit breaker logic.
- `BiggiSupplyGuardian`: manual ops helper over the supply controller.
- `BiggiDexReserveGuard`: DEX reserve monitoring/refill trigger.
- `BiggiPolicy`: buyback policy and daily quota guard.
- `BiggiBuybackAgent`: POL/native buyback execution and treasury routing.
- `BiggiLiquidityManager`, `LiquidityVault`, `BiggiLiquidityOrchestrator`, `BiggiLiquidityKeeperProxy`, `LiquidityAutomation`: liquidity branch.
- `BiggiMasterTokenomicsConfig`: canonical address bundle for the tokenomics stack.
- `BiggiCREAutomationReceiver`: CRE receiver/bridge that forwards signed CRE reports to allowlisted keeper targets.

## Mainnet Notes

Mainnet deployment now has real external addresses. Remaining operational values before public activation:

- `PAIR`, `QUOTE_TOKEN`, `ROUTER`, `FACTORY`, `WETH`
- optional `DEX_GUARD_QUOTE_ORACLE`, `DEX_GUARD_MAX_ORACLE_STALENESS_SEC`, `DEX_GUARD_REQUIRE_QUOTE_ORACLE`, `DEX_GUARD_REFRESH_PRICE_ANCHOR`
- optional VRF values or final `VRF_ROUTER`
- final `DEV_WALLET`
- final `EXPECT_OWNER` / Safe / timelock
- final CRE workflow deployment/activation and receiver wiring
- final buyback/router/policy values

`addresses.master.json` is now the canonical merged Polygon manifest; use it together with the phase-specific Polygon manifests.

## BIGGI NFT Payment Routing

Final master-stack wiring sends BIGGI paid for NFTs through treasury, not by a passive token transfer:

- `BiggiTicketHub.tokenSink = BiggiTreasury`
- `BiggiMain2.tokenSink = BiggiTreasury`
- `tokenSinkBps = 10000`
- `tokenSinkDepositMode = true`
- `BiggiTreasury.ecosystemBiggiCallers(TicketHub/Main2) = true`

The resulting treasury split is `34%` to `BiggiTokenRewards`, `33%` to `BiggiReserveV4`, and `33%` to `BiggiDripDistributor`.

The split is intentionally fail-closed. If any of `BiggiTreasury.tokenRewards`, `BiggiTreasury.reserveAddr`, or `BiggiTreasury.dripDistributor` is unset, the BIGGI payment/split transaction reverts and no BIGGI is pulled into treasury.

Frontend/read verification for this route is exposed through:

- `BiggiMainReader.getTicketHubFrontendSnapshot(user, treasury)`
- `BiggiChapterSeriesReader.chapterPaymentSnapshot(chapterId, treasury)`
- `BiggiReserveTreasuryReader.ecosystemBiggiRouteSnapshot(ticketHub, publicCollection, tokenRewards, dripDistributor)`

## Related Docs

- `MAINNET_DEPLOY_ORDER_CS.md`
- `MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md`
- `MAINNET_FINAL_GATE_CHECKLIST_CS.md`
- `MAINNET_DEPLOY_REQUIREMENTS_CS.md`
- `TOKENOMICS_AUDIT.md`
- `ABI/README.md`
- `TOKENOMIC_LIBRARY/README.md`
- `TOKENOMIC_READERS/README.md`
- `TOKENOMICS_DEEP_AUDIT_2026-06-07_CS.md`
