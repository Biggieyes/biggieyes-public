import { Contract, ZeroAddress, parseUnits, isAddress } from "ethers";
import { getProvider } from "../../../web3/provider";
import { getTokenDexContracts } from "../../../web3/contracts/tokenDex.contracts";
import { UniswapV2Pair as ABI_UniswapV2Pair } from "@/config/abi/index.js";
import { multicallAggregate } from "@/shared/utils/multicall";

function hasFn(iface, name) {
  if (!iface || !name) return false;
  try {
    iface.getFunction(name);
    return true;
  } catch {
    return false;
  }
}

function unwrapDecoded(decoded) {
  if (!decoded) return decoded;
  if (Array.isArray(decoded) && decoded.length === 1) return decoded[0];
  return decoded;
}

async function multicallRead(provider, target, iface, methods = []) {
  if (!provider || !target || !iface) return null;
  const entries = methods.filter((m) => hasFn(iface, m.method));
  if (!entries.length) return null;
  const calls = entries.map((m) => ({
    target,
    iface,
    method: m.method,
    params: m.params || [],
  }));
  const decoded = await multicallAggregate(provider, calls).catch(() => null);
  if (!decoded) return null;
  const out = {};
  entries.forEach((m, idx) => {
    out[m.key] = unwrapDecoded(decoded[idx]);
  });
  return out;
}

async function _callOptional(method, fallback = null) {
  if (typeof method !== "function") return fallback;
  try {
    return await method();
  } catch (error) {
    console.warn("TokenDex snapshot helper call failed", method?.name, error);
    return fallback;
  }
}

function normalizeAddress(value, { allowZero = false } = {}) {
  if (!value) return null;
  if (!isAddress(value)) return null;
  if (!allowZero && value === ZeroAddress) return null;
  return value;
}

