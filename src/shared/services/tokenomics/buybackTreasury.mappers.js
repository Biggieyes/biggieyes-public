import * as ethers from "ethers";
import { explorerBaseFor } from "../../utils/explorer";

const DECIMALS = 18;
const PLACEHOLDER = "--";
const EXPLORER_BASE = explorerBaseFor(80002) || "https://amoy.polygonscan.com";

function _formatAmount(raw, decimals = DECIMALS) {
  if (raw === undefined || raw === null)
    return { display: PLACEHOLDER, numeric: null };
  try {
    const formatted = ethers.formatUnits(raw, decimals);
    const numeric = Number(formatted);
    const display = Number.isFinite(numeric)
      ? numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : formatted;
    return { display, numeric: Number.isFinite(numeric) ? numeric : null };
  } catch (error) {
    console.warn("BUYBACK mapper format failed", error);
    return { display: PLACEHOLDER, numeric: null };
  }
}

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

  const nativeBalance = _formatAmount(BUYBACKRaw.nativeBalance);
  const biggiBalance = _formatAmount(BUYBACKRaw.biggiBalance);
  const totalNativeSpent = _formatAmount(BUYBACKRaw.totalNativeSpent);
  const totalNativeReceived = _formatAmount(BUYBACKRaw.totalNativeReceived);
  const totalBiggiAcquired = _formatAmount(BUYBACKRaw.totalBiggiAcquired);
  const tokenBalance = _formatAmount(BUYBACKRaw.tokenBalance);
  const keeperThreshold = _formatAmount(BUYBACKRaw.keeperThreshold);

  const treasuryBiggi = _formatAmount(treasuryRaw.biggiBalance);
  const treasuryMatic = _formatAmount(treasuryRaw.maticBalance);
  const treasuryTokenBalance = _formatAmount(treasuryRaw.tokenBalance);
  const treasuryTotalReceived = _formatAmount(
    treasuryRaw.totalBiggiReceived || treasuryRaw.totalBiggiReceivedFromBUYBACK,
  );
  const treasuryMaticReceived = _formatAmount(treasuryRaw.totalMaticReceived);
  const treasuryMaticFromDistributor = _formatAmount(
    treasuryRaw.totalMaticReceivedFromDistributor,
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






