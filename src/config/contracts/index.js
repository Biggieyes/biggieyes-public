// Canonical contracts registry (single source of truth for ABI + address key mapping)
import * as ABI from "../abi/index.js";
import { getAddresses, resolveChainKey } from "../addresses/index.js";

/**
 * CONTRACTS:
 *  - key: stable name used by the app
 *  - addressKey: key expected inside addresses mapping
 *  - abiName: named export from src/config/abi/index.js
 */
export const CONTRACTS = {
  MAIN: { addressKey: "MAIN", abiName: "BiggiMain" },
  MAIN2: { addressKey: "MAIN2", abiName: "BiggiMain2" },
  COLLECTION_VRF: { addressKey: "COLLECTION_VRF", abiName: "BiggiMain" },
  COLLECTION_PUBLIC: { addressKey: "COLLECTION_PUBLIC", abiName: "BiggiMain2" },
  TICKET_HUB: { addressKey: "TICKET_HUB", abiName: "BiggiTicketHub" },
  SERIES_REGISTRY: { addressKey: "SERIES_REGISTRY", abiName: "BiggiSeriesRegistry" },
  REGISTRY: { addressKey: "REGISTRY", abiName: "BiggiSeriesRegistry" },
  CHAPTER_CONTROLLER: { addressKey: "CHAPTER_CONTROLLER", abiName: "BiggiChapterController" },
  CHAPTER_1_MAIN: { addressKey: "CHAPTER_1_MAIN", abiName: "BiggiMain" },
  CHAPTER_1_MAIN2: { addressKey: "CHAPTER_1_MAIN2", abiName: "BiggiMain2" },
  CHAPTER_2_MAIN: { addressKey: "CHAPTER_2_MAIN", abiName: "BiggiMain" },
  CHAPTER_2_MAIN2: { addressKey: "CHAPTER_2_MAIN2", abiName: "BiggiMain2" },
  CHAPTER_3_MAIN: { addressKey: "CHAPTER_3_MAIN", abiName: "BiggiMain" },
  CHAPTER_3_MAIN2: { addressKey: "CHAPTER_3_MAIN2", abiName: "BiggiMain2" },
  CHAPTER_4_MAIN: { addressKey: "CHAPTER_4_MAIN", abiName: "BiggiMain" },
  CHAPTER_4_MAIN2: { addressKey: "CHAPTER_4_MAIN2", abiName: "BiggiMain2" },
  CHAPTER_5_MAIN: { addressKey: "CHAPTER_5_MAIN", abiName: "BiggiMain" },
  CHAPTER_5_MAIN2: { addressKey: "CHAPTER_5_MAIN2", abiName: "BiggiMain2" },

  BIGGI: { addressKey: "BIGGI", abiName: "BiggiToken" },
  BIGGI_TOKEN: { addressKey: "BIGGI_TOKEN", abiName: "BiggiToken" },
  DISTRIBUTOR: { addressKey: "DISTRIBUTOR", abiName: "BiggiMultiCollectionDistributor" },
  MULTI_COLLECTION_DISTRIBUTOR: { addressKey: "MULTI_COLLECTION_DISTRIBUTOR", abiName: "BiggiMultiCollectionDistributor" },
  MULTI_COLLECTION_DISTRIBUTOR_READER: { addressKey: "MULTI_COLLECTION_DISTRIBUTOR_READER", abiName: "BiggiMultiCollectionDistributorReaderV2" },
  MULTI_COLLECTION_READER: { addressKey: "MULTI_COLLECTION_READER", abiName: "BiggiMultiCollectionDistributorReaderV2" },
  MCD_READER_V2: { addressKey: "MCD_READER_V2", abiName: "BiggiMultiCollectionDistributorReaderV2" },

  RESERVE: { addressKey: "RESERVE", abiName: "BiggiReserveV4" },
  TREASURY: { addressKey: "TREASURY", abiName: "BiggiTreasury" },
  BUYBACK_AGENT: { addressKey: "BUYBACK_AGENT", abiName: "BiggiBuybackAgent" },
  BUYBACK_DRIP_SETUP: { addressKey: "BIGGIBUYBACKDRIPSETUP", abiName: "BiggiBuybackDripSetup" },
  POLICY: { addressKey: "POLICY", abiName: "BiggiPolicy" },
  MASTER_CONFIG: { addressKey: "MASTER_CONFIG", abiName: "BiggiMasterTokenomicsConfig" },
  COMPUTE: { addressKey: "COMPUTE", abiName: "BiggiCompute" },

  COLLECTION_REWARDS: { addressKey: "COLLECTION_REWARDS", abiName: "BiggiCollectionRewards" },
  TOKEN_REWARDS: { addressKey: "TOKEN_REWARDS", abiName: "BiggiTokenRewards" },
  TOKEN_REWARDS_READER: { addressKey: "TOKEN_REWARDS_READER", abiName: "BiggiTokenRewardsReader" },
  NFT_REWARDS: { addressKey: "NFT_REWARDS", abiName: "BiggiNftRewards" },
  NFT_REWARDS_READER: { addressKey: "NFT_REWARDS_READER", abiName: "BiggiNftRewardsReader" },
  COLLECTION_REWARDS_READER: { addressKey: "COLLECTION_REWARDS_READER", abiName: "BiggiMultiCollectionDistributorReaderV2" },
  BIGGI_REWARDS_READER: { addressKey: "BIGGI_REWARDS_READER", abiName: "BiggiMultiCollectionDistributorReaderV2" },
  COMMUNITY_CENTER: { addressKey: "COMMUNITY_CENTER", abiName: "BiggiCommunityCenter" },
  MODERATOR_CENTER: { addressKey: "MODERATOR_CENTER", abiName: "ModeratorCenter" },

  VRF_ROUTER: { addressKey: "VRF_ROUTER", abiName: "BiggiVrfRouter" },

  DRIP_DISTRIBUTOR: { addressKey: "DRIP_DISTRIBUTOR", abiName: "BiggiDripDistributor" },
  DRIP_LM: { addressKey: "DRIP_LM", abiName: "BiggiDripLMToModerator" },

  LM: { addressKey: "LM", abiName: "BiggiLiquidityManager" },
  LIQUIDITY_ORCHESTRATOR: { addressKey: "LIQUIDITY_ORCHESTRATOR", abiName: "BiggiLiquidityOrchestrator" },
  LIQUIDITY_SETUP: { addressKey: "LIQUIDITY_SETUP", abiName: "LiquiditySetup" },
  LIQUIDITY_VAULT: { addressKey: "LIQUIDITY_VAULT", abiName: "LiquidityVault" },
  KEEPER_PROXY: { addressKey: "KEEPER_PROXY", abiName: "LiquidityKeeperProxy" },
  LIQUIDITY_KEEPER_PROXY: { addressKey: "LIQUIDITY_KEEPER_PROXY", abiName: "LiquidityKeeperProxy" },
  DRIP_KEEPER_PROXY: { addressKey: "DRIP_KEEPER_PROXY", abiName: "DripKeeperProxy" },
  BUYBACK_UPKEEP_PROXY: { addressKey: "BUYBACK_UPKEEP_PROXY", abiName: "BiggiBuybackUpkeepProxy" },

  LIQ_HELPER_READER: { addressKey: "LIQ_HELPER_READER", abiName: "BiggiLiquidityHelperReader" },
  LIQUIDITY_HELPER_READER: { addressKey: "LIQUIDITY_HELPER_READER", abiName: "BiggiLiquidityHelperReader" },
  LIQ_BRANCH_USER_READER: { addressKey: "LIQUIDITY_BRANCH_USER_READER", abiName: "BiggiLiquidityBranchUserReader" },
  LIQUIDITY_BRANCH_READER: { addressKey: "LIQUIDITY_BRANCH_READER", abiName: "BiggiLiquidityBranchUserReader" },
  RESERVE_TREASURY_READER: { addressKey: "RESERVE_TREASURY_READER", abiName: "BiggiReserveTreasuryReader" },
  RESERVE_READER: { addressKey: "RESERVE_READER", abiName: "BiggiReserveTreasuryReader" },
  TREASURY_READER: { addressKey: "TREASURY_READER", abiName: "BiggiReserveTreasuryReader" },

  BUYBACK_READER: { addressKey: "BUYBACK_READER", abiName: "BiggiBuybackReader" },
  MAIN_READER: { addressKey: "MAIN_READER", abiName: "BiggiMainReader" },
  CHAPTER_SERIES_READER: { addressKey: "CHAPTER_SERIES_READER", abiName: "BiggiChapterSeriesReader" },
  BIGGI_TOKENOMICS_READER: { addressKey: "BIGGI_TOKENOMICS_READER", abiName: "BiggiTokenomikReader" },
  BIGGI_TOKENOMIK_READER: { addressKey: "BIGGI_TOKENOMIK_READER", abiName: "BiggiTokenomikReader" },
  TOKENOMICS_SYSTEM_ADDON_READER: { addressKey: "TOKENOMICS_SYSTEM_ADDON_READER", abiName: "BiggiTokenomicsSystemAddonReader" },
  SYSTEM_READER: { addressKey: "SYSTEM_READER", abiName: "BiggiSystemReader" },
  TOKENOMIK_READER: { addressKey: "TOKENOMIK_READER", abiName: "BiggiTokenomikReader" },

  SUPPLY_CONTROLLER: { addressKey: "SUPPLY_CONTROLLER", abiName: "BiggiSupplyController" },
  SUPPLY_GUARDIAN: { addressKey: "SUPPLY_GUARDIAN", abiName: "BiggiSupplyGuardian" },
  DEX_RESERVE_GUARD: { addressKey: "DEX_RESERVE_GUARD", abiName: "BiggiDexReserveGuard" },
  SUPPLY_CONTROLLER_READER: { addressKey: "SUPPLY_CONTROLLER_READER", abiName: "BiggiSupplyControllerReader" },
  SUPPLY_GUARDIAN_READER: { addressKey: "SUPPLY_GUARDIAN_READER", abiName: "BiggiSupplyGuardianReader" },
  DEX_RESERVE_GUARD_READER: { addressKey: "DEX_RESERVE_GUARD_READER", abiName: "BiggiDexReserveGuardReader" },

  LP_PRICE_FEED: { addressKey: "LP_PRICE_FEED", abiName: "BiggiLpPriceFeed" },
  WETH: { addressKey: "WETH", abiName: "WETH9" },
  WPOL: { addressKey: "WPOL", abiName: "WETH9" },
  QUOTE_TOKEN: { addressKey: "QUOTE_TOKEN", abiName: "WETH9" },
  FACTORY: { addressKey: "FACTORY", abiName: "UniswapV2Factory" },
  ROUTER: { addressKey: "ROUTER", abiName: "UniswapV2Router02" },
  BUYBACK_ROUTER: { addressKey: "BUYBACK_ROUTER", abiName: "UniswapV2Router02" },
  PAIR: { addressKey: "PAIR", abiName: "UniswapV2Pair" },
  MULTICALL: { addressKey: "MULTICALL", abiName: "Multicall2" },
  MULTICALL2: { addressKey: "MULTICALL2", abiName: "Multicall2" },
};

export function getContractMeta(chainKeyOrId, key) {
  const name = String(key || "").toUpperCase();
  const entry = CONTRACTS[name];
  if (!entry) {
    throw new Error(`Unknown contract key: ${key}`);
  }

  const chainKey = resolveChainKey(chainKeyOrId);
  if (!chainKey) {
    throw new Error(`Unsupported chain: ${chainKeyOrId}. BIGGI supports Polygon mainnet (137) only.`);
  }
  const addresses = getAddresses(chainKey);

  const address = addresses?.[entry.addressKey];
  if (!address) {
    throw new Error(`Missing address for ${name} (${entry.addressKey}) on chain '${chainKey}'`);
  }

  const abi = ABI?.[entry.abiName];
  if (!abi) {
    throw new Error(`Missing ABI export '${entry.abiName}' for contract '${name}'`);
  }

  return {
    chainKey,
    key: name,
    addressKey: entry.addressKey,
    abiName: entry.abiName,
    address,
    abi,
  };
}

export { ABI };
