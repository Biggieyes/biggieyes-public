# Tokenomics consistency notes

Status 2026-06-16: tokenomics contracts are deployed on Polygon mainnet. This audit remains a source-level consistency audit; live addresses are in `MAINNET_CONTRACT_RECORDS.md`.

## Changes applied
- Fixed malformed `BiggiToken.sol` by merging guardian/controller authority into the contract body.
- Raised total BIGGI cap to include guardian refill budgets.
- Added explicit guardian budgets in `BiggiCapsLib`.
- Expanded `BiggiDripDistributor` historical cap to accept guardian drip refills.
- Rewrote `BiggiBuybackDripSetup.sol` to remove invalid interface bodies and keep setup-only behavior.
- Upgraded `BiggiSupplyController` with reserve-floor detection, Chainlink/Gelato-style upkeep hooks, keeper allowlist, and maintenance preview.
- Converted `BiggiSupplyGuardian` into a manual ops helper over the controller instead of a second mint authority brain.
- Aligned `BiggiTreasury` buyback split calculations with named `BiggiBpsLib` constants instead of raw `3400/3300` literals.
- Added `BiggiTreasury.receiveEcosystemBiggi(uint256)` with explicit caller allowlist for BIGGI paid NFT purchases from `BiggiTicketHub` and `BiggiMain2`.
- Updated master deploy/check flow so NFT BIGGI payments route to treasury with `tokenSinkDepositMode = true` and split `34%/33%/33%`.
- Added `BiggiCREAutomationReceiver` as the CRE migration bridge for existing keeper targets.

## Logic changes
- **MAJOR**: tokenomics is now elastic within bounded guardian budgets.
- **MINOR**: NFT payments in BIGGI can now enter treasury through an explicit ecosystem split path instead of passive token transfer.
- **MINOR**: setup/orchestrator cleanup and controller automation hooks.
- **NO LOGIC CHANGE**: readers and malformed syntax cleanup where behavior was preserved.

## Current consistency status

- `npm run compile:master` passed.
- `npm run test:master` passed with `66 passing`.
- `npm run gate:master:local` passed with `Final gate local: OK`.
- Strict local status check returned `Consistency checks: OK`.
- `TOKENOMICMAINNET/ABI` contains 46 contract ABI files plus `index.json` and matches current `artifacts-master`.
- Tokenomic library ABI snapshots are included for all 5 tokenomic libraries.
- Tokenomic reader ABI snapshots are included for all 11 tokenomic readers.
- `BiggiCapsLib.sol` is synchronized between `CORE/CORE_LIBRARY` and `TOKENOMICMAINNET/TOKENOMIC_LIBRARY`.

Historical focused consistency audit on 2026-06-04:

- Tokenomic library source files checked: 5.
- Tokenomic library ABI files checked against `artifacts-master`: 5, mismatches: 0.
- Full tokenomics ABI package checked against `artifacts-master`: 44/44, mismatches: 0.
- Full master test suite passed at that time; current authoritative result is the 2026-06-07 recheck above.
- Final local gate: `Final gate local: OK`.
- Strict status check: `Consistency checks: OK`.

Deep consistency audit on 2026-06-07:

- `BiggiTreasury` critical route setters now reject zero addresses.
- `BiggiTreasury` BIGGI split flows now require all three split recipients before token pull: `tokenRewards`, `reserveAddr`, and `dripDistributor`.
- `BiggiTreasury` external BIGGI/POL entrypoints and rescue functions are protected by `ReentrancyGuard`.
- `BiggiBuybackAgent` rescue paths now use `SafeERC20`, reject zero recipients, and use native `call` for rescue native.
- Added smoke tests for zero-route rejection, unsafe buyback rescue recipients, and incomplete BIGGI split target handling.
- Current verification: `npm run compile:master` OK, `npm run test:master` OK with `66 passing`, `npm run gate:master:local` OK, tokenomic ABI compare OK with 44 contracts / 0 issues, ABI-to-source compare OK with 25 contracts / 0 issues.

Focused branch audit on 2026-06-08:

