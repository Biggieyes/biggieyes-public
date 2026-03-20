import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import AddressLine from "../components/AddressLine.jsx";
import styles from "../styles/BiggiToken.module.css";
import "./BUYBACKTreasuryTab.css";
import {
  formatTokenAmount,
  pickAddress,
  pickDisplay,
} from "../utils/panelFormatting.js";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

function BUYBACKTreasuryTab({
  snapshot,
  readerStatus,
  flowSnapshot,
  dripSnapshot,
  liquiditySnapshot,
  tokenDexSnapshot,
  nativeSeries = [],
  biggiSeries = [],
  treasurySeries = [],
  isLoading,
  error,
}) {
  if (isLoading) {
    return <div className="buyback-tab">Loading BUYBACK stats...</div>;
  }
  if (error) {
    return <div className="buyback-tab buyback-tab--error">{error?.message || String(error)}</div>;
  }

  const buy = snapshot?.BUYBACK || {};
  const treasury = snapshot?.treasury || {};
  const derived = snapshot?.derived || {};
  const effectiveBuy = readerStatus || {};
  const tokenDecimals =
    tokenDexSnapshot?.token?.decimals ?? flowSnapshot?.tokenMeta?.decimals ?? 18;
  const reserveAddress = pickAddress(
    treasury.reserve,
    flowSnapshot?.addresses?.reserve,
    liquiditySnapshot?.reserve?.address,
    tokenDexSnapshot?.token?.reserveAddress,
  );
  const dripDistributorAddress = pickAddress(
    treasury.DRIPDistributor,
    flowSnapshot?.addresses?.DRIPDistributor,
    flowSnapshot?.addresses?.DRIP_DISTRIBUTOR,
    dripSnapshot?.distributor?.address,
    tokenDexSnapshot?.token?.DRIPDistributorAddress,
  );
  const tokenRewardsAddress = pickAddress(
    treasury.tokenREWARDS,
    flowSnapshot?.addresses?.tokenREWARDS,
    flowSnapshot?.addresses?.TOKEN_REWARDS,
    tokenDexSnapshot?.token?.tokenREWARDSAddress,
  );

  const downstreamRows = [
    {
      label: "Treasury BIGGI live",
      value: pickDisplay(treasury.biggiBalance),
    },
    {
      label: "Reserve BIGGI live",
      value: pickDisplay(
        liquiditySnapshot?.reserve?.biggiBalance,
        formatTokenAmount(flowSnapshot?.liveBalances?.token?.reserve, tokenDecimals),
      ),
    },
    {
      label: "Reserve waiting",
      value: pickDisplay(liquiditySnapshot?.reserve?.waitingBiggi),
    },
    {
      label: "Reserve DEX refill",
      value: pickDisplay(liquiditySnapshot?.reserve?.dexRefillBiggi),
    },
    {
      label: "DRIP distributor live",
      value: pickDisplay(
        dripSnapshot?.distributor?.balance,
        dripSnapshot?.distributor?.tokenBalance,
        formatTokenAmount(
          tokenDexSnapshot?.token?.balances?.DRIPDistributor,
          tokenDecimals,
        ),
      ),
    },
    {
      label: "TokenRewards live",
      value: pickDisplay(
        formatTokenAmount(
          tokenDexSnapshot?.token?.balances?.tokenREWARDS,
          tokenDecimals,
        ),
      ),
    },
    {
      label: "DEX pair BIGGI tradable",
      value: formatTokenAmount(
        tokenDexSnapshot?.dex?.pair?.reserves?.token,
        tokenDecimals,
      ),
    },
  ];

  const stats = [
    {
      label: "Total spent",
      value: buy.totalNativeSpent,
      hint: derived.statusLabel,
      tone: "native",
    },
    {
      label: "BUYBACK BIGGI",
      value: buy.totalBiggiAcquired,
      hint: buy.lastBUYBACKLabel,
      tone: "token",
    },
    {
      label: "Total received",
      value: buy.totalNativeReceived,
      hint: buy.shortAddress,
      tone: "native",
    },
    {
      label: "BIGGI Treasury",
      value: treasury.totalBiggiReceived,
      hint: treasury.shortAddress,
      tone: "token",
    },
    {
      label: "Treasury native",
      value: treasury.maticBalance,
      hint: treasury.totalMaticReceived,
      tone: "native",
    },
  ];

  const statusRows = [
    {
      label: "Paused",
      value:
        buy.paused == null
          ? effectiveBuy.paused == null
            ? "--"
            : effectiveBuy.paused
              ? "Yes"
              : "No"
          : buy.paused
            ? "Yes"
            : "No",
    },
    {
      label: "Auto buyback",
      value:
        buy.autoBUYBACKEnabled == null
          ? effectiveBuy.autoBUYBACKEnabled == null
            ? "--"
            : effectiveBuy.autoBUYBACKEnabled
              ? "Enabled"
              : "Disabled"
          : buy.autoBUYBACKEnabled
            ? "Enabled"
            : "Disabled",
    },
    { label: "Last buyback", value: buy.lastBUYBACKLabel || "--" },
    {
      label: "Policy interval",
      value:
        buy.fallbackMinIntervalSec != null
          ? `${buy.fallbackMinIntervalSec} s`
          : "--",
    },
    {
      label: "Policy slippage",
      value:
        buy.fallbackSwapSlippageBps != null
          ? `${buy.fallbackSwapSlippageBps} bps`
          : "--",
    },
    {
      label: "Policy deadline",
      value:
        buy.fallbackTxDeadlineSec != null
          ? `${buy.fallbackTxDeadlineSec} s`
          : "--",
    },
    {
      label: "Keeper paused",
      value:
        buy.keeperProxyPaused == null
          ? "--"
          : buy.keeperProxyPaused
            ? "Yes"
            : "No",
    },
    {
      label: "Keeper threshold",
      value:
        hasValue(buy.keeperThreshold)
          ? `${buy.keeperThreshold} POL`
          : "--",
    },
  ];

  return (
    <section className="buyback-tab">
      <header className="buyback-tab__header">
        <div className="buyback-tab__headline">
          <h3>BUYBACK & Treasury</h3>
          <p>Cumulative buyback flow, treasury intake, and execution health.</p>
        </div>
        <div className="buyback-tab__header-meta">
          <span className={`buyback-tab__badge buyback-tab__badge--${derived.statusTone || "idle"}`}>
            {derived.statusLabel || "--"}
          </span>
          <span className="buyback-tab__timestamp">{snapshot?.tsLabel || "--"}</span>
        </div>
      </header>
      <div className="buyback-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>
      <div className="buyback-tab__charts">
        <div className="buyback-tab__chart">
          <h4>Agent native balance</h4>
          <p>Live POL balance currently sitting on the buyback agent between executions.</p>
          <LineChart points={nativeSeries} height={160} />
        </div>
        <div className="buyback-tab__chart">
          <h4>Agent BIGGI inventory</h4>
          <p>BIGGI currently held on the buyback agent before routing settles onward.</p>
          <LineChart points={biggiSeries} height={160} />
        </div>
        <div className="buyback-tab__chart">
          <h4>Treasury BIGGI balance</h4>
          <p>Current BIGGI balance visible on treasury instead of only cumulative receipts.</p>
          <LineChart points={treasurySeries} height={160} />
        </div>
      </div>
      <div className={styles.ecoTables}>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Execution controls</div>
          {statusRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {hasValue(row.value) ? row.value : "--"}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Contract wiring</div>
          <AddressLine label="BUYBACK Agent" address={buy.address ?? effectiveBuy.BUYBACKAgent} />
          <AddressLine label="Treasury" address={treasury.address ?? effectiveBuy.treasury} />
          <AddressLine label="Reserve" address={reserveAddress} />
          <AddressLine label="DRIP Distributor" address={dripDistributorAddress} />
          <AddressLine label="TokenRewards" address={tokenRewardsAddress} />
          <AddressLine label="Router" address={buy.router ?? effectiveBuy.router} />
          <AddressLine label="Wrapped native" address={buy.wrappedNative ?? effectiveBuy.wrappedNative} />
          <AddressLine label="Policy" address={buy.POLICY} />
          <AddressLine label="BUYBACK Keeper" address={buy.keeperProxy} />
        </div>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Treasury downstream routing</div>
          {downstreamRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {hasValue(row.value) ? row.value : "--"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default React.memo(BUYBACKTreasuryTab);
