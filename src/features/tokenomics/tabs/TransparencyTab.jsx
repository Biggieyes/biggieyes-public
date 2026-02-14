import * as React from "react";
import { formatEther, formatUnits } from "ethers";
import Card from "../components/Card.jsx";
import { fmtVal } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";

const fmtNum = (value, digits = 4) => {
  if (value == null) return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return "--";
  return num.toLocaleString("en-US", { maximumFractionDigits: digits });
};

const toNativeNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  try {
    return Number(formatEther(value));
  } catch {
    return null;
  }
};

const toTokenNumber = (value, decimals = 18) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  try {
    return Number(formatUnits(value, decimals));
  } catch {
    return null;
  }
};

const formatNative = (value) => {
  const num = toNativeNumber(value);
  return num == null ? "--" : `${num.toFixed(4)} POL`;
};

const formatToken = (value, decimals = 18) => {
  const num = toTokenNumber(value, decimals);
  return num == null ? "--" : `${num.toFixed(4)} BIGGI`;
};

const toCsv = (rows) => {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (value) => {
    if (value == null) return "";
    const raw = String(value);
    return raw.includes(",") || raw.includes("\n") || raw.includes('"')
      ? `"${raw.replace(/"/g, '""')}"`
      : raw;
  };
  const header = keys.join(",");
  const lines = rows.map((row) => keys.map((k) => escape(row[k])).join(","));
  return [header, ...lines].join("\n");
};

const download = (filename, content, type = "text/plain") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildTimeline = ({
  buybackHistory = [],
  dripHistory = [],
  liquidityHistory = [],
  distributorHistory = [],
  tokenDexHistory = [],
}) => {
  const items = [];

  buybackHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "BUYBACK",
      metricA: "Spent POL",
      valueA: fmtNum(entry?.BUYBACK?.totalNativeSpentNumeric ?? entry?.BUYBACK?.totalNativeSpent, 4),
      metricB: "Acquired BIGGI",
      valueB: fmtNum(entry?.BUYBACK?.totalBiggiAcquiredNumeric ?? entry?.BUYBACK?.totalBiggiAcquired, 4),
    });
  });

  dripHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "DRIP",
      metricA: "Available BIGGI",
      valueA: fmtNum(entry?.distributor?.availableNumeric ?? entry?.distributor?.availableTokens, 4),
      metricB: "LM POL",
      valueB: fmtNum(entry?.DRIPLM?.nativeBalanceNumeric ?? entry?.DRIPLM?.nativeBalance, 4),
    });
  });

  liquidityHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "LIQUIDITY",
      metricA: "LP Locked",
      valueA: fmtNum(entry?.vault?.totalLpLockedNumeric ?? entry?.vault?.totalLpLocked, 4),
      metricB: "Reserve POL",
      valueB: fmtNum(entry?.reserve?.maticBalanceNumeric ?? entry?.reserve?.maticBalance, 4),
    });
  });

  distributorHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "DISTRIBUTOR",
      metricA: "Total Received",
      valueA: fmtNum(entry?.totalReceivedNumeric ?? entry?.totalReceived, 4),
      metricB: "Pending",
      valueB: fmtNum(entry?.totalPendingNumeric ?? entry?.totalPending, 4),
    });
  });

  tokenDexHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "DEX",
      metricA: "POL / BIGGI",
      valueA: fmtNum(entry?.derived?.priceNativePerToken ?? entry?.derived?.priceNativePerTokenNumeric, 6),
      metricB: "LP Supply",
      valueB: fmtNum(entry?.dex?.pair?.lpTotalSupply ?? entry?.dex?.pair?.totalSupplyNumeric, 2),
    });
  });

  return items.sort((a, b) => b.ts - a.ts).slice(0, 20);
};

