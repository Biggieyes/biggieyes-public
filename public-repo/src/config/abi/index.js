// ABI source of truth for BIGGI_MASTER.
// Canonical exports follow source/contract naming, while legacy aliases stay exported
// so existing frontend imports do not break.

import BiggiBuybackAgent from "./BiggiBuybackAgent.json";
import BiggiBuybackDripSetup from "./BiggiBuybackDripSetup.json";
import BiggiBuybackReader from "./BiggiBuybackReader.json";
import BiggiBuybackUpkeepProxy from "./BiggiBuybackUpkeepProxy.json";
import BiggiChapterController from "./BiggiChapterController.json";
import BiggiChapterSeriesReader from "./BiggiChapterSeriesReader.json";
import BiggiCollectionRewards from "./BiggiCollectionRewards.json";
import BiggiCommunityCenter from "./BiggiCommunityCenter.json";
import BiggiCompute from "./BiggiCompute.json";
import BiggiDexReserveGuard from "./BiggiDexReserveGuard.json";
import BiggiDexReserveGuardReader from "./BiggiDexReserveGuardReader.json";
import BiggiDripDistributor from "./BiggiDripDistributor.json";
import BiggiDripLMToModerator from "./BiggiDripLMToModerator.json";
import DripKeeperProxy from "./DripKeeperProxy.json";
import BiggiLiquidityHelperReader from "./BiggiLiquidityHelperReader.json";
import BiggiLiquidityBranchUserReader from "./BiggiLiquidityBranchUserReader.json";
import BiggiLiquidityManager from "./BiggiLiquidityManager.json";
import BiggiLiquidityOrchestrator from "./BiggiLiquidityOrchestrator.json";
import LiquidityAutomation from "./LiquidityAutomation.json";
import LiquidityKeeperProxy from "./LiquidityKeeperProxy.json";
import LiquiditySetup from "./LiquiditySetup.json";
import LiquidityVault from "./LiquidityVault.json";
import BiggiLpPriceFeed from "./BiggiLpPriceFeed.json";
import BiggiMain from "./BiggiMain.json";
import BiggiMain2 from "./BiggiMain2.json";
import BiggiMainReader from "./BiggiMainReader.json";
import BiggiMasterTokenomicsConfig from "./BiggiMasterTokenomicsConfig.json";
import BiggiMultiCollectionDistributor from "./BiggiMultiCollectionDistributor.json";
import BiggiMultiCollectionDistributorReader from "./BiggiMultiCollectionDistributorReader.json";
import BiggiMultiCollectionDistributorReaderV2 from "./BiggiMultiCollectionDistributorReaderV2.json";
import BiggiNftRewards from "./BiggiNftRewards.json";
import BiggiNftRewardsReader from "./BiggiNftRewardsReader.json";
import BiggiPolicy from "./BiggiPolicy.json";
import BiggiReserveTreasuryReader from "./BiggiReserveTreasuryReader.json";
import BiggiReserveV4 from "./BiggiReserveV4.json";
import BiggiSeriesRegistry from "./BiggiSeriesRegistry.json";
import BiggiSupplyController from "./BiggiSupplyController.json";
import BiggiSupplyControllerReader from "./BiggiSupplyControllerReader.json";
import BiggiSupplyGuardian from "./BiggiSupplyGuardian.json";
import BiggiSupplyGuardianReader from "./BiggiSupplyGuardianReader.json";
import BiggiSystemReader from "./BiggiSystemReader.json";
import BiggiTicketHub from "./BiggiTicketHub.json";
import BiggiToken from "./BiggiToken.json";
import BiggiTokenomicsSystemAddonReader from "./BiggiTokenomicsSystemAddonReader.json";
import BiggiTokenomikReader from "./BiggiTokenomikReader.json";
import BiggiTokenRewards from "./BiggiTokenRewards.json";
import BiggiTokenRewardsReader from "./BiggiTokenRewardsReader.json";
import BiggiTreasury from "./BiggiTreasury.json";
import BiggiVrfRouter from "./BiggiVRFRouter.json";
import ModeratorCenter from "./ModeratorCenter.json";
import Multicall2 from "./Multicall2.json";
import UniswapV2Factory from "./UniswapV2Factory.json";
import UniswapV2Pair from "./UniswapV2Pair.json";
import UniswapV2Router02 from "./UniswapV2Router02.json";
import WETH9 from "./WETH9.json";

const BiggiDRIPDistributor = BiggiDripDistributor;
const BiggiDRIPLM = BiggiDripLMToModerator;
const BiggiDRIPKeeper = DripKeeperProxy;
const BiggiUpkeeperProxy = BiggiBuybackUpkeepProxy;
const BiggiVRFRouter = BiggiVrfRouter;

export {
  BiggiBuybackAgent,
  BiggiBuybackDripSetup,
  BiggiBuybackReader,
  BiggiBuybackUpkeepProxy,
  BiggiChapterController,
  BiggiChapterSeriesReader,
  BiggiCollectionRewards,
  BiggiCommunityCenter,
  BiggiCompute,
  BiggiDexReserveGuard,
  BiggiDexReserveGuardReader,
  BiggiDripDistributor,
  BiggiDripLMToModerator,
  DripKeeperProxy,
  BiggiDRIPDistributor,
  BiggiDRIPLM,
  BiggiDRIPKeeper,
  BiggiLiquidityHelperReader,
  BiggiLiquidityBranchUserReader,
  BiggiLiquidityManager,
  BiggiLiquidityOrchestrator,
  LiquidityAutomation,
  LiquidityKeeperProxy,
  LiquiditySetup,
  LiquidityVault,
  BiggiLpPriceFeed,
  BiggiMain,
  BiggiMain2,
  BiggiMainReader,
  BiggiMasterTokenomicsConfig,
  BiggiMultiCollectionDistributor,
  BiggiMultiCollectionDistributorReader,
  BiggiMultiCollectionDistributorReaderV2,
  BiggiNftRewards,
  BiggiNftRewardsReader,
  BiggiPolicy,
  BiggiReserveTreasuryReader,
  BiggiReserveV4,
  BiggiSeriesRegistry,
  BiggiSupplyController,
  BiggiSupplyControllerReader,
  BiggiSupplyGuardian,
  BiggiSupplyGuardianReader,
  BiggiSystemReader,
  BiggiTicketHub,
  BiggiToken,
  BiggiTokenomicsSystemAddonReader,
  BiggiTokenomikReader,
  BiggiTokenRewards,
  BiggiTokenRewardsReader,
  BiggiTreasury,
  BiggiVrfRouter,
  BiggiVRFRouter,
  BiggiUpkeeperProxy,
  ModeratorCenter,
  Multicall2,
  UniswapV2Factory,
  UniswapV2Pair,
  UniswapV2Router02,
  WETH9,
};
