import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import AddressLine from "../components/AddressLine.jsx";
import { explorerLink } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";
import "./DRIPTab.css";
import {
  formatNativeDisplay,
  formatTokenDisplay,
  pickFormatted,
  toDisplayNumber,
} from "../utils/amountFormatting.js";
import {
  pickAddress,
  sameAddress,
} from "../utils/panelFormatting.js";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const toNumberLoose = (value) => {
  return toDisplayNumber(value);
};

const formatTokenValue = (value, decimals = 18, digits = 2) => {
  return formatTokenDisplay(value, decimals, digits);
};

const buildMetric = (display, numeric, hint) => ({
  display: hasValue(display) ? display : "--",
  numeric: numeric ?? toNumberLoose(display),
  hint: hasValue(hint) ? hint : null,
});

const buildReaderMetric = (raw, hint, decimals = 18) => {
  if (raw == null) return null;
  const display = formatTokenValue(raw, decimals);
  return {
    display,
    numeric: toNumberLoose(display),
    hint: hasValue(hint) ? hint : null,
  };
};

const pickMetric = (...metrics) => {
  const valid = metrics.filter(Boolean);
  return (
    valid.find((metric) => metric.numeric != null && metric.numeric > 0) ||
    valid.find((metric) => metric.numeric != null) ||
    valid.find((metric) => hasValue(metric.display)) || {
      display: "--",
      numeric: null,
      hint: null,
    }
  );
};

