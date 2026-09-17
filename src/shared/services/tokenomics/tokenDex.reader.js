import { Contract, ZeroAddress, parseUnits, isAddress } from "ethers";
import { getProvider } from "../../../web3/provider";
import { getTokenDexContracts } from "../../../web3/contracts/tokenDex.contracts";
import { UniswapV2Pair as ABI_UniswapV2Pair } from "@/config/abi/index.js";
import { multicallAggregate } from "@/shared/utils/multicall";
import { isRateLimitedRpcError } from "@/shared/utils/rpcErrors.js";

function optionalReadFailure(error, fallback = null) {
  if (
    !isRateLimitedRpcError(error) &&
    (error?.code === "CALL_EXCEPTION" ||
      (error?.code === "BAD_DATA" && error?.value === "0x"))
  ) {
    return fallback;
  }
  // Stop this snapshot on transport failure instead of retrying every field.
  const failure = new Error(
    "Token / DEX data could not be refreshed. Please try again shortly.",
  );
  failure.code = "TOKEN_DEX_READ_FAILED";
  throw failure;
}

function hasFn(iface, name) {
  if (!iface || !name) return false;
  try {
    return iface.getFunction(name) != null;
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
  const decoded = await multicallAggregate(provider, calls).catch(
    optionalReadFailure,
  );
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
    return (await method()) ?? fallback;
  } catch (error) {
    return optionalReadFailure(error, fallback);
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

  const rawDecimals =
    tokenMulti?.decimals ?? (await _callOptional(token.decimals));
  const decimals = rawDecimals == null ? null : Number(rawDecimals);
  if (
    decimals == null || !Number.isInteger(decimals) ||
    decimals < 0 || decimals > 255
  ) {
    throw new Error(
      "Token decimals are unavailable. Token / DEX data could not be refreshed.",
    );
  }
  const oneToken = parseUnits("1", decimals);
  const wethAddress = normalizeAddress(
    addrs.weth || (await _callOptional(router.WETH, null)),
  );
  const routerFactory = normalizeAddress(
    addrs.factory || (await _callOptional(router.factory, null)),
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

  if (
    pairContract &&
    [pairReserves, pairToken0, pairToken1, pairTotalSupply].some(
      (value) => value == null,
    )
  ) {
    [pairReserves, pairToken0, pairToken1, pairTotalSupply] = await Promise.all(
      [
        pairReserves ?? _callOptional(() => pairContract.getReserves(), null),
        pairToken0 ?? _callOptional(() => pairContract.token0(), null),
        pairToken1 ?? _callOptional(() => pairContract.token1(), null),
        pairTotalSupply ?? _callOptional(() => pairContract.totalSupply(), null),
      ],
    );
  }

  const reserve0 = pairReserves?.reserve0 ?? pairReserves?.[0];
  const reserve1 = pairReserves?.reserve1 ?? pairReserves?.[1];
  const tokens = [pairToken0?.toLowerCase(), pairToken1?.toLowerCase()];
  const matchesPath =
    tokens.includes(tokenAddress.toLowerCase()) &&
    wethAddress && tokens.includes(wethAddress.toLowerCase());
  let quoteStatus = "unavailable";
  let routerAmountsOut = null;
  if (
    pairContract && reserve0 != null && reserve1 != null &&
    pairToken0 && pairToken1
  ) {
    if (!matchesPath) {
      quoteStatus = "pair_mismatch";
    } else if (BigInt(reserve0) === 0n || BigInt(reserve1) === 0n) {
      quoteStatus = "no_liquidity";
    } else {
      routerAmountsOut = await _callOptional(() =>
        router.getAmountsOut(oneToken, [tokenAddress, wethAddress]),
      );
      quoteStatus = routerAmountsOut == null ? "unavailable" : "ready";
    }
  }

  const priceFeedRound = priceFeed
    ? await _callOptional(priceFeed.latestRoundData)
    : null;
  const priceFeedReserves = priceFeed
    ? await _callOptional(priceFeed.readReserves)
    : null;
  const priceFeedPair = priceFeed
    ? await _callOptional(priceFeed.pair)
    : null;
  const priceFeedDecimals = priceFeed
    ? await _callOptional(priceFeed.decimals, null)
    : null;

  const name = tokenMulti?.name ?? (await _callOptional(token.name, null));
  const symbol =
    tokenMulti?.symbol ?? (await _callOptional(token.symbol, null));
  const totalSupply =
    tokenMulti?.totalSupply ??
    (await _callOptional(token.totalSupply, null));
  const cap = tokenMulti?.CAP ?? (await _callOptional(token.CAP, null));
  const remainingMintable =
    tokenMulti?.remainingMintable ??
    (await _callOptional(token.remainingMintable, null));
  const reserveAddress =
    tokenMulti?.reserveAddr ??
    (await _callOptional(token.reserveAddr, null));
  const DRIPDistributorAddress =
    tokenMulti?.dripDistributorAddr ??
    (await _callOptional(token.dripDistributorAddr, null));
  const tokenREWARDSAddress =
    tokenMulti?.tokenRewardsAddr ??
    (await _callOptional(token.tokenRewardsAddr, null));
  const REWARDSOperator =
    tokenMulti?.rewardsOperator ??
    (await _callOptional(token.rewardsOperator, null));

  const normalizedReserveAddress = normalizeAddress(reserveAddress);
  const normalizedDRIPDistributorAddress =
    normalizeAddress(DRIPDistributorAddress);
  const normalizedTokenRewardsAddress =
    normalizeAddress(tokenREWARDSAddress);
  const effectiveReserveAddress = normalizedReserveAddress || reserveAddr;

  const [
    reserveBalance,
    vaultBalance,
    treasuryBalance,
    DRIPDistributorBalance,
    REWARDSBalance,
  ] = await Promise.all([
    effectiveReserveAddress
      ? _callOptional(() => token.balanceOf(effectiveReserveAddress), null)
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
      quoteStatus,
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
            address: priceFeed.target ?? priceFeed.address,
            latestRoundData: priceFeedRound,
            reserves: priceFeedReserves,
            pair: priceFeedPair,
            decimals: priceFeedDecimals,
          }
        : null,
    },
    addresses: {
      ...addrs,
      reserve: effectiveReserveAddress || addrs.reserve,
    },
  };
}
