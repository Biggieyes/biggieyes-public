import { Contract, ZeroAddress, isAddress } from "ethers";
import {
  BiggiToken as ABI_BiggiToken,
  UniswapV2Router02 as ABI_UniswapV2Router02,
  UniswapV2Factory as ABI_UniswapV2Factory,
  UniswapV2Pair as ABI_UniswapV2Pair,
  BiggiLpPriceFeed as ABI_BiggiLpPriceFeed,
} from "@/config/abi/index.js";
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

  const validAddr = (addr) =>
    typeof addr === "string" && isAddress(addr) && addr !== ZeroAddress;

  const tokenContract = validAddr(biggiToken)
    ? new Contract(biggiToken, ABI_BiggiToken, signerOrProvider)
    : null;
  const routerContract = validAddr(router)
    ? new Contract(router, ABI_UniswapV2Router02, signerOrProvider)
    : null;

  const factoryContract = validAddr(factory)
    ? new Contract(factory, ABI_UniswapV2Factory, signerOrProvider)
    : null;
  const pairContract = validAddr(pairAddress)
    ? new Contract(pairAddress, ABI_UniswapV2Pair, signerOrProvider)
    : null;
  const priceFeedContract = validAddr(lpPriceFeed)
    ? new Contract(lpPriceFeed, ABI_BiggiLpPriceFeed, signerOrProvider)
    : null;

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
