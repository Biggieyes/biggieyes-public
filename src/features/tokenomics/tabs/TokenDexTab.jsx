import * as React from "react";
import { formatUnits } from "ethers";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import DexLiquidityChart from "../../../components/TOKEN/DexLiquidityChart.jsx";
import AddressLine from "../components/AddressLine.jsx";
import { explorerLink, fmtDate, fmtVal, shortAddr } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";
import { mapRawSnapshotToUI } from "@/shared/services/tokenomics/tokenDex.mappers";
import "./TokenDexTab.css";

const isAddress = (value) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && trimmed !== "--" && trimmed.toUpperCase() !== "N/A";
  }
  return true;
};

const toNumberLoose = (value) => {
  if (value == null) return null;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const cleaned = String(value).replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const pickValue = (...values) => values.find(hasValue) ?? "--";

const pickNumber = (...values) => {
  for (const value of values) {
    const num = toNumberLoose(value);
    if (num != null) return num;
  }
  return null;
};

const pickAddress = (...values) =>
  values.find((value) => isAddress(value)) ?? null;

const formatNumber = (value, digits = 2, suffix = "") => {
  const num = toNumberLoose(value);
  if (num == null) return "--";
  return `${num.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })}${suffix ? ` ${suffix}` : ""}`;
};

const formatReaderToken = (value, decimals = 18, digits = 2) => {
  if (value == null) return "--";
  try {
    const formatted = formatUnits(value, decimals);
    const num = Number(formatted);
    return Number.isFinite(num)
      ? num.toLocaleString("en-US", { maximumFractionDigits: digits })
      : formatted;
  } catch {
    return value?.toString?.() ?? "--";
  }
};

const formatReaderNumber = (value, decimals = 18) => {
  if (value == null) return null;
  try {
    const num = Number(formatUnits(value, decimals));
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
};

const mapTone = (tone) => {
  if (tone === "primary" || tone === "secondary") return "active";
  if (tone === "warning") return "warning";
  return "idle";
};

function TokenDexTab({
  tabBusy,
  error,
  onRefresh,
  pumpView,
  liquidity,
  dexHistory,
  tok,
  router,
  tokenDexSnapshot,
  readerStatus,
}) {
  const display = tokenDexSnapshot ? mapRawSnapshotToUI(tokenDexSnapshot) : null;

  if (tabBusy && !tokenDexSnapshot) {
    return <div className="token-dex-tab">Loading Token / DEX snapshot...</div>;
  }

  if (error && !tokenDexSnapshot) {
    return (
      <div className="token-dex-tab token-dex-tab--error">
        {error?.message || String(error)}
      </div>
    );
  }

  if (!tokenDexSnapshot) {
    return <div className="token-dex-tab">Waiting for Token / DEX snapshot...</div>;
  }

  const historyBundle = Array.isArray(dexHistory)
    ? { dexSeries: dexHistory }
    : dexHistory || {};
  const rewardsStatus = readerStatus?.tr || null;
  const tokenDecimals = tokenDexSnapshot?.token?.decimals ?? 18;

  const reserveNative = pickNumber(
    pumpView?.pair?.nativeReserve,
    liquidity?.reserveNative,
    display?.dex?.pair?.reserves?.nativeNumeric,
  );
  const reserveBiggi = pickNumber(
    pumpView?.pair?.biggiReserve,
    liquidity?.reserveBiggi,
    display?.dex?.pair?.reserves?.biggiNumeric,
  );
  const lpTotalSupply = pickNumber(
    pumpView?.pair?.lpTotalSupply,
    liquidity?.lpTotalSupply,
    tokenDexSnapshot?.dex?.pair?.lpTotalSupply,
    display?.dex?.pair?.totalSupplyNumeric,
  );
  const nativePerBiggi = pickNumber(
    liquidity?.nativePerBiggi,
    tokenDexSnapshot?.derived?.priceNativePerToken,
    display?.dex?.price?.pair?.nativePerBiggiNumeric,
    display?.dex?.price?.router?.nativePerBiggiNumeric,
  );
  const biggiPerNative = pickNumber(
    liquidity?.biggiPerNative,
    tokenDexSnapshot?.derived?.priceTokenPerNative,
    display?.dex?.price?.pair?.biggiPerNativeNumeric,
    display?.dex?.price?.router?.biggiPerNativeNumeric,
  );
  const tvlNativeDisplay = pickValue(
    display?.dex?.derived?.tvlNative,
    formatNumber(
      pickNumber(display?.dex?.derived?.tvlNativeNumeric, reserveNative != null ? reserveNative * 2 : null),
      2,
      "POL",
    ),
  );
  const liquidityDepthDisplay = pickValue(
    display?.dex?.derived?.liquidityDepth,
    formatNumber(display?.dex?.derived?.liquidityDepthNumeric),
  );
  const priceImpactDisplay = pickValue(
    display?.dex?.derived?.priceImpact,
    formatNumber(display?.dex?.derived?.priceImpactNumeric, 2, "%"),
  );
  const feedPriceDisplay = pickValue(
    display?.dex?.price?.feed?.price,
    formatReaderToken(
      tokenDexSnapshot?.dex?.priceFeed?.latestRoundData?.answer,
      tokenDexSnapshot?.dex?.priceFeed?.decimals ?? 8,
      6,
    ),
  );
  const feedUpdated = tokenDexSnapshot?.dex?.priceFeed?.latestRoundData?.updatedAt;
  const priceSource = pickValue(display?.dex?.price?.source, nativePerBiggi != null ? "Pair reserves" : "N/A");
  const marketHealth = pickValue(display?.dex?.derived?.marketHealth, "--");
  const marketTone = mapTone(display?.dex?.derived?.marketHealthTone);

  const tokenName = pickValue(display?.token?.name, tok?.name);
  const tokenSymbol = pickValue(display?.token?.symbol, tok?.symbol);
  const totalSupplyDisplay = pickValue(
    display?.token?.totalSupply,
    formatReaderToken(tokenDexSnapshot?.token?.totalSupply, tokenDecimals, 0),
  );
  const capDisplay = pickValue(
    display?.token?.cap,
    formatReaderToken(tokenDexSnapshot?.token?.cap, tokenDecimals, 0),
  );
  const remainingMintableDisplay = pickValue(
    display?.token?.remainingMintable,
    formatReaderToken(tokenDexSnapshot?.token?.remainingMintable, tokenDecimals, 0),
  );
  const reserveBalanceDisplay = pickValue(
    display?.token?.balances?.reserve,
    formatReaderToken(tokenDexSnapshot?.token?.balances?.reserve, tokenDecimals),
  );
  const reserveWaitingDisplay = hasValue(liquidity?.waitingBiggi)
    ? fmtVal(liquidity?.waitingBiggi, "BIGGI")
    : "--";
  const reserveDexRefillDisplay = hasValue(liquidity?.dexRefillBiggi)
    ? fmtVal(liquidity?.dexRefillBiggi, "BIGGI")
    : "--";
  const vaultBalanceDisplay = pickValue(
    display?.token?.balances?.liquidityVault,
    formatReaderToken(tokenDexSnapshot?.token?.balances?.liquidityVault, tokenDecimals),
  );
  const treasuryBalanceDisplay = pickValue(
    display?.token?.balances?.treasury,
    formatReaderToken(tokenDexSnapshot?.token?.balances?.treasury, tokenDecimals),
  );
  const dripBalanceDisplay = pickValue(
    display?.token?.balances?.DRIPDistributor,
    formatReaderToken(tokenDexSnapshot?.token?.balances?.DRIPDistributor, tokenDecimals),
  );
  const tokenRewardsBalanceDisplay = pickValue(
    display?.token?.balances?.tokenREWARDS,
    formatReaderToken(tokenDexSnapshot?.token?.balances?.tokenREWARDS, tokenDecimals),
  );

  const rewardsCapDisplay = formatReaderToken(
    rewardsStatus?.REWARDSCap ?? rewardsStatus?.rewardsCap,
    tokenDecimals,
  );
  const rewardsMintedDisplay = formatReaderToken(
    rewardsStatus?.REWARDSMinted ?? rewardsStatus?.rewardsMinted,
    tokenDecimals,
  );
  const unitRewardDisplay = formatReaderToken(
    rewardsStatus?.unitReward,
    tokenDecimals,
    4,
  );
  const rewardsCapNumeric = formatReaderNumber(
    rewardsStatus?.REWARDSCap ?? rewardsStatus?.rewardsCap,
    tokenDecimals,
  );
  const rewardsMintedNumeric = formatReaderNumber(
    rewardsStatus?.REWARDSMinted ?? rewardsStatus?.rewardsMinted,
    tokenDecimals,
  );
  const rewardsCoverageDisplay =
    rewardsCapNumeric != null && rewardsCapNumeric > 0 && rewardsMintedNumeric != null
      ? `${((rewardsMintedNumeric / rewardsCapNumeric) * 100).toFixed(2)}%`
      : "--";

  const tokenAddress = pickAddress(tok?.address, tokenDexSnapshot?.token?.address);
  const routerAddress = pickAddress(
    router?.address,
    router?.routerAddress,
    tokenDexSnapshot?.dex?.router?.address,
    tokenDexSnapshot?.dex?.router?.routerAddress,
    tokenDexSnapshot?.dex?.routerAddress,
    tokenDexSnapshot?.addresses?.router,
  );
  const factoryAddress = pickAddress(
    router?.factory,
    tokenDexSnapshot?.dex?.router?.factory,
    tokenDexSnapshot?.dex?.routerFactory,
    tok?.factoryAddr,
    tokenDexSnapshot?.addresses?.factory,
  );
  const wrappedNativeAddress = pickAddress(
    router?.wrappedNative,
    tokenDexSnapshot?.dex?.router?.wrappedNative,
    tokenDexSnapshot?.dex?.weth,
    tok?.weth,
    tokenDexSnapshot?.addresses?.weth,
  );
  const pairAddress = pickAddress(
    liquidity?.pairAddress,
    tokenDexSnapshot?.dex?.pair?.address,
    tokenDexSnapshot?.dex?.pairAddress,
    tok?.pair,
    tokenDexSnapshot?.addresses?.pairAddress,
  );
  const priceFeedAddress = pickAddress(
    tokenDexSnapshot?.dex?.priceFeed?.address,
    tokenDexSnapshot?.addresses?.lpPriceFeed,
  );
  const reserveAddress = pickAddress(
    tokenDexSnapshot?.token?.reserveAddress,
    tokenDexSnapshot?.addresses?.reserve,
  );
  const vaultAddress = pickAddress(tokenDexSnapshot?.addresses?.liquidityVault);
  const treasuryAddress = pickAddress(tokenDexSnapshot?.addresses?.treasury);
  const dripAddress = pickAddress(tokenDexSnapshot?.token?.DRIPDistributorAddress);
  const tokenRewardsAddress = pickAddress(tokenDexSnapshot?.token?.tokenREWARDSAddress);
  const rewardsOperatorAddress = pickAddress(
    tokenDexSnapshot?.token?.REWARDSOperator,
    tokenDexSnapshot?.token?.rewardsOperator,
  );

  const contractRows = [
    { label: "BIGGI Token", address: tokenAddress },
    { label: "DEX Router", address: routerAddress },
    { label: "DEX Factory", address: factoryAddress },
    { label: "Wrapped Native", address: wrappedNativeAddress },
    { label: "DEX Pair", address: pairAddress },
    { label: "LP Price Feed", address: priceFeedAddress },
    { label: "Reserve", address: reserveAddress },
    { label: "Liquidity Vault", address: vaultAddress },
    { label: "Treasury", address: treasuryAddress },
    { label: "DRIP Distributor", address: dripAddress },
    { label: "Token Rewards", address: tokenRewardsAddress },
    { label: "Rewards Operator", address: rewardsOperatorAddress },
  ];
  const linkedContracts = contractRows.filter((row) => row.address).length;
  const wiringTone =
    linkedContracts === contractRows.length
      ? "active"
      : linkedContracts >= Math.max(6, contractRows.length - 2)
        ? "warning"
        : "paused";

  const pairTokenHint = [
    shortAddr(tokenDexSnapshot?.dex?.pair?.token0),
    shortAddr(tokenDexSnapshot?.dex?.pair?.token1),
  ].join(" / ");
  const readerLabel = rewardsStatus ? "Reader live" : "Snapshot only";
  const pricePoints = historyBundle?.pricePoints || [];
  const reservePoints = historyBundle?.reservePoints || [];
  const biggiReservePoints = historyBundle?.biggiReservePoints || [];
  const lpPoints = historyBundle?.lpPoints || [];
  const dexSeries = historyBundle?.dexSeries || [];

  const stats = [
    {
      label: "Pair POL",
      value: fmtVal(reserveNative, "POL"),
      hint: pairAddress ? shortAddr(pairAddress) : "Pair reserves",
      tone: "native",
    },
    {
      label: "Pair BIGGI",
      value: fmtVal(reserveBiggi, "BIGGI"),
      hint: marketHealth,
      tone: "token",
    },
    {
      label: "POL / BIGGI",
      value: formatNumber(nativePerBiggi, 6),
      hint: `Source ${priceSource}`,
      tone: "native",
    },
    {
      label: "BIGGI / POL",
      value: formatNumber(biggiPerNative, 2),
      hint: hasValue(feedPriceDisplay) ? `Feed ${feedPriceDisplay}` : "Inverse pair price",
      tone: "token",
    },
    {
      label: "LP supply",
      value: fmtVal(lpTotalSupply, "LP"),
      hint: pairTokenHint,
      tone: "token",
    },
    {
      label: "TVL",
      value: tvlNativeDisplay,
      hint: hasValue(liquidityDepthDisplay)
        ? `Depth ${liquidityDepthDisplay}`
        : "Derived from pair reserves",
      tone: "native",
    },
    {
      label: "Total supply",
      value: totalSupplyDisplay,
      hint: hasValue(capDisplay) ? `Cap ${capDisplay}` : tokenSymbol,
      tone: "token",
    },
    {
      label: "Reserve BIGGI",
      value: reserveBalanceDisplay,
      hint: hasValue(reserveDexRefillDisplay)
        ? `Refill ${reserveDexRefillDisplay}`
        : hasValue(vaultBalanceDisplay)
          ? `Vault ${vaultBalanceDisplay}`
          : "Reserve inventory",
      tone: "token",
    },
  ];

  const supplyRows = [
    { label: "Name / symbol", value: `${tokenName} / ${tokenSymbol}` },
    { label: "Total supply", value: totalSupplyDisplay },
    { label: "Cap", value: capDisplay },
    { label: "Remaining mintable", value: remainingMintableDisplay },
    { label: "Reserve balance", value: reserveBalanceDisplay },
    { label: "Reserve waiting", value: reserveWaitingDisplay },
    { label: "Reserve DEX refill", value: reserveDexRefillDisplay },
    { label: "Liquidity vault", value: vaultBalanceDisplay },
    { label: "Treasury balance", value: treasuryBalanceDisplay },
    { label: "DRIP distributor", value: dripBalanceDisplay },
    { label: "Token rewards", value: tokenRewardsBalanceDisplay },
  ];

  const marketRows = [
    { label: "Price source", value: priceSource },
    { label: "POL per BIGGI", value: formatNumber(nativePerBiggi, 6) },
    { label: "BIGGI per POL", value: formatNumber(biggiPerNative, 2) },
    { label: "Pair POL reserve", value: fmtVal(reserveNative, "POL") },
    { label: "Pair BIGGI reserve", value: fmtVal(reserveBiggi, "BIGGI") },
    { label: "LP total supply", value: fmtVal(lpTotalSupply, "LP") },
    { label: "TVL", value: tvlNativeDisplay },
    { label: "Price impact", value: priceImpactDisplay },
    { label: "Market health", value: marketHealth },
  ];

  const rewardsRows = [
    { label: "Reader mode", value: readerLabel },
    { label: "Rewards cap", value: rewardsCapDisplay },
    { label: "Rewards minted", value: rewardsMintedDisplay },
    { label: "Emission usage", value: rewardsCoverageDisplay },
    { label: "Unit reward", value: unitRewardDisplay },
    {
      label: "Block weights",
      value: Array.isArray(rewardsStatus?.blockWeights)
        ? rewardsStatus.blockWeights.join(", ")
        : "--",
    },
    { label: "LP feed price", value: feedPriceDisplay },
    { label: "Feed updated", value: feedUpdated ? fmtDate(feedUpdated) : "--" },
  ];

  return (
    <section className="token-dex-tab">
      <header className="token-dex-tab__header">
        <div className="token-dex-tab__headline">
          <h3>Token / DEX</h3>
          <p>
            BIGGI supply, pair reserves, pricing diagnostics, and contract wiring
            for the current trading stack.
          </p>
        </div>
        <div className="token-dex-tab__header-meta">
          <span className={`token-dex-tab__badge token-dex-tab__badge--${marketTone}`}>
            {marketHealth}
          </span>
          <span className="token-dex-tab__badge token-dex-tab__badge--idle">
            {priceSource}
          </span>
          <span className={`token-dex-tab__badge token-dex-tab__badge--${wiringTone}`}>
            Wiring {linkedContracts}/{contractRows.length}
          </span>
          <span className={`token-dex-tab__badge token-dex-tab__badge--${rewardsStatus ? "active" : "idle"}`}>
            {readerLabel}
          </span>
          <span className="token-dex-tab__timestamp">
            {display?.tsLabel || tokenDexSnapshot?.tsLabel || "--"}
          </span>
          {typeof onRefresh === "function" ? (
            <button
              type="button"
              className="token-dex-tab__refresh"
              onClick={onRefresh}
            >
              Refresh
            </button>
          ) : null}
        </div>
      </header>

      <div className="token-dex-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>

      <div className="token-dex-tab__charts">
        <div className="token-dex-tab__chart token-dex-tab__chart--wide">
          <h4>DEX liquidity overview</h4>
          <p>Combined view of pair reserves and live price movement over recent snapshots.</p>
          <DexLiquidityChart data={dexSeries} height={220} />
        </div>
        <div className="token-dex-tab__chart">
          <h4>Price trend</h4>
          <p>POL quoted per 1 BIGGI based on the live pair and router fallback.</p>
          <LineChart points={pricePoints} height={160} />
        </div>
        <div className="token-dex-tab__chart">
          <h4>Pair BIGGI reserve</h4>
          <p>Token-side depth in the active pair, usually more responsive than flat LP supply.</p>
          <LineChart points={biggiReservePoints} height={160} />
        </div>
        <div className="token-dex-tab__chart">
          <h4>Pair POL reserve</h4>
          <p>Shows native-side depth available in the active liquidity pair.</p>
          <LineChart points={reservePoints} height={160} />
        </div>
      </div>

      <div className={styles.ecoTables}>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Token supply</div>
          {supplyRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Market diagnostics</div>
          {marketRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Rewards stream</div>
          {rewardsRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Contract wiring</div>
          {contractRows.map((row) => (
            <AddressLine
              key={row.label}
              label={row.label}
              address={row.address}
              href={explorerLink(row.address)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default React.memo(TokenDexTab);
