import * as ethers from "ethers";

const DECIMALS = 18;
const PLACEHOLDER = "--";

function _normalizeBigNumberish(value) {
  if (value == null) return value;
  if (
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (value?._isBigNumber || value?.type === "BigNumber") {
    return value.toString();
  }
  if (typeof value?.toString === "function") return value.toString();
  return value;
}

function _formatAmount(raw, decimals = DECIMALS) {
  if (raw === undefined || raw === null)
    return { display: PLACEHOLDER, numeric: null };
  try {
    const formatted = ethers.formatUnits(_normalizeBigNumberish(raw), decimals);
    const numeric = Number(formatted);
    const display = Number.isFinite(numeric)
      ? numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : formatted;
    return { display, numeric: Number.isFinite(numeric) ? numeric : null };
  } catch (error) {
    console.warn("DRIP mapper formatter failed", error);
    return { display: PLACEHOLDER, numeric: null };
  }
}

function _shortAddress(address = "") {
  if (!address) return PLACEHOLDER;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function _shortHex(value = "") {
  if (!value) return PLACEHOLDER;
  const normalized = String(value);
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
}

function _sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export function mapDRIPSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts ?? Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const distributorRaw = raw.distributor || {};
  const DRIPLMRaw = raw.DRIPLM || {};
  const keeperRaw = raw.keeper || {};

  const cap = _formatAmount(distributorRaw.cap);
  const available = _formatAmount(distributorRaw.availableTokens);
  const capRemaining = _formatAmount(distributorRaw.capRemaining);
  const tokensPerMint = _formatAmount(distributorRaw.tokensPerMint);
  const totalClaimed = _formatAmount(distributorRaw.totalClaimed);
  const totalNotified = _formatAmount(distributorRaw.totalNotified);
  const totalTopUp = _formatAmount(distributorRaw.totalTopUp);
  const effectiveAvailable = _formatAmount(
    distributorRaw.effectiveAvailable ?? distributorRaw.getAvailable,
  );
  const totalReceived = _formatAmount(distributorRaw.totalReceived);
  const distributorBalance = _formatAmount(
    distributorRaw.balance ?? distributorRaw.tokenBalance,
  );
  const biggiBalance = _formatAmount(distributorRaw.tokenBalance);

  const nativeBalance = _formatAmount(DRIPLMRaw.nativeBalance);
  const lmBiggiBalance = _formatAmount(DRIPLMRaw.biggiBalance);
  const totalNativeForwarded = _formatAmount(DRIPLMRaw.totalNativeForwarded);
  const totalSoldTokens = _formatAmount(DRIPLMRaw.totalSoldTokens);

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
  const distributorTargetMatches =
    distributorRaw.targetMatches ??
    (distributorRaw.DRIPLM && DRIPLMRaw.address
      ? _sameAddress(distributorRaw.DRIPLM, DRIPLMRaw.address)
      : null);
  const keeperTargetMatches =
    keeperRaw.targetMatches ??
    (keeperRaw.dripLM && DRIPLMRaw.address
      ? _sameAddress(keeperRaw.dripLM, DRIPLMRaw.address)
      : null);
  const lmDistributorMatches =
    DRIPLMRaw.distributorMatches ??
    (DRIPLMRaw.distributor && distributorRaw.address
      ? _sameAddress(DRIPLMRaw.distributor, distributorRaw.address)
      : null);

  let automationStatusLabel = "Unknown";
  let automationStatusTone = "warning";
  if (keeperRaw.paused === true) {
    automationStatusLabel = "Keeper paused";
    automationStatusTone = "paused";
  } else if (
    distributorTargetMatches === false ||
    keeperTargetMatches === false ||
    lmDistributorMatches === false
  ) {
    automationStatusLabel = "Target mismatch";
    automationStatusTone = "warning";
  } else if (keeperRaw.upkeepNeeded === true) {
    automationStatusLabel = "Ready";
    automationStatusTone = "active";
  } else if (keeperRaw.upkeepNeeded === false) {
    automationStatusLabel = "Idle";
    automationStatusTone = "warning";
  }

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
      effectiveAvailable: effectiveAvailable.display,
      effectiveAvailableNumeric: effectiveAvailable.numeric,
      totalReceived: totalReceived.display,
      totalReceivedNumeric: totalReceived.numeric,
      DRIPLM: distributorRaw.DRIPLM,
      DRIPLMShort: _shortAddress(distributorRaw.DRIPLM),
      treasury: distributorRaw.treasury,
      treasuryShort: _shortAddress(distributorRaw.treasury),
      tokenBalance: biggiBalance.display,
      tokenBalanceNumeric: biggiBalance.numeric,
      balance: distributorBalance.display,
      balanceNumeric: distributorBalance.numeric,
      operator: distributorRaw.operator ?? null,
      operatorShort: _shortAddress(distributorRaw.operator),
      targetMatches: distributorTargetMatches,
    },
    DRIPLM: {
      address: DRIPLMRaw.address,
      shortAddress: _shortAddress(DRIPLMRaw.address),
      sellPct: DRIPLMRaw.sellPct ?? null,
      reserveShareBps: DRIPLMRaw.reserveShareBps ?? null,
      moderatorShareBps: DRIPLMRaw.moderatorShareBps ?? null,
      slippageBps: DRIPLMRaw.slippageBps ?? null,
      txDeadlineSec: DRIPLMRaw.txDeadlineSec ?? null,
      router: DRIPLMRaw.router,
      routerShort: _shortAddress(DRIPLMRaw.router),
      reserve: DRIPLMRaw.reserve,
      reserveShort: _shortAddress(DRIPLMRaw.reserve),
      moderatorCenter: DRIPLMRaw.moderatorCenter ?? null,
      moderatorCenterShort: _shortAddress(DRIPLMRaw.moderatorCenter),
      buybackAgent: DRIPLMRaw.buybackAgent ?? null,
      buybackAgentShort: _shortAddress(DRIPLMRaw.buybackAgent),
      nativeBalance: nativeBalance.display,
      nativeBalanceNumeric: nativeBalance.numeric,
      totalNativeForwarded: totalNativeForwarded.display,
      totalNativeForwardedNumeric: totalNativeForwarded.numeric,
      biggiBalance: lmBiggiBalance.display,
      biggiBalanceNumeric: lmBiggiBalance.numeric,
      totalSoldTokens: totalSoldTokens.display,
      totalSoldTokensNumeric: totalSoldTokens.numeric,
      distributor: DRIPLMRaw.distributor ?? null,
      distributorShort: _shortAddress(DRIPLMRaw.distributor),
      distributorMatches: lmDistributorMatches,
    },
    keeper: {
      address: keeperRaw.address,
      shortAddress: _shortAddress(keeperRaw.address),
      dripLM: keeperRaw.dripLM,
      dripLMShort: _shortAddress(keeperRaw.dripLM),
      paused: keeperRaw.paused ?? null,
      owner: keeperRaw.owner ?? null,
      ownerShort: _shortAddress(keeperRaw.owner),
      upkeepNeeded: keeperRaw.upkeepNeeded ?? null,
      performData: keeperRaw.performData ?? null,
      performDataShort: _shortHex(keeperRaw.performData),
      targetMatches: keeperTargetMatches,
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
      automationStatusLabel,
      automationStatusTone,
    },
  };
}

export function mapDRIPSnapshotToFLOWRows(snapshot) {
  if (!snapshot) return [];
  return [
    {
      label: "DRIPDistributor → DRIPLM (BIGGI)",
      value: snapshot.distributor.tokenBalance,
      hint: snapshot.distributor.DRIPLMShort,
      segment: "distributor",
    },
    {
      label: "DRIPLM → Reserve (native)",
      value: snapshot.DRIPLM.totalNativeForwarded || snapshot.DRIPLM.nativeBalance,
      hint: snapshot.DRIPLM.reserveShort,
      segment: "DRIPLM",
    },
  ];
}

export function mapDRIPHistoryToChartPoints(history = [], accessor) {
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



