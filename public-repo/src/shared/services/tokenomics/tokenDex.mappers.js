import {
  formatMappedAmount,
  formatMappedLp,
  formatMappedNative,
  formatMappedToken,
} from "./amountFormatters.js";

const DEFAULT_DECIMALS = 18;
const PLACEHOLDER = "N/A";

function _normalizeBigNumberish(value) {
  if (value == null) return value;
  if (
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (value?._isBigNumber || value?.type === "BigNumber") {
    return value.toString();
  }
  if (typeof value?.toString === "function") return value.toString();
  return value;
}

function _formatAmount(raw, decimals = DEFAULT_DECIMALS, options = {}) {
  return formatMappedAmount(_normalizeBigNumberish(raw), {
    decimals,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    placeholder: PLACEHOLDER,
    unit: options.unit ?? "",
  });
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
  const directBiggi = reserves.token ?? reserves.biggi ?? null;
  const directNative = reserves.native ?? null;
  const reserve0 = reserves.reserve0 || null;
  const reserve1 = reserves.reserve1 || null;
  const token0 = pair?.token0?.toLowerCase();
  const token1 = pair?.token1?.toLowerCase();
  const biggiAddr = tokenAddress?.toLowerCase();
  const wethAddr = wethAddress?.toLowerCase();
  let biggiRaw = null;
  let nativeRaw = null;

  if (directBiggi != null) biggiRaw = directBiggi;
  if (directNative != null) nativeRaw = directNative;

  if (biggiRaw == null && biggiAddr && token0 === biggiAddr)
    biggiRaw = reserve0;
  if (biggiRaw == null && biggiAddr && token1 === biggiAddr)
    biggiRaw = reserve1;
  if (nativeRaw == null && wethAddr && token0 === wethAddr)
    nativeRaw = reserve0;
  if (nativeRaw == null && wethAddr && token1 === wethAddr)
    nativeRaw = reserve1;

  if (biggiRaw == null && nativeRaw == null) {
    biggiRaw = reserve0;
    nativeRaw = reserve1;
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
    unit: "BIGGI",
  });
  const cap = _formatAmount(tokenRaw.cap, tokenDecimals, {
    maximumFractionDigits: 0,
    unit: "BIGGI",
  });
  const remainingMintable = _formatAmount(
    tokenRaw.remainingMintable,
    tokenDecimals,
    { maximumFractionDigits: 0, unit: "BIGGI" },
  );

  const reserveBalance = formatMappedToken(
    tokenRaw.balances?.reserve,
    tokenDecimals,
    2,
    PLACEHOLDER,
  );
  const vaultBalance = formatMappedToken(
    tokenRaw.balances?.liquidityVault,
    tokenDecimals,
    2,
    PLACEHOLDER,
  );
  const treasuryBalance = formatMappedToken(
    tokenRaw.balances?.treasury,
    tokenDecimals,
    2,
    PLACEHOLDER,
  );
  const DRIPBalance = formatMappedToken(
    tokenRaw.balances?.DRIPDistributor,
    tokenDecimals,
    2,
    PLACEHOLDER,
  );
  const REWARDSBalance = formatMappedToken(
    tokenRaw.balances?.tokenREWARDS,
    tokenDecimals,
    2,
    PLACEHOLDER,
  );

  const pairBiggiReserve = formatMappedToken(
    pairRes.biggiRaw,
    tokenDecimals,
    2,
    PLACEHOLDER,
  );
  const pairNativeReserve = formatMappedNative(
    pairRes.nativeRaw,
    4,
    PLACEHOLDER,
  );
  const lpSupply = formatMappedLp(pairRaw.totalSupply, 4, PLACEHOLDER);

  const routerNative = formatMappedNative(
    dexRaw.routerNativeOut,
    6,
    PLACEHOLDER,
  );
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

  const liquidityDepthNumeric = pairNativeReserve.numeric ?? null;
  const liquidityDepthDisplay =
    pairNativeReserve.display !== PLACEHOLDER
      ? pairNativeReserve.display
      : PLACEHOLDER;

  const priceImpactNumeric =
    routerNative.numeric != null && pairNativePerBiggiNumeric != null
      ? Math.abs(
          (routerNative.numeric - pairNativePerBiggiNumeric) /
            Math.max(pairNativePerBiggiNumeric, 0.0000001),
        ) * 100
      : null;
  const priceImpactDisplay =
    typeof priceImpactNumeric === "number" &&
    Number.isFinite(priceImpactNumeric)
      ? priceImpactNumeric > 1_000_000
        ? "> 1,000,000%"
        : `${priceImpactNumeric.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}%`
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
      decimals: tokenDecimals,
      rewardsOperator:
        tokenRaw.REWARDSOperator ?? tokenRaw.rewardsOperator ?? null,
      totalSupply: totalSupply.display,
      totalSupplyNumeric: totalSupply.numeric,
      cap: cap.display,
      capNumeric: cap.numeric,
      remainingMintable: remainingMintable.display,
      remainingMintableNumeric: remainingMintable.numeric,
      addresses: {
        reserve: tokenRaw.reserveAddress,
        reserveShort: _shortAddress(tokenRaw.reserveAddress),
        DRIPDistributor: tokenRaw.DRIPDistributorAddress,
        DRIPDistributorShort: _shortAddress(tokenRaw.DRIPDistributorAddress),
        tokenREWARDS: tokenRaw.tokenREWARDSAddress,
        tokenREWARDSShort: _shortAddress(tokenRaw.tokenREWARDSAddress),
      },
      balances: {
        reserve: reserveBalance.display,
        reserveNumeric: reserveBalance.numeric,
        liquidityVault: vaultBalance.display,
        liquidityVaultNumeric: vaultBalance.numeric,
        treasury: treasuryBalance.display,
        treasuryNumeric: treasuryBalance.numeric,
        DRIPDistributor: DRIPBalance.display,
        DRIPDistributorNumeric: DRIPBalance.numeric,
        tokenREWARDS: REWARDSBalance.display,
        tokenREWARDSNumeric: REWARDSBalance.numeric,
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
