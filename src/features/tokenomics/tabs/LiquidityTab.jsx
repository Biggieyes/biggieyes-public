import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import AddressLine from "../components/AddressLine.jsx";
import { explorerLink, fmtDate, fmtLp, fmtVal, shortAddr } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";
import "./LiquidityTab.css";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const toNumberLoose = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const formatRange = (min, max, symbol = "POL") => {
  if (min == null || max == null) return "--";
  return `${fmtVal(min, symbol)} - ${fmtVal(max, symbol)}`;
};

const amountModeLabel = (mode) => {
  if (mode == null) return "--";
  if (Number(mode) === 0) return "Dynamic";
  if (Number(mode) === 1) return "Fixed";
  if (Number(mode) === 2) return "Percent";
  return String(mode);
};

function LiquidityTab({
  tabBusy,
  onRefresh,
  liquidityHistory,
  lmView,
  reserve,
  treasury,
  snapshotTsLabel,
  chainStatus,
  userRole,
  lmChainBalances,
  lmTokenPct,
  lmSlippageBps,
  lmDeadlineSec,
  lmKeeperAddress,
  lmAddress,
  lmVaultAddress,
  manager,
  automation,
  keeperProxy,
  branchReader,
  warnings,
}) {
  if (tabBusy) {
    return <div className="liquidity-tab">Loading reserve / LM snapshot...</div>;
  }

  const historyBundle = Array.isArray(liquidityHistory)
    ? { vaultSeries: liquidityHistory }
    : liquidityHistory || {};
  const vaultSeries = historyBundle?.vaultSeries || [];
  const reserveSeries = historyBundle?.reserveSeries || [];
  const waitingSeries = historyBundle?.waitingSeries || [];
  const refillSeries = historyBundle?.refillSeries || [];
  const quotaSeries = historyBundle?.quotaSeries || [];

  const lpLocked = lmView?.lpBalance ?? reserve?.lpBalanceInVault ?? null;
  const reservePol = lmView?.reserveMatic ?? reserve?.maticBalance ?? null;
  const reserveBiggi = lmView?.reserveBiggi ?? reserve?.biggiBalance ?? null;
  const waitingBiggi = reserve?.waitingBiggi ?? null;
  const dexRefillBiggi = lmView?.dexRefillBiggi ?? reserve?.dexRefillBiggi ?? null;
  const totalReceivedPol = reserve?.totalMaticReceived ?? null;
  const treasuryPol =
    treasury?.nativeBalanceNumeric ?? toNumberLoose(treasury?.nativeBalance);
  const treasuryBiggi =
    treasury?.tokenBalanceNumeric ?? toNumberLoose(treasury?.tokenBalance);
  const quotaUsed =
    automation?.usedTodayNumeric ?? toNumberLoose(automation?.usedToday);
  const quotaCap =
    automation?.dailyQuotaPolNumeric ?? toNumberLoose(automation?.dailyQuotaPol);
  const quotaPct =
    quotaUsed != null && quotaCap != null && quotaCap > 0
      ? (quotaUsed / quotaCap) * 100
      : null;
  const computedAmount =
    keeperProxy?.computedAmountNumeric ?? toNumberLoose(keeperProxy?.computedAmount);
  const computedReserve =
    keeperProxy?.computedReservePolNumeric ??
    toNumberLoose(keeperProxy?.computedReservePol);

  const upkeepStatus =
    keeperProxy?.upkeepNeeded == null
      ? "--"
      : keeperProxy.upkeepNeeded
        ? "Ready"
        : "Idle";
  const upkeepTone =
    keeperProxy?.upkeepNeeded == null
      ? "idle"
      : keeperProxy.upkeepNeeded
        ? "active"
        : "warning";
  const wiringIssues = [
    automation?.wiredOk === false,
    branchReader?.isStale === true,
    branchReader?.wiredOk === false,
    reserve?.pairWhitelisted === false,
  ].filter(Boolean).length;
  const protocolStatusLabel =
    automation?.paused === true || keeperProxy?.paused === true
      ? "Paused"
      : wiringIssues > 0
        ? "Needs review"
        : "Operational";
  const protocolStatusTone =
    automation?.paused === true || keeperProxy?.paused === true
      ? "paused"
      : wiringIssues > 0
        ? "warning"
        : "active";
  const routingStatusLabel = branchReader?.isStale
    ? "Legacy branch"
    : automation?.wiredOk === false || branchReader?.wiredOk === false
      ? "Wiring mismatch"
      : reserve?.pairWhitelisted === false
        ? "Pair blocked"
        : "Aligned";
  const routingStatusTone = branchReader?.isStale
    ? "warning"
    : automation?.wiredOk === false ||
        branchReader?.wiredOk === false ||
        reserve?.pairWhitelisted === false
      ? "warning"
      : "active";

  const stats = [
    {
      label: "LP locked",
      value: fmtLp(lpLocked),
      hint: hasValue(lmVaultAddress) ? shortAddr(lmVaultAddress) : "Liquidity vault",
    },
    {
      label: "Reserve POL",
      value: fmtVal(reservePol, "POL"),
      hint: hasValue(totalReceivedPol)
        ? `Received ${fmtVal(totalReceivedPol, "POL")}`
        : "Reserve balance",
      tone: "native",
    },
    {
      label: "Reserve BIGGI",
      value: fmtVal(reserveBiggi, "BIGGI"),
      hint: hasValue(lmAddress) ? shortAddr(lmAddress) : "Reserve inventory",
      tone: "token",
    },
    {
      label: "Waiting -> LM",
      value: fmtVal(waitingBiggi, "BIGGI"),
      hint: "Pending liquidity move",
      tone: "token",
    },
    {
      label: "DEX refill",
      value: fmtVal(dexRefillBiggi, "BIGGI"),
      hint: "Reserved for pair support",
      tone: "token",
    },
    {
      label: "Used today",
      value: fmtVal(quotaUsed, "POL"),
      hint:
        quotaCap != null
          ? `Cap ${fmtVal(quotaCap, "POL")}${quotaPct != null ? ` | ${quotaPct.toFixed(1)}%` : ""}`
          : "Daily automation usage",
      tone: "native",
    },
    {
      label: "Next upkeep",
      value: fmtVal(computedAmount, "POL"),
      hint:
        computedReserve != null
          ? `Reserve after ${fmtVal(computedReserve, "POL")}`
          : upkeepStatus,
      tone: "native",
    },
    {
      label: "Treasury POL",
      value: fmtVal(treasuryPol, "POL"),
      hint:
        treasuryBiggi != null
          ? `BIGGI ${fmtVal(treasuryBiggi, "BIGGI")}`
          : "Treasury snapshot",
      tone: "native",
    },
  ];

  const reserveRows = [
    {
      label: "Connected role",
      value: userRole || (chainStatus?.account ? "Connected" : "Viewer"),
    },
    {
      label: "Chain",
      value: chainStatus?.chainId ? `chainId ${chainStatus.chainId}` : "--",
    },
    {
      label: "Pair whitelisted",
      value:
        reserve?.pairWhitelisted == null
          ? "--"
          : reserve.pairWhitelisted
            ? "Yes"
            : "No",
    },
    {
      label: "Reserve POL received",
      value: fmtVal(totalReceivedPol, "POL"),
    },
    {
      label: "BIGGI across R / LM / LV",
      value: `${fmtVal(lmChainBalances?.reserve, "R")} | ${fmtVal(lmChainBalances?.liquidityManager, "LM")} | ${fmtVal(lmChainBalances?.liquidityVault, "LV")}`,
    },
    {
      label: "Treasury BIGGI",
      value: fmtVal(treasuryBiggi, "BIGGI"),
    },
    {
      label: "Warnings",
      value: warnings?.length ? warnings.join(" | ") : "--",
      tone: warnings?.length ? "warn" : undefined,
    },
  ];

  const configRows = [
    {
      label: "LM token %",
      value: lmTokenPct != null ? `${lmTokenPct}%` : "--",
    },
    {
      label: "LM slippage",
      value: lmSlippageBps != null ? `${lmSlippageBps} bps` : "--",
    },
    {
      label: "LM deadline",
      value: lmDeadlineSec != null ? `${lmDeadlineSec} s` : "--",
    },
    {
      label: "Cooldown",
      value:
        automation?.cooldownSec != null ? `${automation.cooldownSec} s` : "--",
    },
    {
      label: "Per tx range",
      value: formatRange(
        automation?.minPolPerTxNumeric,
        automation?.maxPolPerTxNumeric,
      ),
    },
    {
      label: "Min reserve",
      value: fmtVal(
        keeperProxy?.minReservePolNumeric ?? keeperProxy?.minReservePol,
        "POL",
      ),
    },
    {
      label: "Amount mode",
      value: amountModeLabel(keeperProxy?.amountMode),
    },
    {
      label: "Fixed amount / percent",
      value:
        keeperProxy?.fixedAmountNumeric != null || keeperProxy?.percentBps != null
          ? `${fmtVal(keeperProxy?.fixedAmountNumeric, "POL")} / ${keeperProxy?.percentBps ?? "--"} bps`
          : "--",
    },
  ];

  const automationRows = [
    {
      label: "Automation paused",
      value:
        automation?.paused == null ? "--" : automation.paused ? "Yes" : "No",
    },
    {
      label: "Keeper paused",
      value:
        keeperProxy?.paused == null ? "--" : keeperProxy.paused ? "Yes" : "No",
    },
    {
      label: "Upkeep status",
      value: upkeepStatus,
    },
    {
      label: "Upkeep note",
      value: keeperProxy?.upkeepReason || "--",
    },
    {
      label: "Allowed caller",
      value: shortAddr(keeperProxy?.allowedCaller),
    },
    {
      label: "Last run",
      value: automation?.lastRun ? fmtDate(automation.lastRun) : "--",
    },
    {
      label: "Last perform",
      value:
        keeperProxy?.lastPerformTs != null
          ? fmtDate(keeperProxy.lastPerformTs)
          : "--",
    },
    {
      label: "Branch reader status",
      value: routingStatusLabel,
    },
  ];

  const routingSeries =
    waitingSeries.length > 0 ? waitingSeries : refillSeries;
  const routingTitle =
    waitingSeries.length > 0 ? "Waiting BIGGI" : "DEX refill BIGGI";
  const routingCopy =
    waitingSeries.length > 0
      ? "BIGGI queued inside reserve before the next liquidity move."
      : "BIGGI set aside to refill the DEX pair when needed.";

  return (
    <section className="liquidity-tab">
      <header className="liquidity-tab__header">
        <div className="liquidity-tab__headline">
          <h3>Reserve / LM / Vault</h3>
          <p>
            Reserve balances, liquidity automation, keeper readiness, and vault
            exposure in one control surface.
          </p>
        </div>
        <div className="liquidity-tab__header-meta">
          <span
            className={`liquidity-tab__badge liquidity-tab__badge--${protocolStatusTone}`}
          >
            {protocolStatusLabel}
          </span>
          <span
            className={`liquidity-tab__badge liquidity-tab__badge--${routingStatusTone}`}
          >
            {routingStatusLabel}
          </span>
          <span
            className={`liquidity-tab__badge liquidity-tab__badge--${upkeepTone}`}
          >
            Upkeep {upkeepStatus}
          </span>
          <span className="liquidity-tab__timestamp">
            {snapshotTsLabel || "--"}
          </span>
          {typeof onRefresh === "function" ? (
            <button
              type="button"
              className="liquidity-tab__refresh"
              onClick={onRefresh}
            >
              Refresh
            </button>
          ) : null}
        </div>
      </header>

      <div className="liquidity-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>

      <div className="liquidity-tab__charts">
        <div className="liquidity-tab__chart">
          <h4>Vault LP locked</h4>
          <p>How much LP the vault currently holds over recent snapshots.</p>
          <LineChart points={vaultSeries} height={160} />
        </div>
        <div className="liquidity-tab__chart">
          <h4>Reserve POL</h4>
          <p>Native liquidity sitting in reserve before automation deploys it.</p>
          <LineChart points={reserveSeries} height={160} />
        </div>
        <div className="liquidity-tab__chart">
          <h4>{routingTitle}</h4>
          <p>{routingCopy}</p>
          <LineChart points={routingSeries} height={160} />
        </div>
        {quotaSeries.length ? (
          <div className="liquidity-tab__chart">
            <h4>Daily automation usage</h4>
            <p>POL spent by the orchestrator during the current rolling day.</p>
            <LineChart points={quotaSeries} height={160} />
          </div>
        ) : null}
      </div>

      <div className={styles.ecoTables}>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Reserve stack</div>
          {reserveRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span
                className={styles.ecoTableValue}
                style={row.tone === "warn" ? { color: "#ffd089" } : undefined}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>LM configuration</div>
          {configRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Contract wiring</div>
          <AddressLine
            label="Reserve"
            address={reserve?.reserveAddress}
            href={explorerLink(reserve?.reserveAddress)}
          />
          <AddressLine
            label="Liquidity Manager"
            address={lmAddress}
            href={explorerLink(lmAddress)}
          />
          <AddressLine
            label="Liquidity Vault"
            address={lmVaultAddress}
            href={explorerLink(lmVaultAddress)}
          />
          <AddressLine
            label="Keeper"
            address={lmKeeperAddress}
            href={explorerLink(lmKeeperAddress)}
          />
          <AddressLine
            label="Orchestrator"
            address={automation?.address}
            href={explorerLink(automation?.address)}
          />
          <AddressLine
            label="Router"
            address={manager?.router}
            href={explorerLink(manager?.router)}
          />
          <AddressLine
            label="Factory"
            address={manager?.factory}
            href={explorerLink(manager?.factory)}
          />
          <AddressLine
            label="Branch reader"
            address={branchReader?.address}
            href={explorerLink(branchReader?.address)}
          />
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Automation state</div>
          {automationRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>{row.value}</span>
            </div>
          ))}
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Configured reserve / LM</span>
            <span className={styles.ecoTableValue}>
              {shortAddr(branchReader?.configuredReserve)} /{" "}
              {shortAddr(branchReader?.configuredLM)}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Branch reserve / vault</span>
            <span className={styles.ecoTableValue}>
              {shortAddr(branchReader?.lmReserve)} / {shortAddr(branchReader?.lmVault)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default React.memo(LiquidityTab);
