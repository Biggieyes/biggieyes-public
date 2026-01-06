import { Contract } from "ethers";
import BiggiToken from '../../config/abi/BiggiToken.json';
import UniswapV2Router02 from '../../config/abi/UniswapV2Router02.json';
import UniswapV2Factory from '../../config/abi/UniswapV2Factory.json';
import UniswapV2Pair from '../../config/abi/UniswapV2Pair.json';
import BiggiLpPriceFeed from '../../config/abi/BiggiLpPriceFeed.json';
import defaultProvider from "../provider";
import { getTokenDexAddresses } from "../../config/addresses";

export function getTokenDexContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const {
    biggiToken,
    router,
    factory,
    weth,
    pairAddress,
    lpPriceFeed,
    reserve,
    liquidityVault,
    treasury,
  } = getTokenDexAddresses(chainId);

  const tokenContract = new Contract(biggiToken, BiggiToken, signerOrProvider);
  const routerContract = new Contract(router, UniswapV2Router02, signerOrProvider);

  const factoryContract = factory ? new Contract(factory, UniswapV2Factory, signerOrProvider) : null;
  const pairContract = pairAddress ? new Contract(pairAddress, UniswapV2Pair, signerOrProvider) : null;
  const priceFeedContract = lpPriceFeed ? new Contract(lpPriceFeed, BiggiLpPriceFeed, signerOrProvider) : null;

  return {
    token: tokenContract,
    router: routerContract,
    factory: factoryContract,
    pair: pairContract,
    priceFeed: priceFeedContract,
    addrs: {
      biggiToken,
      router,
      factory,
      weth,
      pairAddress,
      lpPriceFeed,
      reserve,
      liquidityVault,
      treasury,
    },
  };
}

export default {
  getTokenDexContracts,
};
