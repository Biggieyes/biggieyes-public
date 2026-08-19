# ABI Inventory

Last verified: 2026-08-17

## Source Of Truth

- Canonical exports: `src/config/abi/index.js`
- ABI JSON files: `src/config/abi/*.json`
- Legacy ABI copies where still required: `src/abis/*.json`
- Validation command: `npm run check:abis`

Current validation result: 58 ABI files and 801 functions.

## Notes

- ABI files are generated/synced from the mainnet contract artifacts and then consumed by frontend contract factories.
- Components should import ABI definitions from `src/config/abi/index.js`.
- Do not paste ABI fragments directly into components.
- Moderator Center ABI is also copied to `src/shared/abis/ModeratorsREWARDS.json` for legacy helper compatibility.

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
- `BiggiVRFRouter.json`
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
