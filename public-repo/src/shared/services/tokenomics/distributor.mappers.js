import { formatMappedNative } from "./amountFormatters.js";

const DECIMALS = 18;
const PLACEHOLDER = "--";

function _normalizeBigNumberish(raw) {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^-?\d+$/.test(trimmed) || /^-?0x[0-9a-f]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function _formatAmount(raw, decimals = DECIMALS) {
  const normalized = _normalizeBigNumberish(raw);
  if (normalized == null) return { display: PLACEHOLDER, numeric: null };
  return formatMappedNative(
    normalized,
    decimals === DECIMALS ? 2 : decimals,
    PLACEHOLDER,
  );
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
  const pendingBUYBACK = _formatAmount(
    raw.pendingBUYBACK ?? raw.pendingBUYBACKAgent,
  );
  const pendingTreasury = _formatAmount(raw.pendingTreasury);
  const pendingCOLLECTIONREWARDS = _formatAmount(raw.pendingCOLLECTIONREWARDS);
  const pendingCOMMUNITYCENTER = _formatAmount(
    raw.pendingCOMMUNITYCENTER ?? raw.pendingCommunity,
  );
  const communityPoolBalance = _formatAmount(raw.communityPoolBalance);

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
    snapshotSource: raw.snapshotSource ?? null,
    readerAddress: raw.readerAddress ?? null,
    readerOk: raw.readerOk ?? null,
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
    communityPoolBalance: communityPoolBalance.display,
    communityPoolBalanceNumeric: communityPoolBalance.numeric,
  };
}
