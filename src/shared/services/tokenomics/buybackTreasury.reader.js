import { Contract } from "ethers";
import {
  BiggiBuybackReader as ABI_BiggiBuybackReader,
  BiggiReserveTreasuryReader as ABI_BiggiReserveTreasuryReader,
} from "@/config/abi/index.js";
import { ADDR } from "@/shared/utils/addresses.js";
import { getProvider } from "../../../web3/provider";
import { getBUYBACKTreasuryContracts } from "../../../web3/contracts/buybackTreasury.contracts";

// Small helper to keep snapshots resilient when some getters are missing.
async function _callOptional(method, fallback = null) {
  if (typeof method !== "function") return fallback;
  try {
    return await method();
  } catch {
    return fallback;
  }
}

function _shortAddr(addr) {
  if (!addr || typeof addr !== "string") return "--";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function normalizeReserveTreasurySnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    treasuryPol: snapshot?.treasuryPol ?? snapshot?.[0] ?? null,
    treasuryBiggi: snapshot?.treasuryBiggi ?? snapshot?.[1] ?? null,
    totalBiggiFromBuyback:
      snapshot?.totalBiggiFromBuyback ?? snapshot?.[2] ?? null,
    totalBiggiFromEcosystem:
      snapshot?.totalBiggiFromEcosystem ?? snapshot?.[3] ?? null,
    totalPolFromDistributor:
      snapshot?.totalPolFromDistributor ?? snapshot?.[4] ?? null,
  };
}

async function _readTreasurySnapshot(signerOrProvider) {
  const readerAddress =
    ADDR.RESERVE_TREASURY_READER || ADDR.TREASURY_READER || null;
  if (!readerAddress) return null;
  try {
    const reader = new Contract(
      readerAddress,
      ABI_BiggiReserveTreasuryReader,
      signerOrProvider,
    );
    const snapshot = await reader.treasurySnapshot();
    return normalizeReserveTreasurySnapshot(snapshot);
  } catch {
    return null;
  }
}

async function _readBuybackReaderSnapshot(signerOrProvider) {
  const readerAddress = ADDR.BUYBACK_READER || null;
  if (!readerAddress) return null;
  try {
    const reader = new Contract(
      readerAddress,
      ABI_BiggiBuybackReader,
      signerOrProvider,
    );
    const [agentSnapshot, treasurySnapshot, policySnapshot, keeperSnapshot] =
      await reader.snapshot();
    return {
      agent: {
        autoBuybackEnabled:
          agentSnapshot?.autoBuybackEnabled ?? agentSnapshot?.[0] ?? null,
        paused: agentSnapshot?.paused ?? agentSnapshot?.[1] ?? null,
        router: agentSnapshot?.router ?? agentSnapshot?.[2] ?? null,
        wrappedNative:
          agentSnapshot?.wrappedNative ?? agentSnapshot?.[3] ?? null,
        treasury: agentSnapshot?.treasury ?? agentSnapshot?.[4] ?? null,
        policy: agentSnapshot?.policy ?? agentSnapshot?.[5] ?? null,
        dripLM: agentSnapshot?.dripLM ?? agentSnapshot?.[6] ?? null,
        keeper: agentSnapshot?.keeper ?? agentSnapshot?.[7] ?? null,
        lastBuybackAt:
          agentSnapshot?.lastBuybackAt ?? agentSnapshot?.[8] ?? null,
        totalNativeReceived:
          agentSnapshot?.totalNativeReceived ?? agentSnapshot?.[9] ?? null,
        totalNativeSpent:
          agentSnapshot?.totalNativeSpent ?? agentSnapshot?.[10] ?? null,
        totalBiggiAcquired:
          agentSnapshot?.totalBiggiAcquired ?? agentSnapshot?.[11] ?? null,
        nativeBalance: agentSnapshot?.nativeBalance ?? agentSnapshot?.[12] ?? null,
        biggiBalance: agentSnapshot?.biggiBalance ?? agentSnapshot?.[13] ?? null,
      },
      treasury: {
        polBalance: treasurySnapshot?.polBalance ?? treasurySnapshot?.[0] ?? null,
        biggiBalance:
          treasurySnapshot?.biggiBalance ?? treasurySnapshot?.[1] ?? null,
        totalPolReceived:
          treasurySnapshot?.totalPolReceived ?? treasurySnapshot?.[2] ?? null,
        totalBiggiReceived:
          treasurySnapshot?.totalBiggiReceived ?? treasurySnapshot?.[3] ?? null,
        totalBiggiFromEcosystem:
          treasurySnapshot?.totalBiggiFromEcosystem ??
          treasurySnapshot?.[4] ??
          null,
      },
      policy: {
        swapSlippageBps:
          policySnapshot?.swapSlippageBps ?? policySnapshot?.[0] ?? null,
        txDeadlineSec: policySnapshot?.txDeadlineSec ?? policySnapshot?.[1] ?? null,
        minBuybackInterval:
          policySnapshot?.minBuybackInterval ?? policySnapshot?.[2] ?? null,
        buybacksPaused:
          policySnapshot?.buybacksPaused ?? policySnapshot?.[3] ?? null,
        maxDailyBuybackNative:
          policySnapshot?.maxDailyBuybackNative ?? policySnapshot?.[4] ?? null,
        usedToday: policySnapshot?.usedToday ?? policySnapshot?.[5] ?? null,
        dayIndex: policySnapshot?.dayIndex ?? policySnapshot?.[6] ?? null,
      },
      keeper: {
        minNativeThresholdWei:
          keeperSnapshot?.minNativeThresholdWei ?? keeperSnapshot?.[0] ?? null,
        paused: keeperSnapshot?.paused ?? keeperSnapshot?.[1] ?? null,
        allowedCaller:
          keeperSnapshot?.allowedCaller ?? keeperSnapshot?.[2] ?? null,
        agent: keeperSnapshot?.agent ?? keeperSnapshot?.[3] ?? null,
      },
    };
  } catch {
    return null;
  }
}

