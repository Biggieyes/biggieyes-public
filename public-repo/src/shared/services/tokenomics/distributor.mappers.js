import * as ethers from "ethers";

const DECIMALS = 18;
const PLACEHOLDER = "--";

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
    console.warn("Distributor mapper format failed", error);
    return { display: PLACEHOLDER, numeric: null };
  }
}

export function mapDistributorSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts ?? Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalReceived = _formatAmount(raw.totalReceived);
  const totalPending = _formatAmount(raw.totalPending);
  const pendingReserve = _formatAmount(raw.pendingReserve);
  const pendingBUYBACK = _formatAmount(raw.pendingBUYBACK ?? raw.pendingBUYBACKAgent);
  const pendingTreasury = _formatAmount(raw.pendingTreasury);
  const pendingCOLLECTIONREWARDS = _formatAmount(raw.pendingCOLLECTIONREWARDS);
  const pendingCOMMUNITYCENTER = _formatAmount(
    raw.pendingCOMMUNITYCENTER ?? raw.pendingCommunity,
  );

  return {
    ts,
    tsLabel,
    address: raw.address ?? raw.distributor ?? null,
    reserve: raw.reserve ?? null,
    BUYBACKAgent: raw.BUYBACKAgent ?? raw.buybackAgent ?? null,
    treasury: raw.treasury ?? null,
    COLLECTIONREWARDS: raw.COLLECTIONREWARDS ?? raw.collectionRewards ?? null,
    COMMUNITYCENTER: raw.COMMUNITYCENTER ?? raw.communityCenter ?? null,
    DRIPDistributor: raw.DRIPDistributor ?? null,
    totalReceived: totalReceived.display,
    totalReceivedNumeric: totalReceived.numeric,
    totalPending: totalPending.display,
    totalPendingNumeric: totalPending.numeric,
    pendingReserve: pendingReserve.display,
    pendingReserveNumeric: pendingReserve.numeric,
    pendingBUYBACK: pendingBUYBACK.display,
    pendingBUYBACKNumeric: pendingBUYBACK.numeric,
    pendingBUYBACKAgent: pendingBUYBACK.display,
    pendingTreasury: pendingTreasury.display,
    pendingTreasuryNumeric: pendingTreasury.numeric,
    pendingCOLLECTIONREWARDS: pendingCOLLECTIONREWARDS.display,
    pendingCOLLECTIONREWARDSNumeric: pendingCOLLECTIONREWARDS.numeric,
    pendingCOMMUNITYCENTER: pendingCOMMUNITYCENTER.display,
    pendingCOMMUNITYCENTERNumeric: pendingCOMMUNITYCENTER.numeric,
    pendingCommunity: pendingCOMMUNITYCENTER.display,
    communityPoolBalance: pendingCOMMUNITYCENTER.display,
  };
}