function DRIPTab({
  snapshot,
  readerStatus,
  flowSnapshot,
  buybackSnapshot,
  liquiditySnapshot,
  tokenDexSnapshot,
  availableSeries = [],
  capSeries = [],
  nativeSeries = [],
  stabilitySeries = [],
  isLoading,
  error,
}) {
  if (isLoading) {
    return <div className="drip-tab">Loading DRIP snapshot...</div>;
  }
  if (error) {
    return <div className="drip-tab drip-tab--error">{error?.message || String(error)}</div>;
  }

  const dist = snapshot?.distributor || {};
  const lm = snapshot?.DRIPLM || {};
  const keeper = snapshot?.keeper || {};
  const derived = snapshot?.derived || {};
  const effectiveReader = readerStatus || {};
  const tokenDecimals =
    tokenDexSnapshot?.token?.decimals ?? flowSnapshot?.tokenMeta?.decimals ?? 18;
  const reserveAddress = pickAddress(
    liquiditySnapshot?.reserve?.address,
    flowSnapshot?.addresses?.reserve,
    tokenDexSnapshot?.token?.reserveAddress,
  );
  const buybackAddress = pickAddress(
    buybackSnapshot?.BUYBACK?.address,
    flowSnapshot?.addresses?.buyback,
    flowSnapshot?.addresses?.BUYBACK,
    flowSnapshot?.addresses?.BUYBACK_AGENT,
  );
  const routeRows = [
    {
      label: "Distributor BIGGI live",
      value: pickFormatted(
        (value) => formatTokenDisplay(value, tokenDecimals),
        flowSnapshot?.liveBalances?.token?.dripDistributor,
        dist.balance,
        dist.tokenBalance,
      ),
    },
    {
      label: "DRIPLM BIGGI live",
      value: formatTokenDisplay(lm.biggiBalance, tokenDecimals),
    },
    {
      label: "BIGGI sold on DEX",
      value: formatTokenDisplay(lm.totalSoldTokens, tokenDecimals),
    },
    {
      label: "Native forwarded",
      value: formatNativeDisplay(lm.totalNativeForwarded),
    },
    {
      label: "LM native live",
      value: formatNativeDisplay(lm.nativeBalance),
    },
    {
      label: "Reserve POL live",
      value: pickFormatted(
        formatNativeDisplay,
        flowSnapshot?.liveBalances?.native?.reserve,
        liquiditySnapshot?.reserve?.maticBalance,
      ),
    },
    {
      label: "Reserve DEX refill",
      value: formatTokenDisplay(liquiditySnapshot?.reserve?.dexRefillBiggi, tokenDecimals),
    },
    {
      label: "BUYBACK agent BIGGI",
      value: formatTokenDisplay(buybackSnapshot?.BUYBACK?.biggiBalance, tokenDecimals),
    },
  ];
  const routeChecks = [
    {
      label: "Reserve target",
      aligned:
        reserveAddress && lm.reserve
          ? sameAddress(lm.reserve, reserveAddress)
          : null,
    },
    {
      label: "BUYBACK target",
      aligned:
        buybackAddress && lm.buybackAgent
          ? sameAddress(lm.buybackAgent, buybackAddress)
          : null,
    },
    {
      label: "Distributor target",
      aligned: dist.targetMatches,
    },
    {
      label: "LM source",
      aligned: lm.distributorMatches,
    },
  ];

  const availableMetric = pickMetric(
    buildMetric(
      dist.availableTokens,
      dist.availableNumeric,
      derived.availablePercent,
    ),
    buildMetric(
      dist.effectiveAvailable,
      dist.effectiveAvailableNumeric,
      "Effective available",
    ),
    buildReaderMetric(effectiveReader.availableTokens, "Reader fallback"),
  );

  const distributorBalanceMetric = pickMetric(
    buildMetric(dist.balance, dist.balanceNumeric, dist.shortAddress),
    buildMetric(
      dist.tokenBalance,
      dist.tokenBalanceNumeric,
      "Current distributor inventory",
    ),
    buildReaderMetric(
      effectiveReader.availableTokens,
      "Reader available balance",
    ),
  );

  const nativeMetric = pickMetric(
    buildMetric(
      lm.totalNativeForwarded,
      lm.totalNativeForwardedNumeric,
      "Cumulative routed by DRIPLM",
    ),
    buildMetric(
      lm.nativeBalance,
      lm.nativeBalanceNumeric,
      lm.reserveShort || "Current LM native balance",
    ),
  );

  const soldMetric = pickMetric(
    buildMetric(
      lm.totalSoldTokens,
      lm.totalSoldTokensNumeric,
      "Cumulative BIGGI sold through DRIPLM",
    ),
    buildMetric(
      lm.biggiBalance,
      lm.biggiBalanceNumeric,
      "Current LM BIGGI balance",
    ),
  );

  const claimedMetric = pickMetric(
    buildMetric(dist.totalClaimed, null, dist.statusLabel),
    buildReaderMetric(effectiveReader.totalClaimed, "Reader fallback"),
  );

  const topUpMetric = pickMetric(
    buildMetric(dist.totalTopUp, null, "Cumulative top-up"),
    buildReaderMetric(effectiveReader.totalTopUp, "Reader fallback"),
    buildMetric(
      dist.totalReceived,
      dist.totalReceivedNumeric,
      "Cumulative received",
    ),
  );

  const notifiedMetric = pickMetric(
    buildMetric(dist.totalNotified, null, "Cumulative notified"),
    buildReaderMetric(effectiveReader.totalNotified, "Reader fallback"),
  );

  const mintMetric = pickMetric(
    buildMetric(dist.tokensPerMint, null, dist.DRIPLMShort),
    buildReaderMetric(effectiveReader.tokensPerMint, "Reader fallback"),
  );

  const capMetric = pickMetric(
    buildMetric(dist.cap, dist.capNumeric, "Configured distributor cap"),
  );
  const capRemainingMetric = pickMetric(
    buildMetric(
      dist.capRemaining,
      dist.capRemainingNumeric,
      derived.capRemainingPercent,
    ),
    buildMetric(
      dist.effectiveAvailable,
      dist.effectiveAvailableNumeric,
      "Effective cap headroom",
    ),
  );

  const stats = [
    {
      label: "Available",
      value: availableMetric.display,
      hint: availableMetric.hint,
      tone: "token",
    },
    {
      label: "Distributor balance",
      value: distributorBalanceMetric.display,
      hint: distributorBalanceMetric.hint,
      tone: "token",
    },
    {
      label: "Native forwarded",
      value: nativeMetric.display,
      hint: nativeMetric.hint,
      tone: "native",
    },
    {
      label: "BIGGI sold",
      value: soldMetric.display,
      hint: soldMetric.hint,
      tone: "token",
    },
    {
      label: "Total claimed",
      value: claimedMetric.display,
      hint: claimedMetric.hint,
      tone: "token",
    },
    {
      label: "Total top-up",
      value: topUpMetric.display,
      hint: topUpMetric.hint,
      tone: "token",
    },
    {
      label: "Total notified",
      value: notifiedMetric.display,
      hint: notifiedMetric.hint,
      tone: "token",
    },
    {
      label: "Tokens per mint",
      value: mintMetric.display,
      hint: mintMetric.hint,
      tone: "token",
    },
  ];

  const overviewItems = [
    {
      label: "Cap",
      value: capMetric.display,
      hint: capMetric.hint,
    },
    {
      label: "Cap remaining",
      value: capRemainingMetric.display,
      hint: capRemainingMetric.hint,
    },
    {
      label: "Split",
      value:
        lm.sellPct != null ||
        lm.reserveShareBps != null ||
        lm.moderatorShareBps != null
          ? `${lm.sellPct ?? effectiveReader.sellPct ?? "--"}% sell | ${lm.reserveShareBps ?? effectiveReader.reserveShareBps ?? "--"} bps reserve`
          : "--",
      hint:
        lm.moderatorShareBps != null ||
        effectiveReader.moderatorShareBps != null
          ? `Moderator ${lm.moderatorShareBps ?? effectiveReader.moderatorShareBps ?? "--"} bps`
          : null,
    },
    {
      label: "Automation",
      value: derived.automationStatusLabel || "--",
      hint: derived.statusLabel || "--",
    },
  ];

  const configRows = [
    {
      label: "Sell share",
      value: lm.sellPct ?? effectiveReader.sellPct ?? null,
      suffix: "%",
    },
    {
      label: "Reserve share",
      value: lm.reserveShareBps ?? effectiveReader.reserveShareBps ?? null,
      suffix: "bps",
    },
    {
      label: "Moderator share",
      value: lm.moderatorShareBps ?? effectiveReader.moderatorShareBps ?? null,
      suffix: "bps",
    },
    {
      label: "Slippage",
      value: lm.slippageBps ?? effectiveReader.slippageBps ?? null,
      suffix: "bps",
    },
    {
      label: "Tx deadline",
      value: lm.txDeadlineSec ?? effectiveReader.txDeadlineSec ?? null,
      suffix: "s",
    },
    {
      label: "Total top-up",
      value: topUpMetric.display,
      suffix: "",
    },
    {
      label: "Total notified",
      value: notifiedMetric.display,
      suffix: "",
    },
  ];

  return (
    <section className="drip-tab">
      <header className="drip-tab__header">
        <div className="drip-tab__headline">
          <h3>DRIP distribution</h3>
          <p>
            Emission availability, LM routing, and cumulative native forwarded from
            DRIP activity.
          </p>
        </div>
        <div className="drip-tab__header-meta">
          <span className={`drip-tab__badge drip-tab__badge--${derived.statusTone || "idle"}`}>
            {derived.statusLabel || "--"}
          </span>
          <span
            className={`drip-tab__badge drip-tab__badge--${derived.automationStatusTone || "idle"}`}
          >
            {derived.automationStatusLabel || "--"}
          </span>
          <span className="drip-tab__timestamp">{snapshot?.tsLabel || "--"}</span>
        </div>
      </header>

      <div className="drip-tab__overview">
        {overviewItems.map((item) => (
          <div key={item.label} className="drip-tab__overview-item">
            <span className="drip-tab__overview-label">{item.label}</span>
            <strong className="drip-tab__overview-value">{item.value}</strong>
            <span className="drip-tab__overview-hint">{item.hint || "--"}</span>
          </div>
        ))}
      </div>

      <div className="drip-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>

      <div className="drip-tab__charts">
        <div className="drip-tab__chart">
          <h4>Available BIGGI</h4>
          <p>Current remaining DRIP liquidity available for claims.</p>
          <LineChart points={availableSeries} height={160} />
        </div>
        <div className="drip-tab__chart">
          <h4>Cap remaining</h4>
          <p>Remaining headroom before the configured DRIP cap is exhausted.</p>
          <LineChart points={capSeries} height={160} />
        </div>
        <div className="drip-tab__chart">
          <h4>LM native balance</h4>
          <p>Live native balance on DRIPLM. This can stay low even after sells because the contract forwards native onward.</p>
          <LineChart points={nativeSeries} height={160} />
        </div>
        {stabilitySeries?.length ? (
          <div className="drip-tab__chart">
            <h4>BUYBACK stability</h4>
            <p>Cross-check of DRIP-side pressure against BUYBACK-side stability.</p>
            <LineChart points={stabilitySeries} height={160} />
          </div>
        ) : null}
      </div>

      <div className={styles.ecoTables}>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>DRIP config</div>
          {configRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {row.value == null || row.value === ""
                  ? "--"
                  : `${row.value}${row.suffix ? ` ${row.suffix}` : ""}`}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Contract wiring</div>
          <AddressLine
            label="DRIP Distributor"
            address={dist.address ?? effectiveReader.DRIPDistributor}
            href={explorerLink(dist.address ?? effectiveReader.DRIPDistributor)}
          />
          <AddressLine
            label="DRIPLM"
            address={lm.address ?? effectiveReader.DRIPLM}
            href={explorerLink(lm.address ?? effectiveReader.DRIPLM)}
          />
          <AddressLine
            label="Distributor operator"
            address={dist.operator}
            href={explorerLink(dist.operator)}
          />
          <AddressLine
            label="Reserve"
            address={lm.reserve ?? effectiveReader.dripReserve}
            href={explorerLink(lm.reserve ?? effectiveReader.dripReserve)}
          />
          <AddressLine
            label="Router"
            address={lm.router ?? effectiveReader.dripRouter}
            href={explorerLink(lm.router ?? effectiveReader.dripRouter)}
          />
          <AddressLine
            label="Buyback Agent"
            address={lm.buybackAgent ?? effectiveReader.dripBuyback}
            href={explorerLink(lm.buybackAgent ?? effectiveReader.dripBuyback)}
          />
          <AddressLine
            label="Moderator Center"
            address={lm.moderatorCenter ?? effectiveReader.dripModeratorCenter}
            href={explorerLink(
              lm.moderatorCenter ?? effectiveReader.dripModeratorCenter,
            )}
          />
          <AddressLine
            label="LM distributor"
            address={lm.distributor}
            href={explorerLink(lm.distributor)}
          />
        </div>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>DRIP automation</div>
          <AddressLine
            label="DRIP Keeper"
            address={keeper.address ?? effectiveReader.dripKeeper}
            href={explorerLink(keeper.address ?? effectiveReader.dripKeeper)}
          />
          <AddressLine
            label="Keeper target LM"
            address={keeper.dripLM ?? effectiveReader.DRIPLM}
            href={explorerLink(keeper.dripLM ?? effectiveReader.DRIPLM)}
          />
          <AddressLine
            label="Keeper owner"
            address={keeper.owner}
            href={explorerLink(keeper.owner)}
          />
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Automation status</span>
            <span className={styles.ecoTableValue}>
              {derived.automationStatusLabel ?? "--"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Keeper paused</span>
            <span className={styles.ecoTableValue}>
              {keeper.paused == null ? "--" : keeper.paused ? "Yes" : "No"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Upkeep needed</span>
            <span className={styles.ecoTableValue}>
              {keeper.upkeepNeeded == null
                ? "--"
                : keeper.upkeepNeeded
                  ? "Yes"
                  : "No"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Keeper target status</span>
            <span className={styles.ecoTableValue}>
              {keeper.targetMatches == null
                ? "--"
                : keeper.targetMatches
                  ? "Aligned"
                  : "Mismatch"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Distributor target status</span>
            <span className={styles.ecoTableValue}>
              {dist.targetMatches == null
                ? "--"
                : dist.targetMatches
                  ? "Aligned"
                  : "Mismatch"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>LM source status</span>
            <span className={styles.ecoTableValue}>
              {lm.distributorMatches == null
                ? "--"
                : lm.distributorMatches
                  ? "Aligned"
                  : "Mismatch"}
            </span>
          </div>
        </div>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Cross-system route</div>
          {routeRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>{row.value}</span>
            </div>
          ))}
          {routeChecks.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {row.aligned == null ? "--" : row.aligned ? "Aligned" : "Mismatch"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default React.memo(DRIPTab);
