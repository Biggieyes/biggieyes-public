// Aggregated ABI index — re-exports ABI definitions from JSON/JS files
// This resolves imports like `./utils/abi/index.js` used across the app.

import ABI_MAIN from './BiggiMain.json' assert { type: 'json' };
import ABI_MAIN2 from './BiggiMain2.json' assert { type: 'json' };
import { ABI_VRF } from './vrfRouter.js';
import ABI_TOKEN from './BiggiToken.json' assert { type: 'json' };
import ABI_DISTRIBUTOR from './BiggiDistributor.json' assert { type: 'json' };
import ABI_RESERVE from './BiggiReserve.json' assert { type: 'json' };
import ABI_TREASURY from './BiggiTreasury.json' assert { type: 'json' };
import ABI_BUYBACK from './BiggiBuybackAgent.json' assert { type: 'json' };
import ABI_POLICY from './BiggiPolicy.json' assert { type: 'json' };
import ABI_TOKEN_REWARDS from './BiggiTokenRewards.json' assert { type: 'json' };
import ABI_COLLECTION_REWARDS from './BiggiCollectionRewards.json' assert { type: 'json' };
import ABI_NFTREWARDS from './BiggiNFTRewards.json' assert { type: 'json' };
import ABI_REWARDS_READER from './BiggiRewardsReader.json' assert { type: 'json' };
import ABI_MASTER_CONFIG from './BiggiMasterTokenomicsConfig.json' assert { type: 'json' };
import ABI_LIQUIDITY_AUTOMATION from './LiquidityAutomation.json' assert { type: 'json' };
import ABI_LIQUIDITY_KEEPER from './LiquidityKeeper.json' assert { type: 'json' };
import ABI_DRIP_DISTRIBUTOR from './BiggiDripDistributor.json' assert { type: 'json' };
import ABI_DRIP_KEEPER from './BiggiDripKeeper.json' assert { type: 'json' };
import ABI_DRIPLM from './BiggiDripLM.json' assert { type: 'json' };
import ABI_LM from './LiquidityManager.json' assert { type: 'json' };
import ABI_LIQUIDITY_VAULT from './LiquidityVault.json' assert { type: 'json' };
import ABI_TOKENOMIC_READER from './BiggiTokenomicReader.json' assert { type: 'json' };
import ABI_COLLECTION_READER from './BiggiCollectionReader.json' assert { type: 'json' };

// JS helper ABIs
import { ABI_FACTORY } from './uniswapFactory.js';
import { ABI_ROUTER } from './uniswapRouter.js';
import ABI_PAIR from './uniswapPair.js';
import { ABI_UPKEEP } from './upkeepProxy.js';

// Generic reader fallback (collection reader takes priority)
const ABI_READER = (Array.isArray(ABI_COLLECTION_READER) && ABI_COLLECTION_READER.length
  ? ABI_COLLECTION_READER
  : ABI_MAIN) || [];

// Reader / alias mappings (sensible defaults)
// BiggiMainReader points to the on-chain CollectionReader (snapshot helper), not the Main NFT contract.
const ABI_BiggiMainReader = ABI_READER;
const ABI_BiggiRewardsReader = (Array.isArray(ABI_REWARDS_READER) && ABI_REWARDS_READER.length
  ? ABI_REWARDS_READER
  : (ABI_COLLECTION_REWARDS || ABI_NFTREWARDS || [])) || [];
const ABI_BiggiTokenomicsReader = ABI_TOKENOMIC_READER || [];
const ABI_BiggiTokenReader = ABI_TOKEN || [];
const ABI_NFTRewardsReader = ABI_NFTREWARDS || [];
const ABI_CollectionRewardsReader = ABI_COLLECTION_REWARDS || [];
const ABI_ReserveReader = ABI_RESERVE || [];
const ABI_BuybackReader = ABI_BUYBACK || [];
const ABI_LiquidityManagerReader = ABI_LM || [];
const ABI_COLLECTION_VRF = ABI_MAIN || [];
const ABI_COLLECTION_PUBLIC = ABI_MAIN2 || [];

// Export canonical names expected by the rest of the codebase
export {
  ABI_MAIN,
  ABI_MAIN2,
  ABI_VRF,
  ABI_TOKEN,
  ABI_DISTRIBUTOR,
  ABI_RESERVE,
  ABI_TREASURY,
  ABI_BUYBACK,
  ABI_POLICY,
  ABI_TOKEN_REWARDS,
  ABI_COLLECTION_REWARDS,
  ABI_NFTREWARDS,
  ABI_REWARDS_READER,
  ABI_MASTER_CONFIG,
  ABI_LIQUIDITY_AUTOMATION,
  ABI_LIQUIDITY_KEEPER,
  ABI_DRIP_DISTRIBUTOR,
  ABI_DRIP_KEEPER,
  ABI_DRIPLM,
  ABI_LM,
  ABI_LIQUIDITY_VAULT,

  // uniswap helpers
  ABI_FACTORY,
  ABI_ROUTER,
  ABI_PAIR,
  ABI_UPKEEP,

  // generic reader
  ABI_READER,

  // reader aliases
  ABI_BiggiMainReader,
  ABI_BiggiRewardsReader,
  ABI_BiggiTokenomicsReader,
  ABI_BiggiTokenReader,
  ABI_NFTRewardsReader,
  ABI_CollectionRewardsReader,
  ABI_ReserveReader,
  ABI_BuybackReader,
  ABI_LiquidityManagerReader,
  ABI_COLLECTION_VRF,
  ABI_COLLECTION_PUBLIC,
};

// default export (minimal)
export default {
  ABI_MAIN,
  ABI_TOKEN,
};
