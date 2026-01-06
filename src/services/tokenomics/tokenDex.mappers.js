import { ethers } from "ethers";

const DEFAULT_DECIMALS = 18;
const PLACEHOLDER = "N/A";

function _formatAmount(raw, decimals = DEFAULT_DECIMALS, options = {}) {
  if (raw == null) return { display: PLACEHOLDER, numeric: null };
  try {
    const bn = ethers.BigNumber.isBigNumber(raw) ? raw : ethers.BigNumber.from(raw);
    const formatted = ethers.utils.formatUnits(bn, decimals);
    const numeric = Number(formatted);
    const display = Number.isFinite(numeric)
      ? numeric.toLocaleString("en-US", {
          maximumFractionDigits: options.maximumFractionDigits ?? 2,
        })
      : formatted;
    return {
      display,
      numeric: Number.isFinite(numeric) ? numeric : null,
    };
  } catch (error) {
    console.warn("TokenDex mapper _formatAmount failed", error);
    return { display: PLACEHOLDER, numeric: null };
  }
}

function _shortAddress(address = "") {
  if (!address) return PLACEHOLDER;
  const normalized = String(address);
  if (normalized.length <= 10) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function _safeDivide(numerator, denominator) {
  if (typeof numerator !== "number" || typeof denominator !== "number")
    return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

function _resolvePairReserves(pair = {}, tokenAddress = "", wethAddress = "") {
  const reserves = pair?.reserves || {};
  const reserve0 = reserves.reserve0 || null;
  const reserve1 = reserves.reserve1 || null;
  const token0 = pair?.token0?.toLowerCase();
  const token1 = pair?.token1?.toLowerCase();
  const biggiAddr = tokenAddress?.toLowerCase();
  const wethAddr = wethAddress?.toLowerCase();
  let biggiRaw = null;
  let nativeRaw = null;

  if (biggiAddr && token0 === biggiAddr) biggiRaw = reserve0;
  if (biggiAddr && token1 === biggiAddr) biggiRaw = reserve1;
  if (wethAddr && token0 === wethAddr) nativeRaw = reserve0;
  if (wethAddr && token1 === wethAddr) nativeRaw = reserve1;

  if (biggiRaw == null || nativeRaw == null) {
    if (biggiRaw == null && nativeRaw == null) {
      biggiRaw = reserve0;
      nativeRaw = reserve1;
    } else if (biggiRaw == null) {
      biggiRaw = nativeRaw;
      nativeRaw = reserve1 ?? reserve0;
    } else if (nativeRaw == null) {
      nativeRaw = biggiRaw;
    }
  }

  return {
    biggiRaw,
    nativeRaw,
    blockTimestampLast: reserves.blockTimestampLast || null,
  };
}

export function mapRawSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts || Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const tokenRaw = raw.token || {};
  const dexRaw = raw.dex || {};
  const pairRaw = dexRaw.pair || {};
  const pairRes = _resolvePairReserves(pairRaw, tokenRaw.address, dexRaw.weth);
  const tokenDecimals = tokenRaw.decimals ?? DEFAULT_DECIMALS;

  const totalSupply = _formatAmount(tokenRaw.totalSupply, tokenDecimals, {
    maximumFractionDigits: 0,
  });
  const cap = _formatAmount(tokenRaw.cap, tokenDecimals, {
    maximumFractionDigits: 0,
  });
  const remainingMintable = _formatAmount(
    tokenRaw.remainingMintable,
    tokenDecimals,
    { maximumFractionDigits: 0 },
  );

  const reserveBalance = _formatAmount(
    tokenRaw.balances?.reserve,
    tokenDecimals,
  );
  const vaultBalance = _formatAmount(
    tokenRaw.balances?.liquidityVault,
    tokenDecimals,
  );
  const treasuryBalance = _formatAmount(
    tokenRaw.balances?.treasury,
    tokenDecimals,
  );
  const dripBalance = _formatAmount(
    tokenRaw.balances?.dripDistributor,
    tokenDecimals,
  );
  const rewardsBalance = _formatAmount(
    tokenRaw.balances?.tokenRewards,
    tokenDecimals,
  );

  const pairBiggiReserve = _formatAmount(pairRes.biggiRaw, tokenDecimals);
  const pairNativeReserve = _formatAmount(pairRes.nativeRaw, DEFAULT_DECIMALS);
  const lpSupply = _formatAmount(pairRaw.totalSupply, DEFAULT_DECIMALS);

  const routerNative = _formatAmount(dexRaw.routerNativeOut, DEFAULT_DECIMALS, {
    maximumFractionDigits: 6,
  });
  const routerBiggiPerNativeNumeric = routerNative.numeric
    ? 1 / routerNative.numeric
    : null;
  const routerBiggiPerNativeDisplay =
    typeof routerBiggiPerNativeNumeric === "number"
      ? routerBiggiPerNativeNumeric.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })
      : PLACEHOLDER;

  const pairNativePerBiggiNumeric = _safeDivide(
    pairNativeReserve.numeric,
    pairBiggiReserve.numeric,
  );
  const pairNativePerBiggiDisplay =
    typeof pairNativePerBiggiNumeric === "number"
      ? pairNativePerBiggiNumeric.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })
      : PLACEHOLDER;
  const pairBiggiPerNativeNumeric = pairNativePerBiggiNumeric
    ? 1 / pairNativePerBiggiNumeric
    : null;
  const pairBiggiPerNativeDisplay =
    typeof pairBiggiPerNativeNumeric === "number"
      ? pairBiggiPerNativeNumeric.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })
      : PLACEHOLDER;

  const priceFeed = dexRaw.priceFeed;
  const feedPrice = priceFeed?.latestRoundData?.answer
    ? _formatAmount(priceFeed.latestRoundData.answer, priceFeed.decimals ?? 8, {
        maximumFractionDigits: 6,
      })
    : { display: PLACEHOLDER, numeric: null };

  const priceSource =
    feedPrice.numeric != null
      ? "Price feed"
      : routerNative.numeric != null
        ? "Router"
        : pairNativePerBiggiNumeric != null
          ? "Pair reserves"
          : "N/A";

  const tvlNativeNumeric =
    pairNativeReserve.numeric != null ? pairNativeReserve.numeric * 2 : null;
  const tvlNativeDisplay =
    typeof tvlNativeNumeric === "number"
      ? `${tvlNativeNumeric.toLocaleString("en-US", { maximumFractionDigits: 2 })} POL`
      : PLACEHOLDER;

  const liquidityDepthNumeric =
    (pairNativeReserve.numeric ?? 0) + (pairBiggiReserve.numeric ?? 0);
  const liquidityDepthDisplay =
    liquidityDepthNumeric > 0
      ? liquidityDepthNumeric.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })
      : PLACEHOLDER;

  const priceImpactNumeric =
    routerNative.numeric != null && pairNativePerBiggiNumeric != null
      ? Math.abs(
          (routerNative.numeric - pairNativePerBiggiNumeric) /
            Math.max(pairNativePerBiggiNumeric, 0.0000001),
        ) * 100
      : null;
  const priceImpactDisplay =
    typeof priceImpactNumeric === "number"
      ? `${priceImpactNumeric.toFixed(2)}%`
      : PLACEHOLDER;

  let marketHealth = "Thin";
  let marketHealthTone = "warning";
  if (pairBiggiReserve.numeric >= 100_000 && pairNativeReserve.numeric >= 60) {
    marketHealth = "Healthy";
    marketHealthTone = "primary";
  } else if (
    pairBiggiReserve.numeric >= 50_000 &&
    pairNativeReserve.numeric >= 20
  ) {
    marketHealth = "Steady";
    marketHealthTone = "secondary";
  } else if (
    pairBiggiReserve.numeric != null &&
    pairNativeReserve.numeric != null
  ) {
    marketHealth = "Watchlist";
    marketHealthTone = "warning";
  }

  return {
    ts,
    tsLabel,
    tsISO: new Date(ts).toISOString(),
    token: {
      address: tokenRaw.address,
      name: tokenRaw.name,
      symbol: tokenRaw.symbol,
      totalSupply: totalSupply.display,
      totalSupplyNumeric: totalSupply.numeric,
      cap: cap.display,
      capNumeric: cap.numeric,
      remainingMintable: remainingMintable.display,
      remainingMintableNumeric: remainingMintable.numeric,
      addresses: {
        reserve: tokenRaw.reserveAddress,
        reserveShort: _shortAddress(tokenRaw.reserveAddress),
        dripDistributor: tokenRaw.dripDistributorAddress,
        dripDistributorShort: _shortAddress(tokenRaw.dripDistributorAddress),
        tokenRewards: tokenRaw.tokenRewardsAddress,
        tokenRewardsShort: _shortAddress(tokenRaw.tokenRewardsAddress),
      },
      balances: {
        reserve: reserveBalance.display,
        reserveNumeric: reserveBalance.numeric,
        liquidityVault: vaultBalance.display,
        liquidityVaultNumeric: vaultBalance.numeric,
        treasury: treasuryBalance.display,
        treasuryNumeric: treasuryBalance.numeric,
        dripDistributor: dripBalance.display,
        dripDistributorNumeric: dripBalance.numeric,
        tokenRewards: rewardsBalance.display,
        tokenRewardsNumeric: rewardsBalance.numeric,
      },
    },
    dex: {
      router: {
        address: dexRaw.router,
        factory: dexRaw.routerFactory,
      },
      weth: dexRaw.weth,
      path: dexRaw.path,
      pairAddress: dexRaw.pairAddress,
      pair: {
        token0: pairRaw.token0,
        token1: pairRaw.token1,
        reserves: {
          biggi: pairBiggiReserve.display,
          biggiNumeric: pairBiggiReserve.numeric,
          native: pairNativeReserve.display,
          nativeNumeric: pairNativeReserve.numeric,
        },
        totalSupply: lpSupply.display,
        totalSupplyNumeric: lpSupply.numeric,
      },
      price: {
        router: {
          nativePerBiggi: routerNative.display,
          nativePerBiggiNumeric: routerNative.numeric,
          biggiPerNative: routerBiggiPerNativeDisplay,
          biggiPerNativeNumeric: routerBiggiPerNativeNumeric,
        },
        pair: {
          nativePerBiggi: pairNativePerBiggiDisplay,
          nativePerBiggiNumeric: pairNativePerBiggiNumeric,
          biggiPerNative: pairBiggiPerNativeDisplay,
          biggiPerNativeNumeric: pairBiggiPerNativeNumeric,
        },
        feed: {
          price: feedPrice.display,
          priceNumeric: feedPrice.numeric,
          updatedAt: priceFeed?.latestRoundData?.updatedAt || null,
          roundId: priceFeed?.latestRoundData?.roundId || null,
        },
        source: priceSource,
      },
      derived: {
        tvlNative: tvlNativeDisplay,
        tvlNativeNumeric,
        liquidityDepth: liquidityDepthDisplay,
        liquidityDepthNumeric,
        priceImpact: priceImpactDisplay,
        priceImpactNumeric,
        marketHealth,
        marketHealthTone,
      },
    },
  };
}

function _mapHistory(history = [], selector) {
  return history
    .map((entry) => ({
      label: entry?.tsLabel ?? "",
      value: selector(entry),
    }))
    .filter(
      (entry) =>
        typeof entry.value === "number" && Number.isFinite(entry.value),
    );
}

export function mapHistoryToPricePoints(history = []) {
  return _mapHistory(
    history,
    (entry) =>
      entry?.dex?.price?.pair?.nativePerBiggiNumeric ??
      entry?.dex?.price?.pair?.nativePerBiggi,
  );
}

export function mapHistoryToReservePoints(history = []) {
  return _mapHistory(
    history,
    (entry) => entry?.dex?.pair?.reserves?.nativeNumeric,
  );
}

export function mapHistoryToLpPoints(history = []) {
  return _mapHistory(history, (entry) => entry?.dex?.pair?.totalSupplyNumeric);
}
