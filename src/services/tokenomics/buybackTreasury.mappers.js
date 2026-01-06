import { ethers } from "ethers";
import { explorerBaseFor } from "../../utils/explorer";

const DECIMALS = 18;
const PLACEHOLDER = "--";
const EXPLORER_BASE = explorerBaseFor(80002) || "https://amoy.polygonscan.com";

function _formatAmount(raw, decimals = DECIMALS) {
  if (raw === undefined || raw === null)
    return { display: PLACEHOLDER, numeric: null };
  try {
    const formatted = ethers.utils.formatUnits(raw, decimals);
    const numeric = Number(formatted);
    const display = Number.isFinite(numeric)
      ? numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : formatted;
    return { display, numeric: Number.isFinite(numeric) ? numeric : null };
  } catch (error) {
    console.warn("Buyback mapper format failed", error);
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

export function mapBuybackSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts ?? Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const buybackRaw = raw.buyback || {};
  const treasuryRaw = raw.treasury || {};

  const nativeBalance = _formatAmount(buybackRaw.nativeBalance);
  const biggiBalance = _formatAmount(buybackRaw.biggiBalance);
  const totalNativeSpent = _formatAmount(buybackRaw.totalNativeSpent);
  const totalNativeReceived = _formatAmount(buybackRaw.totalNativeReceived);
  const totalBiggiAcquired = _formatAmount(buybackRaw.totalBiggiAcquired);
  const tokenBalance = _formatAmount(buybackRaw.tokenBalance);

  const treasuryBiggi = _formatAmount(treasuryRaw.biggiBalance);
  const treasuryMatic = _formatAmount(treasuryRaw.maticBalance);
  const treasuryTokenBalance = _formatAmount(treasuryRaw.tokenBalance);
  const treasuryTotalReceived = _formatAmount(
    treasuryRaw.totalBiggiReceived || treasuryRaw.totalBiggiReceivedFromBuyback,
  );
  const treasuryMaticReceived = _formatAmount(treasuryRaw.totalMaticReceived);
  const treasuryMaticFromDistributor = _formatAmount(
    treasuryRaw.totalMaticReceivedFromDistributor,
  );

  const lastBuybackTs = Number(buybackRaw.lastBuyback || 0);
  const lastBuybackLabel = lastBuybackTs
    ? new Date(lastBuybackTs * 1000).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  const avgBuybackSize =
    totalNativeSpent.numeric != null &&
    totalBiggiAcquired.numeric != null &&
    totalBiggiAcquired.numeric > 0
      ? totalNativeSpent.numeric / totalBiggiAcquired.numeric
      : null;

  const statusLabel = buybackRaw.paused
    ? "Paused"
    : buybackRaw.autoBuybackEnabled
      ? "Auto"
      : "Manual";
  const statusTone = buybackRaw.paused
    ? "paused"
    : buybackRaw.autoBuybackEnabled
      ? "active"
      : "warning";

  return {
    ts,
    tsLabel,
    buyback: {
      address: buybackRaw.address,
      shortAddress: _shortAddress(buybackRaw.address),
      router: buybackRaw.router,
      routerShort: _shortAddress(buybackRaw.router),
      wrappedNative: buybackRaw.wrappedNative,
      dripLM: buybackRaw.dripLM,
      policy: buybackRaw.policy,
      autoBuybackEnabled: buybackRaw.autoBuybackEnabled,
      fallbackMinIntervalSec: buybackRaw.fallbackMinIntervalSec,
      fallbackSwapSlippageBps: buybackRaw.fallbackSwapSlippageBps,
      fallbackTxDeadlineSec: buybackRaw.fallbackTxDeadlineSec,
      lastBuybackLabel,
      nativeBalance: nativeBalance.display,
      nativeBalanceNumeric: nativeBalance.numeric,
      biggiBalance: biggiBalance.display,
      biggiBalanceNumeric: biggiBalance.numeric,
      totalNativeSpent: totalNativeSpent.display,
      totalNativeSpentNumeric: totalNativeSpent.numeric,
      totalNativeReceived: totalNativeReceived.display,
      totalBiggiAcquired: totalBiggiAcquired.display,
      totalBiggiAcquiredNumeric: totalBiggiAcquired.numeric,
      paused: !!buybackRaw.paused,
      tokenBalance: tokenBalance.display,
      tokenBalanceNumeric: tokenBalance.numeric,
      nativeOnChain: buybackRaw.nativeOnChain
        ? Number(utils.formatEther(buybackRaw.nativeOnChain))
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
      totalMaticReceived: treasuryMaticReceived.display,
      totalMaticFromDistributor: treasuryMaticFromDistributor.display,
      tokenBalance: treasuryTokenBalance.display,
      buybackAgent: treasuryRaw.buybackAgent,
      reserve: treasuryRaw.reserve,
      dripDistributor: treasuryRaw.dripDistributor,
      tokenRewards: treasuryRaw.tokenRewards,
    },
    derived: {
      statusLabel,
      statusTone,
      avgBuybackSize:
        avgBuybackSize != null ? avgBuybackSize.toFixed(4) : PLACEHOLDER,
    },
  };
}

export function mapBuybackSnapshotToFlowRows(snapshot) {
  if (!snapshot) return [];
  const treasuryTokenRewards = snapshot?.treasury?.tokenRewards;
  return [
    {
      label: "Native spent (buyback)",
      value: snapshot.buyback.totalNativeSpent,
      hint: snapshot.buyback.routerShort,
      segment: "buyback",
    },
    {
      label: "BIGGI acquired",
      value: snapshot.buyback.totalBiggiAcquired,
      segment: "buyback",
    },
    {
      label: "Treasury BIGGI balance",
      value: snapshot.treasury.biggiBalance,
      hint: snapshot.treasury.shortAddress,
      segment: "treasury",
    },
    {
      label: "Treasury native balance",
      value: snapshot.treasury.maticBalance,
      hint: _shortAddress(treasuryTokenRewards),
      href: _exploreHref(treasuryTokenRewards),
      segment: "treasury",
    },
  ];
}

export function mapBuybackHistoryToChartPoints(history = [], accessor) {
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
