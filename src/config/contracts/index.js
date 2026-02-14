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

  BIGGI: { addressKey: "BIGGI", abiName: "BiggiToken" },
  DISTRIBUTOR: { addressKey: "DISTRIBUTOR", abiName: "BiggiMultiCollectionDistributor" },

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
  COMMUNITY_CENTER: { addressKey: "COMMUNITY_CENTER", abiName: "BiggiCommunityCenter" },
  MODERATOR_CENTER: { addressKey: "BIGGI_MODERATOR_CENTER", abiName: "ModeratorCenter" },

  VRF_ROUTER: { addressKey: "VRF_ROUTER", abiName: "BiggiVRFRouter" },

  DRIP_DISTRIBUTOR: { addressKey: "DRIP_DISTRIBUTOR", abiName: "BiggiDRIPDistributor" },
  DRIP_LM: { addressKey: "DRIP_LM", abiName: "BiggiDRIPLM" },

  LM: { addressKey: "LM", abiName: "BiggiLiquidityManager" },
  LIQUIDITY_ORCHESTRATOR: { addressKey: "LIQUIDITY_ORCHESTRATOR", abiName: "BiggiLiquidityOrchestrator" },
  LIQUIDITY_SETUP: { addressKey: "LIQUIDITY_SETUP", abiName: "LiquiditySetup" },
  LIQUIDITY_VAULT: { addressKey: "LIQUIDITY_VAULT", abiName: "LiquidityVault" },
  KEEPER_PROXY: { addressKey: "KEEPER_PROXY", abiName: "LiquidityKeeperProxy" },
  DRIP_KEEPER_PROXY: { addressKey: "DRIP_KEEPER_PROXY", abiName: "BiggiDRIPKeeper" },

  LIQ_HELPER_READER: { addressKey: "LIQ_HELPER_READER", abiName: "BiggiLiquidityHelperReader" },
  LIQ_BRANCH_USER_READER: { addressKey: "LIQUIDITY_BRANCH_USER_READER", abiName: "BiggiLiquidityBranchUserReader" },
  RESERVE_TREASURY_READER: { addressKey: "RESERVE_TREASURY_READER", abiName: "BiggiReserveTreasuryReader" },

  BUYBACK_READER: { addressKey: "BUYBACK_READER", abiName: "BiggiBuybackReader" },
  MAIN_READER: { addressKey: "MAIN_READER", abiName: "BiggiMainReader" },

  LP_PRICE_FEED: { addressKey: "LP_PRICE_FEED", abiName: "BiggiLpPriceFeed" },
  WETH: { addressKey: "WETH", abiName: "WETH9" },
  FACTORY: { addressKey: "FACTORY", abiName: "UniswapV2Factory" },
  ROUTER: { addressKey: "ROUTER", abiName: "UniswapV2Router02" },
  PAIR: { addressKey: "PAIR", abiName: "UniswapV2Pair" },
};

export function getContractMeta(chainKeyOrId, key) {
  const name = String(key || "").toUpperCase();
  const entry = CONTRACTS[name];
  if (!entry) {
    throw new Error(`Unknown contract key: ${key}`);
  }

  const chainKey = resolveChainKey(chainKeyOrId);
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