const buildAllocationRows = (flowSnapshot, distributorSnapshot) => {
  const splits = flowSnapshot?.intendedSplits?.nativeFromMint || {};
  const total = distributorSnapshot?.totalReceivedNumeric ?? null;
  if (!total) return [];

  const toAmount = (bps) =>
    Number.isFinite(Number(bps)) ? (Number(total) * Number(bps)) / 10000 : null;

  return [
    {
      bucket: "CollectionRewards",
      target: toAmount(splits.collectionRewardsBps),
      actual: distributorSnapshot?.pendingCOLLECTIONREWARDSNumeric ?? null,
    },
    {
      bucket: "Reserve",
      target: toAmount(splits.reserveBps),
      actual: distributorSnapshot?.pendingReserveNumeric ?? null,
    },
    {
      bucket: "Buyback",
      target: toAmount(splits.buybackBps),
      actual: distributorSnapshot?.pendingBUYBACKNumeric ?? null,
    },
    {
      bucket: "Community",
      target: toAmount(splits.communityCenterBps),
      actual: distributorSnapshot?.pendingCOMMUNITYCENTERNumeric ?? null,
    },
    {
      bucket: "Treasury",
      target: toAmount(splits.treasuryBps),
      actual: distributorSnapshot?.pendingTreasuryNumeric ?? null,
    },
  ];
};

