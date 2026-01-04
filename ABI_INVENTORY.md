# ABI Inventory

Generated: 2026-01-04 13:42:18

## Canonical ABIs (src/utils/abi/index.js)
- ABI_BUYBACK -> ./BiggiBuybackAgent.json
  - used in: src/utils/contract.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_COLLECTION_READER -> ./BiggiCollectionReader.json
  - used in: (no direct usage found)
- ABI_COLLECTION_REWARDS -> ./BiggiCollectionRewards.json
  - used in: src/services/collectionRewardsService.js
  - used in: src/utils/contract.js
- ABI_DISTRIBUTOR -> ./BiggiDistributor.json
  - used in: src/utils/contract.js
- ABI_DRIPLM -> ./BiggiDripLM.json
  - used in: src/utils/contract.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_DRIP_DISTRIBUTOR -> ./BiggiDripDistributor.json
  - used in: src/utils/contract.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_DRIP_KEEPER -> ./BiggiDripKeeper.json
  - used in: src/utils/contract.js
- ABI_FACTORY -> ./uniswapFactory.js
  - used in: src/utils/contract.js
  - used in: src/utils/abi/uniswapFactory.js
- ABI_LIQUIDITY_AUTOMATION -> ./LiquidityAutomation.json
  - used in: src/utils/contract.js
- ABI_LIQUIDITY_KEEPER -> ./LiquidityKeeper.json
  - used in: src/hooks/useLiquidityKeeper.js
- ABI_LIQUIDITY_VAULT -> ./LiquidityVault.json
  - used in: src/services/liquidityVaultService.js
  - used in: src/utils/contract.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_LM -> ./LiquidityManager.json
  - used in: src/utils/contract.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_MAIN -> ./BiggiMain.json
  - used in: src/utils/contract.js
- ABI_MAIN2 -> ./BiggiMain2.json
  - used in: src/utils/contract.js
- ABI_MASTER_CONFIG -> ./BiggiMasterTokenomicsConfig.json
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_NFTREWARDS -> ./BiggiNFTRewards.json
  - used in: src/utils/contract.js
- ABI_PAIR -> ./uniswapPair.js
  - used in: src/utils/contract.js
  - used in: src/utils/abi/uniswapPair.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_POLICY -> ./BiggiPolicy.json
  - used in: src/utils/contract.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_RESERVE -> ./BiggiReserve.json
  - used in: src/AppCore.jsx
  - used in: src/utils/contract.js
  - used in: src/utils/tokenRefreshers.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_REWARDS_READER -> ./BiggiRewardsReader.json
  - used in: (no direct usage found)
- ABI_ROUTER -> ./uniswapRouter.js
  - used in: src/utils/contract.js
  - used in: src/utils/abi/uniswapRouter.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_TOKEN -> ./BiggiToken.json
  - used in: src/AppCore.jsx
  - used in: src/utils/contract.js
  - used in: src/utils/tokenMeta.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_TOKENOMIC_READER -> ./BiggiTokenomicReader.json
  - used in: (no direct usage found)
- ABI_TOKEN_REWARDS -> ./BiggiTokenRewards.json
  - used in: src/utils/contract.js
- ABI_TREASURY -> ./BiggiTreasury.json
  - used in: src/utils/contract.js
- ABI_UPKEEP -> ./upkeepProxy.js
  - used in: src/utils/contract.js
  - used in: src/utils/abi/upkeepProxy.js
  - used in: src/components/TOKEN/BiggiToken.jsx
- ABI_VRF -> ./vrfRouter.js
  - used in: src/utils/contract.js
  - used in: src/utils/abi/vrfRouter.js

## Config ABIs (src/config/abi)
- BiggiBuybackAgent.json
  - used in: src/web3/contracts/buybackTreasury.contracts.js
- BiggiLiquidityManager.json
  - used in: src/web3/contracts/liquidity.contracts.js
- BiggiLpPriceFeed.json
  - used in: src/web3/contracts/tokenDex.contracts.js
- BiggiReserveV4.json
  - used in: src/web3/contracts/liquidity.contracts.js
- BiggiToken.json
  - used in: src/web3/contracts/buybackTreasury.contracts.js
  - used in: src/web3/contracts/tokenDex.contracts.js
- BiggiTreasury.json
  - used in: src/web3/contracts/buybackTreasury.contracts.js
- DripDistributor.json
  - used in: src/web3/contracts/drip.contracts.js
- DripLM.json
  - used in: src/web3/contracts/drip.contracts.js
- LiquidityVault.json
  - used in: src/web3/contracts/liquidity.contracts.js
- UniswapV2Factory.json
  - used in: src/web3/contracts/tokenDex.contracts.js
- UniswapV2Pair.json
  - used in: src/web3/contracts/tokenDex.contracts.js
  - used in: src/services/tokenomics/tokenDex.reader.js
- UniswapV2Router02.json
  - used in: src/web3/contracts/tokenDex.contracts.js

## Direct imports bypassing index (utils/abi/*, excluding index.js)
- src/components/admin/AdminPanel.jsx -> BiggiCommunityCenter.js
- src/components/panels/CommunityCenterPanel.jsx -> BiggiCommunityCenter.js
- src/services/tokenRewardsService.js -> BiggiTokenRewards.json
- src/services/treasuryService.js -> BiggiTreasury.json
- src/web3/contracts/drip.contracts.js -> BiggiToken.json

## Inline ABI definitions (outside src/utils/abi)
- src/AppCore.jsx -> ABI_RESERVE
- src/utils/tokenRefreshers.js -> ABI_RESERVE

## Minimal ABI arrays (selected)
- src/components/LiveStats.jsx -> TOKEN_REWARDS_MIN_ABI
- src/components/LiveStats.jsx -> erc20Abi
- src/components/LiveStats.jsx -> oracleAbi
- src/services/tokenomics/liquidity.reader.js -> LP_BALANCE_ABI

## Potentially unused ABI files in src/utils/abi (no usage found)
- src/utils/abi/BiggiCollectionReader.json
- src/utils/abi/BiggiRewardsReader.json
- src/utils/abi/BiggiTokenomicReader.json
- src/utils/abi/index.js

