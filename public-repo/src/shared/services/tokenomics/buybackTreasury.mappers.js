import * as ethers from "ethers";
import { explorerBaseFor } from "../../utils/explorer";
import { formatMappedNative, formatMappedToken } from "./amountFormatters.js";

const DECIMALS = 18;
const PLACEHOLDER = "--";
const EXPLORER_BASE = explorerBaseFor(137) || "https://polygonscan.com";

function _shortAddress(address = "") {
  if (!address) return PLACEHOLDER;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function _isAddress(address) {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

function _exploreHref(address) {
  if (!_isAddress(address)) return null;
  return `${EXPLORER_BASE}/address/${address}`;
}

export function mapBUYBACKSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts ?? Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const BUYBACKRaw = raw.BUYBACK || {};
  const treasuryRaw = raw.treasury || {};

  const nativeBalance = formatMappedNative(
    BUYBACKRaw.nativeBalance,
    4,
    PLACEHOLDER,
  );
  const biggiBalance = formatMappedToken(
    BUYBACKRaw.biggiBalance,
    DECIMALS,
    2,
    PLACEHOLDER,
  );
  const totalNativeSpent = formatMappedNative(
    BUYBACKRaw.totalNativeSpent,
    4,
    PLACEHOLDER,
  );
  const totalNativeReceived = formatMappedNative(
    BUYBACKRaw.totalNativeReceived,
    4,
    PLACEHOLDER,
  );
  const totalBiggiAcquired = formatMappedToken(
    BUYBACKRaw.totalBiggiAcquired,
    DECIMALS,
    2,
    PLACEHOLDER,
  );
  const tokenBalance = formatMappedToken(
    BUYBACKRaw.tokenBalance,
    DECIMALS,
    2,
    PLACEHOLDER,
  );
  const keeperThreshold = formatMappedNative(
    BUYBACKRaw.keeperThreshold,
    4,
    PLACEHOLDER,
  );

  const treasuryBiggi = formatMappedToken(
    treasuryRaw.biggiBalance,
    DECIMALS,
    2,
    PLACEHOLDER,
  );
  const treasuryMatic = formatMappedNative(
    treasuryRaw.maticBalance,
    4,
    PLACEHOLDER,
  );
  const treasuryTokenBalance = formatMappedToken(
    treasuryRaw.tokenBalance,
    DECIMALS,
    2,
    PLACEHOLDER,
  );
  const treasuryTotalReceived = formatMappedToken(
    treasuryRaw.totalBiggiReceived || treasuryRaw.totalBiggiReceivedFromBUYBACK,
    DECIMALS,
    2,
    PLACEHOLDER,
  );
  const treasuryMaticReceived = formatMappedNative(
    treasuryRaw.totalMaticReceived,
    4,
    PLACEHOLDER,
  );
  const treasuryMaticFromDistributor = formatMappedNative(
    treasuryRaw.totalMaticReceivedFromDistributor,
    4,
    PLACEHOLDER,
  );

  const lastBUYBACKTs = Number(BUYBACKRaw.lastBUYBACK || 0);
  const lastBUYBACKLabel = lastBUYBACKTs
    ? new Date(lastBUYBACKTs * 1000).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  const avgBUYBACKSize =
    totalNativeSpent.numeric != null &&
    totalBiggiAcquired.numeric != null &&
    totalBiggiAcquired.numeric > 0
      ? totalNativeSpent.numeric / totalBiggiAcquired.numeric
      : null;

  const statusLabel = BUYBACKRaw.paused
    ? "Paused"
    : BUYBACKRaw.autoBUYBACKEnabled
      ? "Auto"
      : "Manual";
  const statusTone = BUYBACKRaw.paused
    ? "paused"
    : BUYBACKRaw.autoBUYBACKEnabled
      ? "active"
      : "warning";

  return {
    ts,
    tsLabel,
    BUYBACK: {
      address: BUYBACKRaw.address,
      shortAddress: _shortAddress(BUYBACKRaw.address),
      router: BUYBACKRaw.router,
      routerShort: _shortAddress(BUYBACKRaw.router),
      wrappedNative: BUYBACKRaw.wrappedNative,
      DRIPLM: BUYBACKRaw.DRIPLM,
      POLICY: BUYBACKRaw.POLICY,
      autoBUYBACKEnabled: BUYBACKRaw.autoBUYBACKEnabled,
      fallbackMinIntervalSec: BUYBACKRaw.fallbackMinIntervalSec,
      fallbackSwapSlippageBps: BUYBACKRaw.fallbackSwapSlippageBps,
      fallbackTxDeadlineSec: BUYBACKRaw.fallbackTxDeadlineSec,
      keeperProxy: BUYBACKRaw.keeperProxy,
      keeperProxyShort: _shortAddress(BUYBACKRaw.keeperProxy),
      keeperProxyPaused: BUYBACKRaw.keeperProxyPaused ?? null,
      keeperThreshold: keeperThreshold.display,
      keeperThresholdNumeric: keeperThreshold.numeric,
      keeperAllowedCaller: BUYBACKRaw.keeperAllowedCaller,
      keeperAllowedCallerShort: _shortAddress(BUYBACKRaw.keeperAllowedCaller),
      keeperAgent: BUYBACKRaw.keeperAgent,
      lastBUYBACKLabel,
      nativeBalance: nativeBalance.display,
      nativeBalanceNumeric: nativeBalance.numeric,
      biggiBalance: biggiBalance.display,
      biggiBalanceNumeric: biggiBalance.numeric,
      totalNativeSpent: totalNativeSpent.display,
      totalNativeSpentNumeric: totalNativeSpent.numeric,
      totalNativeReceived: totalNativeReceived.display,
      totalNativeReceivedNumeric: totalNativeReceived.numeric,
      totalBiggiAcquired: totalBiggiAcquired.display,
      totalBiggiAcquiredNumeric: totalBiggiAcquired.numeric,
      paused: !!BUYBACKRaw.paused,
      tokenBalance: tokenBalance.display,
      tokenBalanceNumeric: tokenBalance.numeric,
      nativeOnChain: BUYBACKRaw.nativeOnChain
        ? Number(ethers.formatEther(BUYBACKRaw.nativeOnChain))
        : null,
    },
    treasury: {
      address: treasuryRaw.address,
      shortAddress: _shortAddress(treasuryRaw.address),
      biggiBalance: treasuryBiggi.display,
      biggiBalanceNumeric: treasuryBiggi.numeric,
      maticBalance: treasuryMatic.display,
      maticBalanceNumeric: treasuryMatic.numeric,
      totalBiggiReceived: treasuryTotalReceived.display,
      totalBiggiReceivedNumeric: treasuryTotalReceived.numeric,
      totalMaticReceived: treasuryMaticReceived.display,
      totalMaticReceivedNumeric: treasuryMaticReceived.numeric,
      totalMaticFromDistributor: treasuryMaticFromDistributor.display,
      tokenBalance: treasuryTokenBalance.display,
      BUYBACKAgent: treasuryRaw.BUYBACKAgent,
      reserve: treasuryRaw.reserve,
      DRIPDistributor: treasuryRaw.DRIPDistributor,
      tokenREWARDS: treasuryRaw.tokenREWARDS,
    },
    derived: {
      statusLabel,
      statusTone,
      avgBUYBACKSize:
        avgBUYBACKSize != null ? avgBUYBACKSize.toFixed(4) : PLACEHOLDER,
    },
  };
}

export function mapBUYBACKSnapshotToFLOWRows(snapshot) {
  if (!snapshot) return [];
  const treasuryTokenREWARDS = snapshot?.treasury?.tokenREWARDS;
  return [
    {
      label: "Native spent (BUYBACK)",
      value: snapshot.BUYBACK.totalNativeSpent,
      hint: snapshot.BUYBACK.routerShort,
      segment: "BUYBACK",
    },
    {
      label: "BIGGI acquired",
      value: snapshot.BUYBACK.totalBiggiAcquired,
      segment: "BUYBACK",
    },
    {
      label: "Treasury BIGGI received",
      value: snapshot.treasury.totalBiggiReceived,
      hint: snapshot.treasury.shortAddress,
      segment: "treasury",
    },
    {
      label: "Treasury native balance",
      value: snapshot.treasury.maticBalance,
      hint: _shortAddress(treasuryTokenREWARDS),
      href: _exploreHref(treasuryTokenREWARDS),
      segment: "treasury",
    },
  ];
}

export function mapBUYBACKHistoryToChartPoints(history = [], accessor) {
  if (!accessor) return [];
  return history
    .map((entry) => {
      const value = accessor(entry);
      return { label: entry?.tsLabel, value };
    })
    .filter(
      (point) =>
        typeof point.value === "number" && Number.isFinite(point.value),
    );
}