export default function TransparencyTab({
  flowSnapshot,
  policySnapshot,
  distributorSnapshot,
  buybackSnapshot,
  dripSnapshot,
  liquiditySnapshot,
  tokenDexSnapshot,
  buybackHistory,
  dripHistory,
  liquidityHistory,
  distributorHistory,
  tokenDexHistory,
}) {
  const timeline = React.useMemo(
    () =>
      buildTimeline({
        buybackHistory,
        dripHistory,
        liquidityHistory,
        distributorHistory,
        tokenDexHistory,
      }),
    [buybackHistory, dripHistory, liquidityHistory, distributorHistory, tokenDexHistory],
  );

  const allocationRows = React.useMemo(
    () => buildAllocationRows(flowSnapshot, distributorSnapshot),
    [flowSnapshot, distributorSnapshot],
  );

  const balanceSheet = React.useMemo(() => {
    const tokenDecimals =
      tokenDexSnapshot?.token?.decimals ??
      flowSnapshot?.tokenMeta?.decimals ??
      18;

    const nativeLive = flowSnapshot?.liveBalances?.native || {};
    const tokenLive = flowSnapshot?.liveBalances?.token || {};
    const tokenBalances = tokenDexSnapshot?.token?.balances || {};

    const rows = [
      {
        label: "Reserve",
        native:
          liquiditySnapshot?.reserve?.maticBalanceNumeric ??
          nativeLive.reserve ??
          null,
        token:
          tokenBalances.reserveNumeric ??
          tokenLive.reserve ??
          null,
      },
      {
        label: "Treasury",
        native:
          buybackSnapshot?.treasury?.maticBalanceNumeric ??
          nativeLive.treasury ??
          null,
        token:
          tokenBalances.treasuryNumeric ??
          buybackSnapshot?.treasury?.biggiBalanceNumeric ??
          tokenLive.treasury ??
          null,
      },
      {
        label: "Buyback Agent",
        native:
          buybackSnapshot?.BUYBACK?.nativeBalanceNumeric ??
          nativeLive.buyback ??
          null,
        token:
          buybackSnapshot?.BUYBACK?.biggiBalanceNumeric ??
          tokenLive.buyback ??
          null,
      },
      {
        label: "Community Center",
        native: nativeLive.communityCenter ?? null,
        token: null,
      },
      {
        label: "Collection Rewards",
        native: nativeLive.collectionRewards ?? null,
        token: null,
      },
      {
        label: "Token Rewards",
        native: null,
        token:
          tokenBalances.tokenREWARDSNumeric ??
          tokenLive.tokenRewards ??
          null,
      },
      {
        label: "DRIP Distributor",
        native: null,
        token:
          tokenBalances.DRIPDistributorNumeric ??
          tokenLive.dripDistributor ??
          null,
      },
      {
        label: "Liquidity Vault",
        native: null,
        token: tokenBalances.liquidityVaultNumeric ?? null,
      },
    ];

    const totals = rows.reduce(
      (acc, row) => {
        const nativeNum = toNativeNumber(row.native);
        const tokenNum = toTokenNumber(row.token, tokenDecimals);
        if (nativeNum != null) acc.native += nativeNum;
        if (tokenNum != null) acc.token += tokenNum;
        return acc;
      },
      { native: 0, token: 0 },
    );

    return { rows, totals, tokenDecimals };
  }, [flowSnapshot, tokenDexSnapshot, buybackSnapshot, liquiditySnapshot]);

  const allocationExport = React.useMemo(
    () =>
      allocationRows.map((row) => ({
        bucket: row.bucket,
        target_pol: row.target ?? "--",
        pending_pol: row.actual ?? "--",
      })),
    [allocationRows],
  );

  const snapshotExport = React.useMemo(
    () => ({
      ts: Date.now(),
      flow: flowSnapshot || null,
      distributor: distributorSnapshot || null,
      buyback: buybackSnapshot || null,
      drip: dripSnapshot || null,
      liquidity: liquiditySnapshot || null,
      tokenDex: tokenDexSnapshot || null,
    }),
    [flowSnapshot, distributorSnapshot, buybackSnapshot, dripSnapshot, liquiditySnapshot, tokenDexSnapshot],
  );

  return (
    <div className={styles.ecoFlowGrid}>
      <Card
        title="POLICY & PARAMS"
        subtitle="Active policy configuration (view-only)"
      >
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Policy snapshot</div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Buybacks paused</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.buybacksPaused ? "Yes" : "No"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Swap slippage</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.swapSlippageBps != null
                ? `${policySnapshot.policy.swapSlippageBps} bps`
                : "--"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Tx deadline</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.txDeadlineSec != null
                ? `${policySnapshot.policy.txDeadlineSec} s`
                : "--"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Min buyback interval</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.minBuybackInterval != null
                ? `${policySnapshot.policy.minBuybackInterval} s`
                : "--"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Max daily buyback</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.maxDailyBuybackNative != null
                ? formatNative(policySnapshot.policy.maxDailyBuybackNative)
                : "--"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Used today</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.usedToday != null
                ? formatNative(policySnapshot.policy.usedToday)
                : "--"}
            </span>
          </div>
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Day index</span>
            <span className={styles.ecoTableValue}>
              {policySnapshot?.policy?.dayIndex ?? "--"}
            </span>
          </div>
        </div>
      </Card>

      <Card
        title="BALANCE SHEET"
        subtitle="Unified reserves across contracts (native + BIGGI)"
      >
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Current balances</div>
          {balanceSheet.rows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {formatNative(row.native)} · {formatToken(row.token, balanceSheet.tokenDecimals)}
              </span>
            </div>
          ))}
          <div className={styles.ecoTableRow}>
            <span className={styles.ecoTableLabel}>Total</span>
            <span className={styles.ecoTableValue}>
              {fmtVal(balanceSheet.totals.native, "POL")} · {fmtVal(balanceSheet.totals.token, "BIGGI")}
            </span>
          </div>
        </div>
      </Card>

      <Card
        title="ALLOCATION vs ACTUAL"
        subtitle="Target split from Distributor total received vs current pending buckets"
      >
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Distributor split health (POL)</div>
          {allocationRows.length ? (
            allocationRows.map((row) => (
              <div key={row.bucket} className={styles.ecoTableRow}>
                <span className={styles.ecoTableLabel}>{row.bucket}</span>
                <span className={styles.ecoTableValue}>
                  Target {fmtVal(row.target, "POL")} · Pending {fmtVal(row.actual, "POL")}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>No distributor totals yet</span>
              <span className={styles.ecoTableValue}>--</span>
            </div>
          )}
        </div>
        <div className={styles.ecoTables}>
          <button
            className="biggi-button"
            type="button"
            onClick={() => download("allocation-vs-actual.csv", toCsv(allocationExport), "text/csv")}
          >
            Export CSV
          </button>
          <button
            className="biggi-button"
            type="button"
            onClick={() =>
              download("ecosystem-snapshot.json", JSON.stringify(snapshotExport, null, 2), "application/json")
            }
          >
            Export Snapshot JSON
          </button>
        </div>
      </Card>

      <Card title="FUNDS FLOW TIMELINE" subtitle="Recent on-chain snapshots merged across subsystems">
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Latest updates</div>
          {timeline.length ? (
            timeline.map((row, idx) => (
              <div key={`${row.type}-${row.ts}-${idx}`} className={styles.ecoTableRow}>
                <span className={styles.ecoTableLabel}>
                  {row.tsLabel} · {row.type}
                </span>
                <span className={styles.ecoTableValue}>
                  {row.metricA}: {row.valueA} | {row.metricB}: {row.valueB}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>No data yet</span>
              <span className={styles.ecoTableValue}>--</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
