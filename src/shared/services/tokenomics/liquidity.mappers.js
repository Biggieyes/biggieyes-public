import { formatUnits } from "ethers";

const PLACEHOLDER = "N/A";
const DECIMALS = 18;

function _toFiniteNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function _formatTimestamp(seconds) {
  const numeric = _toFiniteNumber(seconds);
  if (!numeric || numeric <= 0) return PLACEHOLDER;
  return new Date(numeric * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const treasury = raw.treasury || {};
  const automation = raw.automation || {};
  const keeperProxy = raw.keeperProxy || {};
  const branchReader = raw.branchReader || {};

  const reserveMatic = _formatAmount(reserve.maticBalance);
  const reserveBiggi = _formatAmount(reserve.biggiBalance);
  const reserveWaiting = _formatAmount(reserve.waitingBiggi);
  const reserveDexRefill = _formatAmount(reserve.dexRefillBiggi);
  const reserveTotalMaticReceived = _formatAmount(reserve.totalMaticReceived);
  const vaultLp = _formatAmount(vault.totalLpLocked);
  const treasuryNative = _formatAmount(treasury.nativeBalance);
  const treasuryToken = _formatAmount(treasury.tokenBalance);
  const automationReservePol = _formatAmount(automation.reservePol);
  const automationDexRefill = _formatAmount(automation.reserveDexRefillBiggi);
  const automationMinPolPerTx = _formatAmount(automation.minPolPerTx);
  const automationMaxPolPerTx = _formatAmount(automation.maxPolPerTx);
  const automationMinDexRefill = _formatAmount(automation.minDexRefillBiggi);
  const automationDailyQuota = _formatAmount(automation.dailyQuotaPol);
  const automationUsedToday = _formatAmount(automation.usedToday);
  const keeperMinReservePol = _formatAmount(keeperProxy.minReservePol);
  const keeperMaxPerTx = _formatAmount(keeperProxy.maxPerTx);
  const keeperMinDexRefill = _formatAmount(keeperProxy.minDexRefillBiggi);
  const keeperComputedAmount = _formatAmount(keeperProxy.computedAmount);
  const keeperComputedReserve = _formatAmount(keeperProxy.computedReservePol);
  const keeperFixedAmount = _formatAmount(keeperProxy.fixedAmount);

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
      keeper: manager.keeper,
      keeperShort: _shortAddress(manager.keeper),
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
      pairWhitelisted: vault.pairWhitelisted ?? null,
    },
    treasury: {
      address: treasury.address,
      shortAddress: _shortAddress(treasury.address),
      nativeBalance: treasuryNative.display,
      nativeBalanceNumeric: treasuryNative.numeric,
      tokenBalance: treasuryToken.display,
      tokenBalanceNumeric: treasuryToken.numeric,
    },
    automation: {
      address: automation.address,
      shortAddress: _shortAddress(automation.address),
      wiredOk: automation.wiredOk ?? null,
      paused: automation.paused ?? null,
      reservePol: automationReservePol.display,
      reservePolNumeric: automationReservePol.numeric,
      reserveDexRefillBiggi: automationDexRefill.display,
      reserveDexRefillBiggiNumeric: automationDexRefill.numeric,
      minPolPerTx: automationMinPolPerTx.display,
      minPolPerTxNumeric: automationMinPolPerTx.numeric,
      maxPolPerTx: automationMaxPolPerTx.display,
      maxPolPerTxNumeric: automationMaxPolPerTx.numeric,
      minDexRefillBiggi: automationMinDexRefill.display,
      minDexRefillBiggiNumeric: automationMinDexRefill.numeric,
      cooldownSec: _toFiniteNumber(automation.cooldownSec),
      dailyQuotaPol: automationDailyQuota.display,
      dailyQuotaPolNumeric: automationDailyQuota.numeric,
      lastRun: _toFiniteNumber(automation.lastRun),
      lastRunLabel: _formatTimestamp(automation.lastRun),
      usedToday: automationUsedToday.display,
      usedTodayNumeric: automationUsedToday.numeric,
      dayMarker: _toFiniteNumber(automation.dayMarker),
      reserveAddr: automation.reserveAddr,
      reserveShort: _shortAddress(automation.reserveAddr),
      lmAddress: automation.lmAddr,
      lmShort: _shortAddress(automation.lmAddr),
      keeperAddr: automation.keeperAddr,
      keeperShort: _shortAddress(automation.keeperAddr),
      lmTokenPct: _toFiniteNumber(automation.lmTokenPct),
      lmSlippageBps: _toFiniteNumber(automation.lmSlippageBps),
      lmDeadlineSec: _toFiniteNumber(automation.lmDeadlineSec),
      lmKeeper: automation.lmKeeper,
      lmKeeperShort: _shortAddress(automation.lmKeeper),
      lmRouter: automation.lmRouter,
      lmRouterShort: _shortAddress(automation.lmRouter),
      lmVault: automation.lmVault,
      lmVaultShort: _shortAddress(automation.lmVault),
      lmReserve: automation.lmReserve,
      lmReserveShort: _shortAddress(automation.lmReserve),
    },
    keeperProxy: {
      address: keeperProxy.address,
      shortAddress: _shortAddress(keeperProxy.address),
      paused: keeperProxy.paused ?? null,
      allowedCaller: keeperProxy.allowedCaller,
      allowedCallerShort: _shortAddress(keeperProxy.allowedCaller),
      orchestrator: keeperProxy.orchestrator,
      orchestratorShort: _shortAddress(keeperProxy.orchestrator),
      minIntervalSec: _toFiniteNumber(keeperProxy.minIntervalSec),
      minReservePol: keeperMinReservePol.display,
      minReservePolNumeric: keeperMinReservePol.numeric,
      maxPerTx: keeperMaxPerTx.display,
      maxPerTxNumeric: keeperMaxPerTx.numeric,
      minDexRefillBiggi: keeperMinDexRefill.display,
      minDexRefillBiggiNumeric: keeperMinDexRefill.numeric,
      lastPerformTs: _toFiniteNumber(keeperProxy.lastPerformTs),
      lastPerformLabel: _formatTimestamp(keeperProxy.lastPerformTs),
      amountMode: _toFiniteNumber(keeperProxy.amountMode),
      fixedAmount: keeperFixedAmount.display,
      fixedAmountNumeric: keeperFixedAmount.numeric,
      percentBps: _toFiniteNumber(keeperProxy.percentBps),
      computedAmount: keeperComputedAmount.display,
      computedAmountNumeric: keeperComputedAmount.numeric,
      computedReservePol: keeperComputedReserve.display,
      computedReservePolNumeric: keeperComputedReserve.numeric,
      upkeepNeeded: keeperProxy.upkeepNeeded ?? null,
      upkeepReason: keeperProxy.upkeepReason || null,
      performData: keeperProxy.performData || null,
    },
    branchReader: {
      address: branchReader.address,
      shortAddress: _shortAddress(branchReader.address),
      wiredOk: branchReader.wiredOk ?? null,
      isStale: branchReader.isStale ?? null,
      configuredReserve: branchReader.configuredReserve,
      configuredReserveShort: _shortAddress(branchReader.configuredReserve),
      configuredLM: branchReader.configuredLM,
      configuredLMShort: _shortAddress(branchReader.configuredLM),
      configuredVault: branchReader.configuredVault,
      configuredVaultShort: _shortAddress(branchReader.configuredVault),
      reserveLM: branchReader.reserveLM,
      reserveLMShort: _shortAddress(branchReader.reserveLM),
      vaultLM: branchReader.vaultLM,
      vaultLMShort: _shortAddress(branchReader.vaultLM),
      lmReserve: branchReader.lmReserve,
      lmReserveShort: _shortAddress(branchReader.lmReserve),
      lmVault: branchReader.lmVault,
      lmVaultShort: _shortAddress(branchReader.lmVault),
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

export function mapSnapshotToFLOWRows(snapshot) {
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