export async function fetchTokenDexSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const readProvider = signerOrProvider?.provider || signerOrProvider;
  const {
    token,
    router,
    factory,
    pair: configuredPair,
    priceFeed,
    addrs,
  } = getTokenDexContracts(chainId, signerOrProvider);

  const tokenAddress = token?.target ?? token?.address ?? null;
  const routerAddress = router?.target ?? router?.address ?? null;

  if (!token || !router || !tokenAddress || !routerAddress) {
    console.warn(
      "TokenDex snapshot skipped: missing token/router contract",
      { token: tokenAddress, router: routerAddress },
    );
    return null;
  }

  const reserveAddr = normalizeAddress(addrs.reserve);
  const vaultAddr = normalizeAddress(addrs.liquidityVault);
  const treasuryAddr = normalizeAddress(addrs.treasury);

  const tokenMulti = token
    ? await multicallRead(readProvider, tokenAddress, token.interface, [
        { key: "name", method: "name" },
        { key: "symbol", method: "symbol" },
        { key: "decimals", method: "decimals" },
        { key: "totalSupply", method: "totalSupply" },
        { key: "CAP", method: "CAP" },
        { key: "remainingMintable", method: "remainingMintable" },
        { key: "reserveAddr", method: "reserveAddr" },
        { key: "dripDistributorAddr", method: "dripDistributorAddr" },
        { key: "tokenRewardsAddr", method: "tokenRewardsAddr" },
        { key: "rewardsOperator", method: "rewardsOperator" },
      ])
    : null;

  const decimals =
    Number(tokenMulti?.decimals) ||
    (await _callOptional(() => token.decimals(), 18)) ||
    18;
  const oneToken = parseUnits("1", decimals);
  const wethAddress = normalizeAddress(
    addrs.weth || (await _callOptional(() => router.WETH(), null)),
  );
  const routerFactory = normalizeAddress(
    addrs.factory || (await _callOptional(() => router.factory(), null)),
  );
  const routerAmountsOut = await _callOptional(
    () =>
      wethAddress
        ? router.getAmountsOut(oneToken, [tokenAddress, wethAddress])
        : null,
    null,
  );

  let pairContract = configuredPair;
  let resolvedPairAddress = normalizeAddress(addrs.pairAddress);
  if (!pairContract && factory && wethAddress) {
    const remotePairAddress = normalizeAddress(
      await _callOptional(
        () => factory.getPair(tokenAddress, wethAddress),
        null,
      ),
    );
    if (remotePairAddress) {
      resolvedPairAddress = remotePairAddress;
      pairContract = new Contract(
        remotePairAddress,
        ABI_UniswapV2Pair,
        signerOrProvider,
      );
    }
  }

  let pairReserves = null;
  let pairToken0 = null;
  let pairToken1 = null;
  let pairTotalSupply = null;
  if (pairContract) {
    const pairMulti = await multicallRead(
      readProvider,
      pairContract.target ?? pairContract.address,
      pairContract.interface,
      [
        { key: "getReserves", method: "getReserves" },
        { key: "token0", method: "token0" },
        { key: "token1", method: "token1" },
        { key: "totalSupply", method: "totalSupply" },
      ],
    );
    pairReserves = pairMulti?.getReserves ?? null;
    pairToken0 = pairMulti?.token0 ?? null;
    pairToken1 = pairMulti?.token1 ?? null;
    pairTotalSupply = pairMulti?.totalSupply ?? null;
  }

  if (pairContract && !pairReserves) {
    [pairReserves, pairToken0, pairToken1, pairTotalSupply] = await Promise.all(
      [
        _callOptional(() => pairContract.getReserves(), null),
        _callOptional(() => pairContract.token0(), null),
        _callOptional(() => pairContract.token1(), null),
        _callOptional(() => pairContract.totalSupply(), null),
      ],
    );
  }

  const priceFeedRound = priceFeed
    ? await _callOptional(() => priceFeed.latestRoundData())
    : null;
  const priceFeedReserves = priceFeed
    ? await _callOptional(() => priceFeed.readReserves())
    : null;
  const priceFeedPair = priceFeed
    ? await _callOptional(() => priceFeed.pair())
    : null;
  const priceFeedDecimals = priceFeed
    ? await _callOptional(() => priceFeed.decimals(), null)
    : null;

  const name = tokenMulti?.name ?? (await _callOptional(() => token.name(), null));
  const symbol =
    tokenMulti?.symbol ?? (await _callOptional(() => token.symbol(), null));
  const totalSupply =
    tokenMulti?.totalSupply ??
    (await _callOptional(() => token.totalSupply(), null));
  const cap = tokenMulti?.CAP ?? (await _callOptional(() => token.CAP(), null));
  const remainingMintable =
    tokenMulti?.remainingMintable ??
    (await _callOptional(() => token.remainingMintable(), null));
  const reserveAddress =
    tokenMulti?.reserveAddr ??
    (await _callOptional(() => token.reserveAddr(), null));
  const DRIPDistributorAddress =
    tokenMulti?.dripDistributorAddr ??
    (await _callOptional(() => token.dripDistributorAddr(), null));
  const tokenREWARDSAddress =
    tokenMulti?.tokenRewardsAddr ??
    (await _callOptional(() => token.tokenRewardsAddr(), null));
  const REWARDSOperator =
    tokenMulti?.rewardsOperator ??
    (await _callOptional(() => token.rewardsOperator(), null));

  const normalizedReserveAddress = normalizeAddress(reserveAddress);
  const normalizedDRIPDistributorAddress =
    normalizeAddress(DRIPDistributorAddress);
  const normalizedTokenRewardsAddress =
    normalizeAddress(tokenREWARDSAddress);

  const [
    reserveBalance,
    vaultBalance,
    treasuryBalance,
    DRIPDistributorBalance,
    REWARDSBalance,
  ] = await Promise.all([
    reserveAddr
      ? _callOptional(() => token.balanceOf(reserveAddr), null)
      : null,
    vaultAddr
      ? _callOptional(() => token.balanceOf(vaultAddr), null)
      : null,
    treasuryAddr
      ? _callOptional(() => token.balanceOf(treasuryAddr), null)
      : null,
    normalizedDRIPDistributorAddress
      ? _callOptional(
          () => token.balanceOf(normalizedDRIPDistributorAddress),
          null,
        )
      : null,
    normalizedTokenRewardsAddress
      ? _callOptional(
          () => token.balanceOf(normalizedTokenRewardsAddress),
          null,
        )
      : null,
  ]);

  return {
    ts: Date.now(),
    token: {
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply,
      cap,
      remainingMintable,
      reserveAddress: normalizedReserveAddress,
      DRIPDistributorAddress: normalizedDRIPDistributorAddress,
      tokenREWARDSAddress: normalizedTokenRewardsAddress,
      REWARDSOperator,
      balances: {
        reserve: reserveBalance,
        liquidityVault: vaultBalance,
        treasury: treasuryBalance,
        DRIPDistributor: DRIPDistributorBalance,
        tokenREWARDS: REWARDSBalance,
      },
    },
    dex: {
      router: routerAddress,
      routerFactory,
      weth: wethAddress,
      path: [tokenAddress, wethAddress].filter(Boolean),
      routerAmountsOut,
      routerNativeOut: routerAmountsOut?.[1] ?? null,
      pairAddress: resolvedPairAddress,
      pair: pairContract
        ? {
            address: pairContract.target ?? pairContract.address,
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
