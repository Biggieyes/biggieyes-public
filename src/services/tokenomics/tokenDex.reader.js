import { Contract, ethers } from "ethers";
import { getProvider } from "../../web3/provider";
import { getTokenDexContracts } from "../../web3/contracts/tokenDex.contracts";
import UniswapV2Pair from '../../config/abi/UniswapV2Pair.json';

async function _callOptional(method, fallback = null) {
  if (typeof method !== "function") return fallback;
  try {
    return await method();
  } catch (error) {
    console.warn("TokenDex snapshot helper call failed", method?.name, error);
    return fallback;
  }
}

export async function fetchTokenDexSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { token, router, factory, pair: configuredPair, priceFeed, addrs } = getTokenDexContracts(chainId, signerOrProvider);

  const decimals = (await _callOptional(() => token.decimals(), 18)) || 18;
  const oneToken = ethers.utils.parseUnits("1", decimals);
  const wethAddress = addrs.weth || (await _callOptional(() => router.WETH(), null));
  const routerFactory = addrs.factory || (await _callOptional(() => router.factory(), null));
  const routerAmountsOut = await _callOptional(
    () => (wethAddress ? router.getAmountsOut(oneToken, [token.address, wethAddress]) : null),
    null,
  );

  let pairContract = configuredPair;
  let resolvedPairAddress = addrs.pairAddress || null;
  if (!pairContract && factory && wethAddress) {
    const remotePairAddress = await _callOptional(() => factory.getPair(token.address, wethAddress), null);
    if (remotePairAddress && remotePairAddress !== ethers.constants.AddressZero) {
      resolvedPairAddress = remotePairAddress;
      pairContract = new Contract(remotePairAddress, UniswapV2Pair, signerOrProvider);
    }
  }

  const [pairReserves, pairToken0, pairToken1, pairTotalSupply] = pairContract
    ? await Promise.all([
        _callOptional(() => pairContract.getReserves(), null),
        _callOptional(() => pairContract.token0(), null),
        _callOptional(() => pairContract.token1(), null),
        _callOptional(() => pairContract.totalSupply(), null),
      ])
    : [null, null, null, null];

  const priceFeedRound = priceFeed ? await _callOptional(() => priceFeed.latestRoundData()) : null;
  const priceFeedReserves = priceFeed ? await _callOptional(() => priceFeed.readReserves()) : null;
  const priceFeedPair = priceFeed ? await _callOptional(() => priceFeed.pair()) : null;
  const priceFeedDecimals = priceFeed ? await _callOptional(() => priceFeed.decimals(), null) : null;

  const [
    name,
    symbol,
    totalSupply,
    cap,
    remainingMintable,
    reserveAddress,
    dripDistributorAddress,
    tokenRewardsAddress,
    rewardsOperator,
  ] = await Promise.all([
    _callOptional(() => token.name(), null),
    _callOptional(() => token.symbol(), null),
    _callOptional(() => token.totalSupply(), null),
    _callOptional(() => token.CAP(), null),
    _callOptional(() => token.remainingMintable(), null),
    _callOptional(() => token.reserveAddr(), null),
    _callOptional(() => token.dripDistributorAddr(), null),
    _callOptional(() => token.tokenRewardsAddr(), null),
    _callOptional(() => token.rewardsOperator(), null),
  ]);

  const [
    reserveBalance,
    vaultBalance,
    treasuryBalance,
    dripDistributorBalance,
    rewardsBalance,
  ] = await Promise.all([
    addrs.reserve ? _callOptional(() => token.balanceOf(addrs.reserve), null) : null,
    addrs.liquidityVault ? _callOptional(() => token.balanceOf(addrs.liquidityVault), null) : null,
    addrs.treasury ? _callOptional(() => token.balanceOf(addrs.treasury), null) : null,
    dripDistributorAddress ? _callOptional(() => token.balanceOf(dripDistributorAddress), null) : null,
    tokenRewardsAddress ? _callOptional(() => token.balanceOf(tokenRewardsAddress), null) : null,
  ]);

  return {
    ts: Date.now(),
    token: {
      address: token.address,
      name,
      symbol,
      decimals,
      totalSupply,
      cap,
      remainingMintable,
      reserveAddress,
      dripDistributorAddress,
      tokenRewardsAddress,
      rewardsOperator,
      balances: {
        reserve: reserveBalance,
        liquidityVault: vaultBalance,
        treasury: treasuryBalance,
        dripDistributor: dripDistributorBalance,
        tokenRewards: rewardsBalance,
      },
    },
    dex: {
      router: router.address,
      routerFactory,
      weth: wethAddress,
      path: [token.address, wethAddress].filter(Boolean),
      routerAmountsOut,
      routerNativeOut: routerAmountsOut?.[1] ?? null,
      pairAddress: resolvedPairAddress,
      pair: pairContract
        ? {
            address: pairContract.address,
            token0: pairToken0,
            token1: pairToken1,
            reserves: pairReserves,
            totalSupply: pairTotalSupply,
          }
        : null,
      priceFeed: priceFeed
        ? {
            address: priceFeed.address,
            latestRoundData: priceFeedRound,
            reserves: priceFeedReserves,
            pair: priceFeedPair,
            decimals: priceFeedDecimals,
          }
        : null,
    },
    addresses: addrs,
  };
}
