import { toUtf8String } from "ethers";
import { getProvider } from "../../../web3/provider";
import { getLiquidityContracts } from "../../../web3/contracts/liquidity.contracts";
import { getTokenDexAddresses } from "../../../config/addresses/index.js";
import { multicallReadContract } from "@/shared/utils/multicall.js";

const DEBUG = (() => {
  try {
    return (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_DEBUG_LIQUIDITY === "true"
    );
  } catch {
    return false;
  }
})();

async function _callOptional(method, fallback = null) {
  if (typeof method !== "function") return fallback;
  try {
    return await method();
  } catch (error) {
    console.warn("Liquidity snapshot helper call failed", method?.name, error);
    return fallback;
  }
}

async function _callContractMethod(contract, methodNames, fallback = null) {
  const names = Array.isArray(methodNames) ? methodNames : [methodNames];
  for (const methodName of names) {
    if (!methodName || typeof contract?.[methodName] !== "function") continue;
    const value = await _callOptional(() => contract[methodName](), null);
    if (value != null) return value;
  }
  return fallback;
}

function _getReadProvider(signerOrProvider) {
  return (
    signerOrProvider?.provider ||
    signerOrProvider?.runner?.provider ||
    signerOrProvider?.runner ||
    signerOrProvider
  );
}

async function _multicallOptional(provider, contract, entries, label) {
  try {
    return await multicallReadContract(provider, contract, entries);
  } catch (error) {
    console.warn(`[LiquiditySnapshot] ${label} multicall failed`, error);
    return null;
  }
}