- `BiggiBuybackUpkeepProxy` no longer calls `buybackAllToTreasury(0)`. It previews protected output through `BiggiBuybackAgent.previewAutoMinOut(uint256)` and refuses execution with `MIN_OUT_ZERO` when the quote is unavailable.
- `BiggiBuybackAgent` exposes `previewAutoMinOut(uint256)` for keeper/front-end safety checks and uses the same quote/slippage calculation as the protected auto-buyback path.
- `BiggiDripLMToModerator` validates router quote/minOut before claiming from `BiggiDripDistributor`. If protected output is zero, distributor accounting and DripLM token balance remain unchanged.
- `BiggiToken.refillRewardsIfBelow(uint256,uint256)` now consumes the same `guardianRewardsMinted` / `GUARDIAN_REWARDS_MINT_CAP` budget as controller rewards refills, so the optional rewards operator cannot bypass the rewards refill cap.
- Zero-amount mints now revert on owner mint and guardian drip/rewards mint paths.
- Added focused tests for buyback keeper minOut protection, drip quote failure before claim, and rewards-operator cap accounting.
- Current verification: `npm run compile:master` OK, focused branch tests OK with `33 passing`, `npm run test:master` OK with `70 passing`, `npm run gate:master:local` OK, tokenomic ABI compare OK with 44 contracts / 0 issues, ABI-to-source compare OK with 25 contracts / 0 issues.

Reserve / liquidity branch audit on 2026-06-09:

- Confirmed mint native flow: collection mint forwards native to `BiggiMultiCollectionDistributor`, which splits distributor-side native to collection rewards, reserve, buyback, treasury, and community center.
- Confirmed liquidity flow: `BiggiReserveV4` holds native POL plus `dexRefillBiggi` bucket; `BiggiLiquidityManager` pulls both, calls router `addLiquidityETH`, mints LP directly to `LiquidityVault`, and then syncs vault accounting.
- Improved reserve trigger consistency: `BiggiReserveV4` now also attempts LM auto-pairing after a `DEX_REFILL` BIGGI notification, not only after native `receiveMintShare()`. This covers the real order where reserve native can arrive before treasury/buyback BIGGI reaches the reserve bucket.
- Reentrancy/loop guard: reserve does not auto-trigger LM when `notifyBiggiReceived()` is called by the configured liquidity manager while returning leftovers.
- Added focused test for native reserve funding followed by BIGGI notify causing immediate LM pairing and vault LP sync.
- Current verification: `npm run compile:master` OK, liquidity branch test OK with `4 passing`, `npm run test:master` OK with `71 passing`, `npm run gate:master:local` OK, tokenomic ABI compare OK with 44 contracts / 0 issues, ABI-to-source compare OK with 25 contracts / 0 issues.

Scaling collections / tokenomics audit on 2026-06-09:

- `BiggiSeriesRegistry` is the scalable source of truth for future chapters. Each chapter maps exactly one VRF collection, one public collection, and one TicketHub. Registry guards prevent reusing the same collection address across different chapters.
- `BiggiChapterController.configureChapter(...)` hard-checks that registry collections match the supplied chapter stack, that `saleCap + marketingCap == totalCap`, that `TicketHub.mainCollection == VRF collection`, that `VRF collection.ticketHub == TicketHub`, and that hub caps match the controller caps.
- `BiggiCollectionRewards`, `BiggiTokenRewards`, and `BiggiNFTRewards` can follow future chapter collections through `setRegistry(BiggiSeriesRegistry)`. Collection rewards eligibility is intentionally limited to the chapter VRF collection; token rewards eligibility can include both VRF and public collections according to registry flags.
- `BiggiMultiCollectionDistributor` is scalable but intentionally allowlisted. Every new chapter source that may forward native must be added with `addCollection(...)`, typically `TicketHub`, `Main2`, and optionally `Main` if that source forwards native directly. Registry attribution is optional accounting; failed attribution does not block the split.
- BIGGI-paid NFT purchases for every new TicketHub/Main2 must use `setTokenSink(BiggiTreasury, 10000)`, `setTokenSinkDepositMode(true)`, and `BiggiTreasury.setEcosystemBiggiCaller(source, true)`.
- Reserve strict notify mode requires new chapter sources and treasury to be allowlisted through `BiggiReserveV4.setNotifyCaller(...)`.
- `BiggiMasterTokenomicsConfig.collectionsBundle()` is a compact current-bundle snapshot, not a scalable registry of all future collections. Frontend/admin tooling should use `BiggiChapterSeriesReader` plus registry snapshots for multi-chapter collection discovery.
- Added `scripts/master/configureChapterTokenomics.js` as an idempotent dry-run-first helper for wiring a future chapter into tokenomics without redeploying shared tokenomics contracts.
- Focused verification: `npx hardhat test --config hardhat.biggi-master.cjs test/master/scaling-collections.smoke.test.js test/master/multicollection-consistency.smoke.test.js test/master/ecosystem-biggi-payments.smoke.test.js test/master/token-drip-guard.smoke.test.js test/master/extended-readers-setups.smoke.test.js` OK with `33 passing`.

Dynamic TokenRewards emission audit on 2026-06-10:

- Added `BiggiTokenRewardsEmissionController` to prevent fixed weekly token rewards from ignoring protocol conditions.
- `BiggiTokenRewards` remains the rarity source of truth. It computes claim units from NFT block weights and calls the controller only after units are known.
- Default behavior is backward compatible while `emissionControllerEnabled == false`: payout remains `units * unitReward`.
- When enabled, the controller sets a weekly budget from treasury BIGGI inflow plus configured min/weak/normal/strong/emergency tiers, capped by `maxWeeklyBudget` and optional TokenRewards balance BPS.
- Weekly unit reward is `budget / targetWeeklyUnits`. A user with higher rarity still receives a proportional higher amount because the controller multiplies by the same units passed from `BiggiTokenRewards`.
- The controller caps each claim at the default `units * unitReward`, so the dynamic policy can reduce or smooth emissions but cannot inflate above the legacy configured maximum.
- If a claim would exceed remaining weekly budget, it reverts. Since `BiggiTokenRewards` marks NFTs inside the same transaction, the revert restores claim state and avoids silent partial payouts.
- `BiggiTokenRewardsReader` now exposes controller address/enabled status and `emissionPreview(user, units)`.
- `BiggiTokenomikReader` now includes TokenRewards controller address/enabled status in the aggregate tokenomics status.
- `deployMasterStack.js` can deploy and enable the controller by default; `configureMasterEssence.js` can reconcile its wiring and budget parameters; `checkMasterStatus.js` validates the live link in strict checks.
- Current verification (2026-07-05): `npm run compile:master` OK, `npm run test:master` OK with `74 passing`, Polygon deployment manifest 50/50 verified, tokenomic ABI compare OK with 46 contracts / 0 issues, ABI-to-source compare OK with 25 contracts / 0 issues.

CRE automation migration update on 2026-06-26:

- Added `BiggiCREAutomationReceiver.sol` for Chainlink CRE signed-report execution.
- CRE workflow should replace Chainlink Automation registry orchestration: it reads `checkUpkeep("0x")`, builds `performUpkeep(performData)`, wraps it as `(target, callData)`, and writes that report to the receiver.
- Receiver enforces `msg.sender == KeystoneForwarder`, optional metadata hash allowlist, report/callData size limits, and target/function-selector allowlist.
- Polygon mainnet default CRE `KeystoneForwarder` recorded for deployment scripts: `0x76c9cf548b4179F8901cda1f8623568b58215E62`.
- Added `scripts/master/deployCREAutomationReceiver.js` plus Polygon runner/package commands for deploy and optional wiring.
- Operational docs updated in `MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md` and `MAINNET_AUTOMATION_MATRIX.md`.

## Reader and deploy flow updates

- `scripts/master/deployMasterStack.js` supports optional tokenomic reader deployment through `DEPLOY_TOKENOMIC_READERS=1`.
- Local deploys automatically deploy the tokenomic reader layer.
- `scripts/master/checkMasterStatus.js` reads tokenomic reader addresses and checks their immutable target wiring:
  - reserve/treasury reader
  - buyback reader
  - liquidity branch/helper readers
  - supply controller/guardian readers
  - DEX reserve guard reader
  - system/addon readers
  - tokenomics aggregate reader
  - token rewards reader
- Frontend health additions:
  - `BiggiReserveTreasuryReader.wiringSnapshot()` exposes reserve/treasury recipient wiring and bucket consistency.
  - `BiggiReserveTreasuryReader.ecosystemBiggiRouteSnapshot(...)` verifies TicketHub/Main2 treasury allowlists, reserve notify caller, and split recipients.
  - `BiggiTokenomicsSystemAddonReader.getStatus()` now exposes master config bundles for core, rewards, pump, liquidity, and collections.
  - `BiggiTokenomikReader.getFullStatus()` distributor status now exposes pending balances for buyback, collection rewards, reserve, treasury, and community center.

## Remaining review targets
- Mainnet addresses are intentionally still missing and must be filled only during final deployment.
- `Multicall2.sol` is a standard utility and was not modified.
- `BiggiLiquidityAutomation.sol`, `BiggiLiquidityKeeperProxy.sol`, `BiggiUpKeeperProxy.sol`, `BiggiSupplyController.sol`, `BiggiDexReserveGuard.sol`, and `BiggiDripKeeperProxy.sol` remain the keeper execution targets; CRE replaces only the orchestration layer.
- Polygon mainnet final gate still requires real `PAIR`, `QUOTE_TOKEN`, `ROUTER`, `FACTORY`, `WETH`, optional VRF values, final owner, and final CRE workflow/receiver configuration.
