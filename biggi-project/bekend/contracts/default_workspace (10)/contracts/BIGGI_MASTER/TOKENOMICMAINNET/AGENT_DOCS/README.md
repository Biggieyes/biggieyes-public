# Agent docs index

This folder documents the `TOKENOMICMAINNET` branch and how it connects to core
contracts from `BIGGI_MASTER`.

## Core contracts (BIGGI_MASTER root)

These contracts are one directory up from `TOKENOMICMAINNET`:

- `../BiggiMain.sol`
- `../BiggiMain2.sol`
- `../BiggiTicketHub.sol`
- `../BiggiSeriesRegistry.sol`
- `../BiggiChapterController.sol`
- `../BiggiCompute.sol`
- `../BiggiCollectionRewards.sol`
- `../BiggiTokenRewards.sol`
- `../BiggiNftRewards.sol`
- `../BiggiVrfRouter.sol`
- `../BiggiMultiCollectionDistributor.sol`

## Core libraries (BIGGI_MASTER root)

- `../Library/BiggiBpsLib.sol`
- `../Library/BiggiCapsLib.sol`
- `../Library/BiggiErrorsLib.sol`
- `../Library/BiggiIdIndexLib.sol`
- `../Library/BiggiMetaRedeemLib.sol`
- `../Library/BiggiNamesLib.sol`
- `../Library/BiggiNamesLib2.sol`
- `../Library/BiggiPriceMathLib.sol`
- `../Library/BiggiSwapLib.sol`

## Tokenomics contracts (this folder)

- `00_TOKENOMICS_STATIC_AUDIT.md`
- `BiggiBuybackAgent_AGENT.md`
- `BiggiBuybackDripSetup_AGENT.md`
- `BiggiBuybackReader_AGENT.md`
- `BiggiCommunityCenter_AGENT.md`
- `BiggiDexReserveGuard_AGENT.md`
- `BiggiDexReserveGuardReader_AGENT.md`
- `BiggiDripDistributor_AGENT.md`
- `BiggiDripKeeperProxy_AGENT.md`
- `BiggiDripLMToModerator_AGENT.md`
- `BiggiLiquidityAutomation_AGENT.md`
- `BiggiLiquidityBranchUserReader_AGENT.md`
- `BiggiLiquidityHelperReader_AGENT.md`
- `BiggiLiquidityKeeperProxy_AGENT.md`
- `BiggiLiquidityManager_AGENT.md`
- `BiggiLiquidityOrchestrator_AGENT.md`
- `BiggiLiquiditySetup_AGENT.md`
- `BiggiLiquidityVault_AGENT.md`
- `BiggiLpPriceFeed_AGENT.md`
- `BiggiMainReader_AGENT.md`
- `BiggiMasterTokenomicsConfig_AGENT.md`
- `BiggiNftRewardsReader_AGENT.md`
- `BiggiPolicy_AGENT.md`
- `BiggiReserveTreasuryReader_AGENT.md`
- `BiggiReserveV4_AGENT.md`
- `BiggiSupplyController_AGENT.md`
- `BiggiSupplyControllerReader_AGENT.md`
- `BiggiSupplyGuardian_AGENT.md`
- `BiggiSupplyGuardianReader_AGENT.md`
- `BiggiSystemReader_AGENT.md`
- `BiggiToken_AGENT.md`
- `BiggiTokenomikReader_AGENT.md`
- `BiggiTokenomicsSystemAddonReader_AGENT.md`
- `BiggiTokenRewardsReader_AGENT.md`
- `BiggiTreasury_AGENT.md`
- `BiggiUpKeeperProxy_AGENT.md`
- `ModeratorCenter_AGENT.md`
- `Multicall2_AGENT.md`

## Tokenomics libraries (this folder)

Library docs are in `Library/`:

- `Library/BiggiBpsLib_AGENT.md`
- `Library/BiggiCapsLib_AGENT.md`
- `Library/BiggiErrorsLib_AGENT.md`
- `Library/BiggiIdIndexLib_AGENT.md`
- `Library/BiggiSwapLib_AGENT.md`

## Runtime consistency snapshot (2026-03-20)

Validated end-to-end in `biggi-project/bekend` with:

- `npx hardhat test --config hardhat.biggi-master.cjs test/master/extended-readers-setups.smoke.test.js`
- `npm run test:master`
- `npm run deploy:master:local`
- `CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 npm run check:master:local`

Current result: all checks passed in local persistent deployment flow.