function _sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function _decodeUtf8Bytes(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("0x") ||
    value === "0x"
  ) {
    return null;
  }
  try {
    const decoded = toUtf8String(value).replace(/\0/g, "").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

async function _readTotalLpLocked({ vault, chainId }) {
  if (!vault) return null;

  // 1) Newer deployments might expose totalLpLocked()
  try {
    if (typeof vault.totalLpLocked === "function") {
      const res = await vault.totalLpLocked();
      if (res != null) return res;
    }
  } catch (error) {
    const emptyData =
      typeof error?.data === "string" ? error.data === "0x" : false;
    // ignore "missing selector" errors and try fallback below
    if (!emptyData) {
      console.warn(
        "Liquidity snapshot helper call failed",
        "totalLpLocked",
        error,
      );
    }
  }

  // 2) Current LiquidityVault implementation uses lpBalanceOf(pair)
  const tokenDex = getTokenDexAddresses(chainId);
  const pairAddress = tokenDex?.pairAddress || null;
  if (!pairAddress) return null;

  try {
    if (typeof vault.lpBalanceOf !== "function") return null;
    return await vault.lpBalanceOf(pairAddress);
  } catch (error) {
    console.warn("Liquidity snapshot helper call failed", "lpBalanceOf", error);
    return null;
  }
}

export async function fetchLiquiditySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const readProvider = _getReadProvider(signerOrProvider);
  const {
    reserve,
    manager,
    vault,
    helper,
    reserveTreasuryReader,
    orchestrator,
    keeperProxy,
    branchUserReader,
  } = getLiquidityContracts(chainId, signerOrProvider);

  const tokenDex = getTokenDexAddresses(chainId);
  const reserveMulti = await _multicallOptional(
    readProvider,
    reserve,
    [
      { key: "maticBalance", method: "polBalance" },
      { key: "biggiBalance", method: "biggiBalance" },
      { key: "totalMaticReceived", method: "totalPolReceived" },
      { key: "waitingBiggi", method: "waitingBiggi" },
      { key: "dexRefillBiggi", method: "dexRefillBiggi" },
    ],
    "reserve",
  );
  const managerMulti = await _multicallOptional(
    readProvider,
    manager,
    [
      { key: "router", method: "router" },
      { key: "factory", method: "factory" },
      { key: "liquidityVault", method: "liquidityVault" },
      { key: "keeper", method: "keeper" },
    ],
    "manager",
  );
  const vaultMulti = await _multicallOptional(
    readProvider,
    vault,
    [{ key: "liquidityManager", method: "liquidityManager" }],
    "vault",
  );

  let routerAddress = null;
  let factoryAddress = null;
  let vaultAddress = null;
  let reservePol = null;
  let reserveBiggi = null;
  let waitingBiggi = null;
  let dexRefillBiggi = null;
  let totalMaticReceived = null;
  let treasuryPol = null;
  let treasuryBiggi = null;
  let automationCore = null;
  let automationLm = null;
  let automationPaused = null;
  let keeperPaused = null;
  let keeperAllowedCaller = null;
  let keeperComputed = null;
  let keeperCheck = null;
  let keeperMinIntervalSec = null;
  let keeperMinReservePol = null;
  let keeperMaxPerTx = null;
  let keeperMinDexRefillBiggi = null;
  let keeperOrchestrator = null;
  let keeperLastPerformTs = null;
  let keeperAmountMode = null;
  let keeperFixedAmount = null;
  let keeperPercentBps = null;
  let branchWiring = null;
  let branchReaderReserve = null;
  let branchReaderLm = null;
  let branchReaderVault = null;

  try {
    if (helper?.address) {
      const info = await helper.routerInfo();
      routerAddress = info?.routerAddr ?? info?.[0] ?? null;
      factoryAddress = info?.factory ?? info?.[1] ?? null;
    }
  } catch (err) {
    console.warn("[LiquiditySnapshot] helper.routerInfo failed", err);
  }

  try {
    if (reserveTreasuryReader?.address) {
      const readerMulti = await _multicallOptional(
        readProvider,
        reserveTreasuryReader,
        [
          { key: "reserveSnapshot", method: "reserveSnapshot", unwrap: false },
          { key: "treasurySnapshot", method: "treasurySnapshot", unwrap: false },
        ],
        "reserveTreasuryReader",
      );
      const [resSnap, treSnap] = await Promise.all([
        readerMulti?.reserveSnapshot ??
          _callOptional(() => reserveTreasuryReader.reserveSnapshot?.(), null),
        readerMulti?.treasurySnapshot ??
          _callOptional(() => reserveTreasuryReader.treasurySnapshot?.(), null),
      ]);
      reservePol = resSnap?.reservePol ?? resSnap?.[0];
      reserveBiggi = resSnap?.reserveBiggi ?? resSnap?.[1];
      waitingBiggi = resSnap?.waiting ?? resSnap?.[2];
      dexRefillBiggi = resSnap?.dexRefill ?? resSnap?.[3];
      totalMaticReceived = resSnap?.totalReceivedPol ?? resSnap?.[4];
      treasuryPol = treSnap?.treasuryPol ?? treSnap?.[0];
      treasuryBiggi = treSnap?.treasuryBiggi ?? treSnap?.[1];
    }
  } catch (err) {
    console.warn(
      "[LiquiditySnapshot] reserveTreasuryReader snapshot failed",
      err,
    );
  }

  try {
    const orchestratorMulti = await _multicallOptional(
      readProvider,
      orchestrator,
      [
        { key: "adminSnapshotCore", method: "adminSnapshotCore", unwrap: false },
        { key: "adminSnapshotLM", method: "adminSnapshotLM", unwrap: false },
        { key: "paused", method: "paused" },
      ],
      "orchestrator",
    );
    const keeperMulti = await _multicallOptional(
      readProvider,
      keeperProxy,
      [
        { key: "paused", method: "paused" },
        { key: "allowedCaller", method: "allowedCaller" },
        { key: "computedAmountNow", method: "computedAmountNow", unwrap: false },
        { key: "checkUpkeep", method: "checkUpkeep", params: ["0x"], unwrap: false },
        { key: "minIntervalSec", method: "minIntervalSec" },
        { key: "minReservePol", method: "minReservePol" },
        { key: "maxPerTx", method: "maxPerTx" },
        { key: "minDexRefillBiggi", method: "minDexRefillBiggi" },
        { key: "orchestrator", method: "orchestrator" },
        { key: "lastPerformTs", method: "lastPerformTs" },
        { key: "amountMode", method: "amountMode" },
        { key: "fixedAmount", method: "fixedAmount" },
        { key: "percentBps", method: "percentBps" },
      ],
      "keeperProxy",
    );
    const branchMulti = await _multicallOptional(
      readProvider,
      branchUserReader,
      [
        { key: "wiringSnapshot", method: "wiringSnapshot", unwrap: false },
        { key: "reserve", method: "reserve" },
        { key: "lm", method: "lm" },
        { key: "vault", method: "vault" },
      ],
      "branchUserReader",
    );
    [
      automationCore,
      automationLm,
      automationPaused,
      keeperPaused,
      keeperAllowedCaller,
      keeperComputed,
      keeperCheck,
      keeperMinIntervalSec,
      keeperMinReservePol,
      keeperMaxPerTx,
      keeperMinDexRefillBiggi,
      keeperOrchestrator,
      keeperLastPerformTs,
      keeperAmountMode,
      keeperFixedAmount,
      keeperPercentBps,
      branchWiring,
      branchReaderReserve,
      branchReaderLm,
      branchReaderVault,
    ] = await Promise.all([
      orchestratorMulti?.adminSnapshotCore ??
        _callOptional(() => orchestrator?.adminSnapshotCore?.()),
      orchestratorMulti?.adminSnapshotLM ??
        _callOptional(() => orchestrator?.adminSnapshotLM?.()),
      orchestratorMulti?.paused ?? _callOptional(() => orchestrator?.paused?.()),
      keeperMulti?.paused ?? _callOptional(() => keeperProxy?.paused?.()),
      keeperMulti?.allowedCaller ??
        _callOptional(() => keeperProxy?.allowedCaller?.()),
      keeperMulti?.computedAmountNow ??
        _callOptional(() => keeperProxy?.computedAmountNow?.()),
      keeperMulti?.checkUpkeep ??
        _callOptional(() => keeperProxy?.checkUpkeep?.("0x")),
      keeperMulti?.minIntervalSec ??
        _callOptional(() => keeperProxy?.minIntervalSec?.()),
      keeperMulti?.minReservePol ??
        _callOptional(() => keeperProxy?.minReservePol?.()),
      keeperMulti?.maxPerTx ?? _callOptional(() => keeperProxy?.maxPerTx?.()),
      keeperMulti?.minDexRefillBiggi ??
        _callOptional(() => keeperProxy?.minDexRefillBiggi?.()),
      keeperMulti?.orchestrator ??
        _callOptional(() => keeperProxy?.orchestrator?.()),
      keeperMulti?.lastPerformTs ??
        _callOptional(() => keeperProxy?.lastPerformTs?.()),
      keeperMulti?.amountMode ?? _callOptional(() => keeperProxy?.amountMode?.()),
      keeperMulti?.fixedAmount ?? _callOptional(() => keeperProxy?.fixedAmount?.()),
      keeperMulti?.percentBps ?? _callOptional(() => keeperProxy?.percentBps?.()),
      branchMulti?.wiringSnapshot ??
        _callOptional(() => branchUserReader?.wiringSnapshot?.()),
      branchMulti?.reserve ?? _callOptional(() => branchUserReader?.reserve?.()),
      branchMulti?.lm ?? _callOptional(() => branchUserReader?.lm?.()),
      branchMulti?.vault ?? _callOptional(() => branchUserReader?.vault?.()),
    ]);
  } catch (err) {
    console.warn("[LiquiditySnapshot] automation/keeper snapshot failed", err);
  }

  reservePol = reservePol ?? automationCore?.reservePol ?? automationCore?.[0] ?? null;
  dexRefillBiggi =
    dexRefillBiggi ??
    automationCore?.reserveDexRefillBiggi ??
    automationCore?.[1] ??
    null;

  if (!routerAddress || !factoryAddress || !vaultAddress) {
    try {
      [routerAddress, factoryAddress, vaultAddress] = await Promise.all([
        routerAddress || managerMulti?.router || _callOptional(manager.router),
        factoryAddress || managerMulti?.factory || _callOptional(manager.factory),
        vaultAddress ||
          managerMulti?.liquidityVault ||
          _callOptional(manager.liquidityVault),
      ]);
    } catch (err) {
      console.warn(
        "[LiquiditySnapshot] Chyba p‘ti naŽ›ÆðtÆónÆð adres/metod:",
        err,
      );
    }
  }

  routerAddress =
    routerAddress || (automationLm?.lmRouter ?? automationLm?.[4] ?? null);
  vaultAddress =
    vaultAddress || (automationLm?.lmVault ?? automationLm?.[5] ?? null);

  let managerKeeper = null,
    vaultLiquidityManager = null,
    totalLpLocked = null;
  try {
    [managerKeeper, vaultLiquidityManager, totalLpLocked] = await Promise.all([
      managerMulti?.keeper ?? _callOptional(manager.keeper),
      vaultMulti?.liquidityManager ?? _callOptional(vault.liquidityManager),
      _readTotalLpLocked({ vault, chainId }),
    ]);
    if (DEBUG) {
      console.log(
      "[LiquiditySnapshot] vault.liquidityManager:",
        vaultLiquidityManager,
      );
      console.log("[LiquiditySnapshot] vault.totalLpLocked:", totalLpLocked);
    }
  } catch (err) {
    console.warn("[LiquiditySnapshot] Chyba p‘ti naŽ›ÆðtÆónÆð vault hodnot:", err);
  }

  const pairAddress = tokenDex?.pairAddress || null;
  let pairWhitelisted = null;
  let vaultLpBalance = totalLpLocked;
  try {
    if (helper?.address && pairAddress) {
      const v = await helper.vaultInfo(pairAddress);
      pairWhitelisted = v?.pairWhitelisted ?? v?.[0] ?? null;
      vaultLpBalance = v?.vaultLpBalance ?? v?.[1] ?? vaultLpBalance;
    }
  } catch (err) {
    console.warn("[LiquiditySnapshot] helper.vaultInfo failed", err);
  }

  managerKeeper =
    managerKeeper ??
    automationCore?.keeperAddr ??
    automationCore?.[12] ??
    automationLm?.lmKeeper ??
    automationLm?.[3] ??
    null;

  const branchConfiguredReserve = branchReaderReserve ?? null;
  const branchConfiguredLm = branchReaderLm ?? null;
  const branchConfiguredVault = branchReaderVault ?? null;
  const branchReaderStale =
    branchUserReader?.address &&
    branchConfiguredReserve &&
    branchConfiguredLm &&
    branchConfiguredVault
    ? !(
        _sameAddress(branchConfiguredReserve, reserve.address) &&
        _sameAddress(branchConfiguredLm, manager.address) &&
        _sameAddress(branchConfiguredVault, vault.address)
      )
    : null;

  return {
    ts: Date.now(),
    reserve: {
      address: reserve.address,
      maticBalance:
        reservePol != null
          ? reservePol
          : reserveMulti?.maticBalance ??
            (await _callContractMethod(reserve, ["polBalance", "maticBalance"])),
      biggiBalance:
        reserveBiggi != null
          ? reserveBiggi
          : reserveMulti?.biggiBalance ??
            (await _callOptional(reserve.biggiBalance)),
      totalMaticReceived:
        totalMaticReceived != null
          ? totalMaticReceived
          : reserveMulti?.totalMaticReceived ??
            (await _callContractMethod(reserve, [
              "totalPolReceived",
              "totalMaticReceived",
            ])),
      waitingBiggi:
        waitingBiggi != null
          ? waitingBiggi
          : reserveMulti?.waitingBiggi ??
            (await _callOptional(reserve.waitingBiggi)),
      dexRefillBiggi:
        dexRefillBiggi != null
          ? dexRefillBiggi
          : reserveMulti?.dexRefillBiggi ??
            (await _callOptional(reserve.dexRefillBiggi)),
      liquidityManager: manager.address,
    },
    manager: {
      address: manager.address,
      routerAddress,
      factoryAddress,
      vaultAddress,
      keeper: managerKeeper,
    },
    vault: {
      address: vault.address,
      liquidityManager: vaultLiquidityManager || manager.address,
      totalLpLocked: vaultLpBalance ?? totalLpLocked,
      pairWhitelisted,
    },
    treasury: {
      address: tokenDex?.treasury || null,
      nativeBalance: treasuryPol ?? null,
      tokenBalance: treasuryBiggi ?? null,
    },
    automation: {
      address: orchestrator?.address ?? null,
      reservePol: automationCore?.reservePol ?? automationCore?.[0] ?? null,
      reserveDexRefillBiggi:
        automationCore?.reserveDexRefillBiggi ?? automationCore?.[1] ?? null,
      minPolPerTx: automationCore?._minPolPerTx ?? automationCore?.[2] ?? null,
      maxPolPerTx: automationCore?._maxPolPerTx ?? automationCore?.[3] ?? null,
      minDexRefillBiggi:
        automationCore?._minDexRefillBiggi ?? automationCore?.[4] ?? null,
      cooldownSec: automationCore?._cooldownSec ?? automationCore?.[5] ?? null,
      dailyQuotaPol: automationCore?._dailyQuotaPol ?? automationCore?.[6] ?? null,
      lastRun: automationCore?._lastRun ?? automationCore?.[7] ?? null,
      usedToday: automationCore?._usedToday ?? automationCore?.[8] ?? null,
      dayMarker: automationCore?._dayMarker ?? automationCore?.[9] ?? null,
      reserveAddr: automationCore?.reserveAddr ?? automationCore?.[10] ?? null,
      lmAddr: automationCore?.lmAddr ?? automationCore?.[11] ?? null,
      keeperAddr: automationCore?.keeperAddr ?? automationCore?.[12] ?? null,
      wiredOk: automationCore?.wiredOk ?? automationCore?.[13] ?? null,
      paused: automationPaused,
      lmTokenPct: automationLm?.lmTokenPct ?? automationLm?.[0] ?? null,
      lmSlippageBps: automationLm?.lmSlippageBps ?? automationLm?.[1] ?? null,
      lmDeadlineSec: automationLm?.lmDeadlineSec ?? automationLm?.[2] ?? null,
      lmKeeper: automationLm?.lmKeeper ?? automationLm?.[3] ?? null,
      lmRouter: automationLm?.lmRouter ?? automationLm?.[4] ?? null,
      lmVault: automationLm?.lmVault ?? automationLm?.[5] ?? null,
      lmReserve: automationLm?.lmReserve ?? automationLm?.[6] ?? null,
    },
    keeperProxy: {
      address: keeperProxy?.address ?? null,
      paused: keeperPaused,
      allowedCaller: keeperAllowedCaller,
      orchestrator: keeperOrchestrator,
      minIntervalSec: keeperMinIntervalSec,
      minReservePol: keeperMinReservePol,
      maxPerTx: keeperMaxPerTx,
      minDexRefillBiggi: keeperMinDexRefillBiggi,
      lastPerformTs: keeperLastPerformTs,
      amountMode: keeperAmountMode,
      fixedAmount: keeperFixedAmount,
      percentBps: keeperPercentBps,
      computedAmount: keeperComputed?.amount ?? keeperComputed?.[0] ?? null,
      computedReservePol:
        keeperComputed?.reservePol ?? keeperComputed?.[1] ?? null,
      upkeepNeeded: keeperCheck?.upkeepNeeded ?? keeperCheck?.[0] ?? null,
      performData: keeperCheck?.performData ?? keeperCheck?.[1] ?? null,
      upkeepReason: _decodeUtf8Bytes(
        keeperCheck?.performData ?? keeperCheck?.[1] ?? null,
      ),
    },
    branchReader: {
      address: branchUserReader?.address ?? null,
      configuredReserve: branchConfiguredReserve,
      configuredLM: branchConfiguredLm,
      configuredVault: branchConfiguredVault,
      wiredOk: branchWiring?.wiredOk ?? branchWiring?.[0] ?? null,
      reserveLM: branchWiring?.reserveLM ?? branchWiring?.[1] ?? null,
      vaultLM: branchWiring?.vaultLM ?? branchWiring?.[2] ?? null,
      lmReserve: branchWiring?.lmReserve ?? branchWiring?.[3] ?? null,
      lmVault: branchWiring?.lmVault ?? branchWiring?.[4] ?? null,
      isStale: branchReaderStale,
    },
  };
}
