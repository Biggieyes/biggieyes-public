import { formatUnits } from "ethers";

const PLACEHOLDER = "N/A";
const DECIMALS = 18;

function _formatAmount(raw, decimals = DECIMALS) {
  if (raw === undefined || raw === null)
    return { display: PLACEHOLDER, numeric: null };
  try {
    const formatted = formatUnits(
      typeof raw === 'bigint' ? raw : BigInt(raw),
      decimals,
    );
    const numeric = Number(formatted);
    const display = Number.isFinite(numeric)
      ? numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : formatted;
    return { display, numeric: Number.isFinite(numeric) ? numeric : null };
  } catch (error) {
    console.warn("Failed to format amount", error);
    return { display: PLACEHOLDER, numeric: null };
  }
}

function _shortAddress(address = "") {
  if (!address) return PLACEHOLDER;
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function mapRawSnapshotToUI(raw) {
  if (!raw) return null;
  const ts = raw.ts || Date.now();
  const tsLabel = new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const reserve = raw.reserve || {};
  const manager = raw.manager || {};
  const vault = raw.vault || {};

  const reserveMatic = _formatAmount(reserve.maticBalance);
  const reserveBiggi = _formatAmount(reserve.biggiBalance);
  const reserveWaiting = _formatAmount(reserve.waitingBiggi);
  const reserveDexRefill = _formatAmount(reserve.dexRefillBiggi);
  const reserveTotalMaticReceived = _formatAmount(reserve.totalMaticReceived);
  const vaultLp = _formatAmount(vault.totalLpLocked);

  return {
    ts,
    tsLabel,
    tsISO: new Date(ts).toISOString(),
    reserve: {
      address: reserve.address,
      shortAddress: _shortAddress(reserve.address),
      maticBalance: reserveMatic.display,
      maticBalanceNumeric: reserveMatic.numeric,
      biggiBalance: reserveBiggi.display,
      biggiBalanceNumeric: reserveBiggi.numeric,
      waitingBiggi: reserveWaiting.display,
      waitingBiggiNumeric: reserveWaiting.numeric,
      dexRefillBiggi: reserveDexRefill.display,
      dexRefillBiggiNumeric: reserveDexRefill.numeric,
      totalMaticReceived: reserveTotalMaticReceived.display,
      totalMaticReceivedNumeric: reserveTotalMaticReceived.numeric,
      liquidityManager: reserve.liquidityManager,
      liquidityManagerShort: _shortAddress(reserve.liquidityManager),
    },
    manager: {
      address: manager.address,
      shortAddress: _shortAddress(manager.address),
      router: manager.routerAddress,
      routerShort: _shortAddress(manager.routerAddress),
      factory: manager.factoryAddress,
      factoryShort: _shortAddress(manager.factoryAddress),
      vault: manager.vaultAddress,
      vaultShort: _shortAddress(manager.vaultAddress),
    },
    vault: {
      address: vault.address,
      shortAddress: _shortAddress(vault.address),
      liquidityManager: vault.liquidityManager,
      liquidityManagerShort: _shortAddress(
        vault.liquidityManager || manager.address,
      ),
      totalLpLocked: vaultLp.display,
      totalLpLockedNumeric: vaultLp.numeric,
    },
  };
}

export function mapSnapshotToStatCards(snapshot) {
  if (!snapshot) return [];
  return [
    {
      label: "Reserve POL",
      value: snapshot.reserve.maticBalance,
      hint: "Reserve",
      accent: "primary",
    },
    {
      label: "LM Router",
      value: snapshot.manager.routerShort,
      hint: "Router",
    },
    {
      label: "Vault LP",
      value: snapshot.vault.totalLpLocked,
      hint: "Total locked",
      accent: "secondary",
    },
  ];
}

export function mapSnapshotToFlowRows(snapshot) {
  if (!snapshot) return [];
  return [
    {
      label: "Reserve waiting BIGGI",
      value: snapshot.reserve.waitingBiggi,
      hint: snapshot.reserve.liquidityManagerShort,
      segment: "reserve",
    },
    {
      label: "Reserve DEX refill",
      value: snapshot.reserve.dexRefillBiggi,
      hint: "Linked to LM",
      segment: "reserve",
    },
    {
      label: "Total POL received",
      value: snapshot.reserve.totalMaticReceived,
      hint: snapshot.reserve.address,
      segment: "reserve",
    },
    {
      label: "Vault LP locked",
      value: snapshot.vault.totalLpLocked,
      hint: snapshot.vault.liquidityManagerShort,
      segment: "vault",
    },
  ];
}

export function mapHistoryToChartPoints(history = []) {
  return history
    .map((entry) => ({
      label: entry?.tsLabel,
      value: entry?.vault?.totalLpLockedNumeric ?? null,
    }))
    .filter(
      (entry) => typeof entry.value === "number" && isFinite(entry.value),
    );
}

