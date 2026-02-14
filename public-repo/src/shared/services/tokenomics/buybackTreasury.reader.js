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
  return addr.slice(0, 6) + "…" + addr.slice(-4);
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

  // --- balances ---
  const [buybackNative, buybackBiggi, treasuryNative, treasuryBiggi] =
    await Promise.all([
      _callOptional(() => signerOrProvider.getBalance(BUYBACK.address), null),
      _callOptional(() => token.balanceOf(BUYBACK.address), null),
      _callOptional(() => signerOrProvider.getBalance(treasury.address), null),
      _callOptional(() => token.balanceOf(treasury.address), null),
    ]);

  // --- optional stats (may not exist on all deployments) ---
  const [totalNativeSpent, totalBiggiAcquired, lastBuybackAt, totalMaticReceived] =
    await Promise.all([
      _callOptional(() => BUYBACK.totalNativeSpent?.(), null),
      _callOptional(() => BUYBACK.totalBiggiAcquired?.(), null),
      _callOptional(() => BUYBACK.lastBuybackAt?.(), null),
      (async () => {
        const byDistributor = await _callOptional(
          () => treasury.totalPolReceivedFromDistributor?.(),
          null,
        );
        if (byDistributor != null) return byDistributor;
        return _callOptional(() => treasury.totalPolReceived?.(), null);
      })(),
    ]);

  const ts = Date.now();
  const tsLabel = new Date(ts).toLocaleString();

  const paused = await _callOptional(() => BUYBACK.paused?.(), null);

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
      nativeBalance: buybackNative,
      biggiBalance: buybackBiggi,
      totalNativeSpent,
      totalBiggiAcquired,
      lastBUYBACKLabel: lastBuybackAt ? String(lastBuybackAt) : "--",
    },
    treasury: {
      address: treasury.address,
      shortAddress: _shortAddr(treasury.address),
      maticBalance: treasuryNative,
      biggiBalance: treasuryBiggi,
      totalMaticReceived,
    },
    derived,
    addresses: addrs,
  };
}
