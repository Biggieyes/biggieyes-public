import { toDisplayNumber } from "./amountFormatting.js";

export const buildRows = (entries, mapFn, limit = 12) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const mapped = entries.map(mapFn).filter(Boolean).reverse();
  const rows = [];
  let previousKey = null;

  for (const row of mapped) {
    const key = `${row.a}\u0000${row.b}`;
    if (key === previousKey) continue;
    rows.push(row);
    previousKey = key;
    if (rows.length >= limit) break;
  }

  return rows;
};

const fmtNum = (value, digits = 4) => {
  const num = toDisplayNumber(value);
  if (!Number.isFinite(num)) return "--";
  return num.toLocaleString("en-US", { maximumFractionDigits: digits });
};

export const buildTimeline = ({
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
      valueA: fmtNum(
        entry?.BUYBACK?.totalNativeSpentNumeric ??
          entry?.BUYBACK?.totalNativeSpent,
        4,
      ),
      metricB: "Acquired BIGGI",
      valueB: fmtNum(
        entry?.BUYBACK?.totalBiggiAcquiredNumeric ??
          entry?.BUYBACK?.totalBiggiAcquired,
        4,
      ),
    });
  });

  dripHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "DRIP",
      metricA: "Available BIGGI",
      valueA: fmtNum(
        entry?.distributor?.availableNumeric ??
          entry?.distributor?.availableTokens,
        4,
      ),
      metricB: "LM POL",
      valueB: fmtNum(
        entry?.DRIPLM?.nativeBalanceNumeric ?? entry?.DRIPLM?.nativeBalance,
        4,
      ),
    });
  });

  liquidityHistory.forEach((entry) => {
    items.push({
      ts: entry.ts ?? Date.now(),
      tsLabel: entry.tsLabel || "--",
      type: "LIQUIDITY",
      metricA: "LP Locked",
      valueA: fmtNum(
        entry?.vault?.totalLpLockedNumeric ?? entry?.vault?.totalLpLocked,
        4,
      ),
      metricB: "Reserve POL",
      valueB: fmtNum(
        entry?.reserve?.maticBalanceNumeric ?? entry?.reserve?.maticBalance,
        4,
      ),
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
      valueA: fmtNum(
        entry?.derived?.priceNativePerToken ??
          entry?.derived?.priceNativePerTokenNumeric,
        6,
      ),
      metricB: "LP Supply",
      valueB: fmtNum(
        entry?.dex?.pair?.lpTotalSupply ?? entry?.dex?.pair?.totalSupplyNumeric,
        2,
      ),
    });
  });

  const latestSignatureByType = new Map();
  return items
    .sort((a, b) => b.ts - a.ts)
    .filter((item) => {
      const signature = `${item.valueA}\u0000${item.valueB}`;
      if (latestSignatureByType.get(item.type) === signature) return false;
      latestSignatureByType.set(item.type, signature);
      return true;
    })
    .slice(0, 20);
};