/**
 * BUYBACK + Treasury snapshot.
 * View-only: balances + a few useful counters.
 */
export async function fetchBUYBACKTreasurySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();

  const { BUYBACK, treasury, token, addrs } = getBUYBACKTreasuryContracts(
    chainId,
    signerOrProvider,
  );

  const buybackReaderSnapshot = await _readBuybackReaderSnapshot(signerOrProvider);
  const treasurySnapshot = await _readTreasurySnapshot(signerOrProvider);

  // --- balances ---
  const [buybackNative, buybackBiggi] = await Promise.all([
    buybackReaderSnapshot?.agent?.nativeBalance != null
      ? Promise.resolve(buybackReaderSnapshot.agent.nativeBalance)
      : _callOptional(() => signerOrProvider.getBalance(BUYBACK.address), null),
    buybackReaderSnapshot?.agent?.biggiBalance != null
      ? Promise.resolve(buybackReaderSnapshot.agent.biggiBalance)
      : _callOptional(() => token.balanceOf(BUYBACK.address), null),
  ]);

  let treasuryNative =
    buybackReaderSnapshot?.treasury?.polBalance ??
    treasurySnapshot?.treasuryPol ??
    null;
  let treasuryBiggi =
    buybackReaderSnapshot?.treasury?.biggiBalance ??
    treasurySnapshot?.treasuryBiggi ??
    null;

  if (treasuryNative == null || treasuryBiggi == null) {
    const [directTreasuryNative, directTreasuryBiggi] = await Promise.all([
      treasuryNative == null
        ? _callOptional(() => signerOrProvider.getBalance(treasury.address), null)
        : Promise.resolve(treasuryNative),
      treasuryBiggi == null
        ? _callOptional(() => token.balanceOf(treasury.address), null)
        : Promise.resolve(treasuryBiggi),
    ]);
    treasuryNative = treasuryNative ?? directTreasuryNative;
    treasuryBiggi = treasuryBiggi ?? directTreasuryBiggi;
  }

  // --- optional stats (may not exist on all deployments) ---
  const [
    totalNativeSpent,
    totalBiggiAcquired,
    lastBuybackAt,
    totalMaticReceived,
    totalNativeReceived,
    autoBuybackEnabled,
    router,
    wrappedNative,
    fallbackMinIntervalSec,
    fallbackSwapSlippageBps,
    fallbackTxDeadlineSec,
    policy,
    keeperThreshold,
    keeperPaused,
    keeperAllowedCaller,
    keeperAgent,
  ] = await Promise.all([
    buybackReaderSnapshot?.agent?.totalNativeSpent != null
      ? Promise.resolve(buybackReaderSnapshot.agent.totalNativeSpent)
      : _callOptional(() => BUYBACK.totalNativeSpent?.(), null),
    buybackReaderSnapshot?.agent?.totalBiggiAcquired != null
      ? Promise.resolve(buybackReaderSnapshot.agent.totalBiggiAcquired)
      : _callOptional(() => BUYBACK.totalBiggiAcquired?.(), null),
    buybackReaderSnapshot?.agent?.lastBuybackAt != null
      ? Promise.resolve(buybackReaderSnapshot.agent.lastBuybackAt)
      : _callOptional(() => BUYBACK.lastBuybackAt?.(), null),
    (async () => {
      if (buybackReaderSnapshot?.treasury?.totalPolReceived != null) {
        return buybackReaderSnapshot.treasury.totalPolReceived;
      }
      if (treasurySnapshot?.totalPolFromDistributor != null) {
        return treasurySnapshot.totalPolFromDistributor;
      }
      const byDistributor = await _callOptional(
        () => treasury.totalPolReceivedFromDistributor?.(),
        null,
      );
      if (byDistributor != null) return byDistributor;
      return _callOptional(() => treasury.totalPolReceived?.(), null);
    })(),
    buybackReaderSnapshot?.agent?.totalNativeReceived != null
      ? Promise.resolve(buybackReaderSnapshot.agent.totalNativeReceived)
      : _callOptional(() => BUYBACK.totalNativeReceived?.(), null),
    buybackReaderSnapshot?.agent?.autoBuybackEnabled != null
      ? Promise.resolve(buybackReaderSnapshot.agent.autoBuybackEnabled)
      : _callOptional(() => BUYBACK.autoBuybackEnabled?.(), null),
    buybackReaderSnapshot?.agent?.router
      ? Promise.resolve(buybackReaderSnapshot.agent.router)
      : _callOptional(() => BUYBACK.router?.(), addrs.router ?? null),
    buybackReaderSnapshot?.agent?.wrappedNative
      ? Promise.resolve(buybackReaderSnapshot.agent.wrappedNative)
      : _callOptional(() => BUYBACK.wrappedNative?.(), addrs.weth ?? null),
    buybackReaderSnapshot?.policy?.minBuybackInterval != null
      ? Promise.resolve(buybackReaderSnapshot.policy.minBuybackInterval)
      : _callOptional(() => BUYBACK.fallbackMinIntervalSec?.(), null),
    buybackReaderSnapshot?.policy?.swapSlippageBps != null
      ? Promise.resolve(buybackReaderSnapshot.policy.swapSlippageBps)
      : _callOptional(() => BUYBACK.fallbackSwapSlippageBps?.(), null),
    buybackReaderSnapshot?.policy?.txDeadlineSec != null
      ? Promise.resolve(buybackReaderSnapshot.policy.txDeadlineSec)
      : _callOptional(() => BUYBACK.fallbackTxDeadlineSec?.(), null),
    buybackReaderSnapshot?.agent?.policy
      ? Promise.resolve(buybackReaderSnapshot.agent.policy)
      : _callOptional(() => BUYBACK.policy?.(), null),
    buybackReaderSnapshot?.keeper?.minNativeThresholdWei != null
      ? Promise.resolve(buybackReaderSnapshot.keeper.minNativeThresholdWei)
      : null,
    buybackReaderSnapshot?.keeper?.paused != null
      ? Promise.resolve(buybackReaderSnapshot.keeper.paused)
      : null,
    buybackReaderSnapshot?.keeper?.allowedCaller
      ? Promise.resolve(buybackReaderSnapshot.keeper.allowedCaller)
      : null,
    buybackReaderSnapshot?.keeper?.agent
      ? Promise.resolve(buybackReaderSnapshot.keeper.agent)
      : null,
  ]);

  const ts = Date.now();
  const tsLabel = new Date(ts).toLocaleString();

  const paused =
    buybackReaderSnapshot?.agent?.paused != null
      ? buybackReaderSnapshot.agent.paused
      : await _callOptional(() => BUYBACK.paused?.(), null);

  const derived = {
    statusTone: paused ? "w" : "v",
    statusLabel: paused ? "Paused" : "Active",
  };

  return {
    ts,
    tsLabel,
    BUYBACK: {
      address: BUYBACK.address,
      routerShort: _shortAddr(addrs.router),
      router,
      wrappedNative,
      POLICY: policy,
      autoBUYBACKEnabled: autoBuybackEnabled,
      fallbackMinIntervalSec,
      fallbackSwapSlippageBps,
      fallbackTxDeadlineSec,
      keeperProxy: ADDR.BUYBACK_READER ? ADDR.BUYBACK_UPKEEP_PROXY || ADDR.UPKEEP_PROXY : null,
      keeperProxyPaused: keeperPaused,
      keeperThreshold,
      keeperAllowedCaller,
      keeperAgent,
      nativeBalance: buybackNative,
      biggiBalance: buybackBiggi,
      totalNativeReceived,
      totalNativeSpent,
      totalBiggiAcquired,
      lastBUYBACK: lastBuybackAt,
      lastBUYBACKLabel: lastBuybackAt ? String(lastBuybackAt) : "--",
      paused,
    },
    treasury: {
      address: treasury.address,
      shortAddress: _shortAddr(treasury.address),
      maticBalance: treasuryNative,
      biggiBalance: treasuryBiggi,
      totalMaticReceived,
      totalMaticReceivedFromDistributor: totalMaticReceived,
      totalBiggiReceived:
        buybackReaderSnapshot?.treasury?.totalBiggiReceived ??
        treasurySnapshot?.totalBiggiFromBuyback ??
        null,
      totalBiggiReceivedFromEcosystem:
        buybackReaderSnapshot?.treasury?.totalBiggiFromEcosystem ??
        treasurySnapshot?.totalBiggiFromEcosystem ??
        null,
    },
    derived,
    addresses: addrs,
  };
}
