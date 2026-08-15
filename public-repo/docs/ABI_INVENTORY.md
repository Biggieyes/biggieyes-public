# ABI Inventory

Last verified: 2026-06-16

## Source Of Truth

- Canonical exports: `src/config/abi/index.js`
- ABI JSON files: `src/config/abi/*.json`
- Validation command: `npm run check:abis`

Current validation result: 58 ABI files and 745 functions.

## Mainnet Utility Reference

`Multicall2.json` is used by the BIGGIEYES frontend read layer for the official Polygon mainnet `MULTICALL2` utility at `0x70bc315E4E5548e54F358Abf4515C1bB1551687b`. Its purpose is to aggregate multiple frontend and analytics reads into a single RPC call. It does not custody protocol funds and is not a minting, treasury, rewards, or governance authority.

## ABI Files In `src/config/abi`

- `BiggiBuybackAgent.json`
- `BiggiBuybackDripSetup.json`
- `BiggiBuybackReader.json`
- `BiggiBuybackUpkeepProxy.json`
- `BiggiCollectionRewards.json`
- `BiggiCommunityCenter.json`
- `BiggiCompute.json`
- `BiggiDexReserveGuard.json`
- `BiggiDexReserveGuardReader.json`
- `BiggiDripDistributor.json`
- `BiggiDRIPKeeper.json`
- `BiggiDRIPLM.json`
- `BiggiDripLMToModerator.json`
- `BiggiChapterController.json`
- `BiggiChapterSeriesReader.json`
- `BiggiLiquidityBranchUserReader.json`
- `BiggiLiquidityHelperReader.json`
- `BiggiLiquidityManager.json`
- `BiggiLiquidityOrchestrator.json`
- `BiggiLpPriceFeed.json`
- `BiggiMain.json`
- `BiggiMain2.json`
- `BiggiMainReader.json`
- `BiggiMasterTokenomicsConfig.json`
- `BiggiMultiCollectionDistributor.json`
- `BiggiMultiCollectionDistributorReader.json`
- `BiggiMultiCollectionDistributorReaderV2.json`
- `BiggiNftRewards.json`
- `BiggiNftRewardsReader.json`
- `BiggiPolicy.json`
- `BiggiReserveTreasuryReader.json`
- `BiggiReserveV4.json`
- `BiggiSeriesRegistry.json`
- `BiggiSupplyController.json`
- `BiggiSupplyControllerReader.json`
- `BiggiSupplyGuardian.json`
- `BiggiSupplyGuardianReader.json`
- `BiggiSystemReader.json`
- `BiggiTicketHub.json`
- `BiggiToken.json`
- `BiggiTokenomicsSystemAddonReader.json`
- `BiggiTokenomikReader.json`
- `BiggiTokenRewards.json`
- `BiggiTokenRewardsReader.json`
- `BiggiTreasury.json`
- `BiggiUpkeeperProxy.json`
- `BiggiVrfRouter.json`
- `DripKeeperProxy.json`
- `LiquidityAutomation.json`
- `LiquidityKeeperProxy.json`
- `LiquiditySetup.json`
- `LiquidityVault.json`
- `ModeratorCenter.json`
- `Multicall2.json`
- `UniswapV2Factory.json`
- `UniswapV2Pair.json`
- `UniswapV2Router02.json`
- `WETH9.json`
