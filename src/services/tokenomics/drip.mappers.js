import { ethers } from "ethers";

const DECIMALS = 18;
const PLACEHOLDER = "--";

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
    console.warn("Drip mapper formatter failed", error);
    return { display: PLACEHOLDER, numeric: null };
  }
}

function _shortAddress(address = "") {
  if (!address) return PLACEHOLDER;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function mapDripSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts ?? Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const distributorRaw = raw.distributor || {};
  const dripLMRaw = raw.dripLM || {};

  const cap = _formatAmount(distributorRaw.cap);
  const available = _formatAmount(distributorRaw.availableTokens);
  const capRemaining = _formatAmount(distributorRaw.capRemaining);
  const tokensPerMint = _formatAmount(distributorRaw.tokensPerMint);
  const totalClaimed = _formatAmount(distributorRaw.totalClaimed);
  const totalNotified = _formatAmount(distributorRaw.totalNotified);
  const totalTopUp = _formatAmount(distributorRaw.totalTopUp);
  const biggiBalance = _formatAmount(distributorRaw.tokenBalance);

  const nativeBalance = _formatAmount(dripLMRaw.nativeBalance);
  const lmBiggiBalance = _formatAmount(dripLMRaw.biggiBalance);

  const capNumeric = cap.numeric ?? null;
  const availableNumeric = available.numeric ?? null;
  const capRemainingNumeric = capRemaining.numeric ?? null;

  const availablePercent =
    capNumeric != null && capNumeric > 0 && availableNumeric != null
      ? (availableNumeric / capNumeric) * 100
      : null;
  const capRemainingPercent =
    capNumeric != null && capNumeric > 0 && capRemainingNumeric != null
      ? (capRemainingNumeric / capNumeric) * 100
      : null;

  const canSellNow =
    !distributorRaw.paused &&
    (capRemainingNumeric > 0 || availableNumeric > 0 || availablePercent > 0);
  const statusLabel = distributorRaw.paused
    ? "Paused"
    : canSellNow
      ? "Active"
      : "Waiting";
  const statusTone = distributorRaw.paused
    ? "paused"
    : canSellNow
      ? "active"
      : "warning";

  return {
    ts,
    tsLabel,
    distributor: {
      address: distributorRaw.address,
      shortAddress: _shortAddress(distributorRaw.address),
      cap: cap.display,
      capNumeric,
      capRemaining: capRemaining.display,
      capRemainingNumeric,
      availableTokens: available.display,
      availableNumeric,
      tokensPerMint: tokensPerMint.display,
      paused: !!distributorRaw.paused,
      statusLabel,
      statusTone,
      totalClaimed: totalClaimed.display,
      totalNotified: totalNotified.display,
      totalTopUp: totalTopUp.display,
      dripLM: distributorRaw.dripLM,
      dripLMShort: _shortAddress(distributorRaw.dripLM),
      treasury: distributorRaw.treasury,
      treasuryShort: _shortAddress(distributorRaw.treasury),
      tokenBalance: biggiBalance.display,
      tokenBalanceNumeric: biggiBalance.numeric,
    },
    dripLM: {
      address: dripLMRaw.address,
      shortAddress: _shortAddress(dripLMRaw.address),
      sellPct: dripLMRaw.sellPct ?? null,
      slippageBps: dripLMRaw.slippageBps ?? null,
      txDeadlineSec: dripLMRaw.txDeadlineSec ?? null,
      router: dripLMRaw.router,
      routerShort: _shortAddress(dripLMRaw.router),
      reserve: dripLMRaw.reserve,
      reserveShort: _shortAddress(dripLMRaw.reserve),
      nativeBalance: nativeBalance.display,
      nativeBalanceNumeric: nativeBalance.numeric,
      biggiBalance: lmBiggiBalance.display,
      biggiBalanceNumeric: lmBiggiBalance.numeric,
    },
    derived: {
      availablePercent:
        availablePercent != null
          ? `${availablePercent.toFixed(1)}%`
          : PLACEHOLDER,
      capRemainingPercent:
        capRemainingPercent != null
          ? `${capRemainingPercent.toFixed(1)}%`
          : PLACEHOLDER,
      canSellNow,
      statusLabel,
      statusTone,
    },
  };
}

export function mapDripSnapshotToFlowRows(snapshot) {
  if (!snapshot) return [];
  return [
    {
      label: "DripDistributor → DripLM (BIGGI)",
      value: snapshot.distributor.tokenBalance,
      hint: snapshot.distributor.dripLMShort,
      segment: "distributor",
    },
    {
      label: "DripLM → Reserve (native)",
      value: snapshot.dripLM.nativeBalance,
      hint: snapshot.dripLM.reserveShort,
      segment: "dripLM",
    },
  ];
}

export function mapDripHistoryToChartPoints(history = [], accessor) {
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
