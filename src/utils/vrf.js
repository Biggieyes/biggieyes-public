import { getReadOnlyMain as getReadOnlyContract } from "./contract";
import { explorerBaseFor } from "./explorer";
import { getSafeDeployBlock, queryLogsBatched } from "./shared";

export async function buildVRFHistory(contract, address) {
  const latest = await contract.provider.getBlockNumber();
  const from = Math.max(
    await getSafeDeployBlock(contract.provider),
    latest - 120_000,
  );

  const reqLogs = await queryLogsBatched(
    contract,
    contract.filters.VRFRequested(address),
    from,
    latest,
  );

  const fulfillLogsRaw = await queryLogsBatched(
    contract,
    contract.filters.VRFFulfillStarted(),
    from,
    latest,
  );
  const fulfillLogs = fulfillLogsRaw.filter((l) => {
    const m = (l.args?.minter || l.args?.[1] || "").toLowerCase?.() || "";
    return m === address.toLowerCase();
  });

  const fulfillByReq = new Map();
  for (const l of fulfillLogs) {
    const rid = (l.args?.requestId || l.args?.[0])?.toString?.() || "";
    const rw = (l.args?.randomWord || l.args?.[2])?.toString?.() || "";
    fulfillByReq.set(rid, {
      requestId: rid,
      tx: l.transactionHash,
      blockNumber: l.blockNumber,
      randomWords: rw ? [rw] : [],
    });
  }

  const rows = [];
  for (const rl of reqLogs) {
    const rid = (rl.args?.requestId || rl.args?.[1])?.toString?.() || "";
    const f = fulfillByReq.get(rid);

    let time = "";
    try {
      const block = await contract.provider.getBlock(rl.blockNumber);
      if (block?.timestamp)
        time = new Date(block.timestamp * 1000).toLocaleString();
    } catch {
      // ignore block lookup errors
    }

    rows.push({
      time,
      requestId: rid,
      status: f ? "fulfilled" : "pending",
      confirmations: undefined,
      words: f?.randomWords?.length || 0,
      tx: f?.tx || "",
      blockNumber: f?.blockNumber || rl.blockNumber,
      randomWords: f?.randomWords || [],
    });
  }

  rows.sort((a, b) => a.blockNumber - b.blockNumber);
  return rows.slice(-25).reverse();
}

export async function resolvePendingFromHistoryOrOwnership(contract, user) {
  if (!user) return false;

  try {
    const latest = await contract.provider.getBlockNumber();
    const FROM = await getSafeDeployBlock(contract.provider);
    const toLogs = await queryLogsBatched(
      contract,
      contract.filters.Transfer(null, user, null),
      FROM,
      latest,
    );
    for (const l of toLogs.slice(-40).reverse()) {
      const tid = l.args?.tokenId?.toString?.();
      if (!tid) continue;
      try {
        const isTicket = await contract.isTicket(tid);
        if (!isTicket) return true;
      } catch {
        // continue scanning
      }
    }

    try {
      const hist = await buildVRFHistory(contract, user);
      const fulfilled = hist.find((h) => h.status === "fulfilled");
      if (fulfilled) return true;
    } catch {
      // ignore history fetch
    }

    return false;
  } catch (e) {
    console.error("resolvePendingFromHistoryOrOwnership", e);
    return false;
  }
}

export async function refreshVRFPanel(
  walletAddress,
  setVRFUIData,
  buildHistory,
) {
  try {
    const c = getReadOnlyContract();
    const net = await c.provider.getNetwork();

    let params = {};
    let subId = "";
    try {
      const [keyHash, conf, numWords, gas, sub] = await Promise.all([
        c.keyHash().catch(() => ""),
        c.requestConfirmations().catch(() => 3),
        c.numWords().catch(() => 1),
        c.callbackGasLimit().catch(() => 300000),
        c.s_subscriptionId?.().catch?.(() => "") ?? "",
      ]);
      params = {
        keyHash: keyHash || "",
        confirmations: Number(conf ?? 3),
        numWords: Number(numWords ?? 1),
        callbackGasLimit: Number(gas ?? 300000),
      };
      subId = sub?.toString?.() || "";
    } catch {
      // ignore params fetch
    }

    let last = {
      requestId: "",
      status: "idle",
      requestedAt: "",
      txHash: "",
      blockNumber: undefined,
      randomWords: [],
    };
    let history = [];

    if (walletAddress) {
      try {
        const pendingReqIdBN = await c
          .pendingMintRequest(walletAddress)
          .catch(() => BigInt(0));
        const ridStr = pendingReqIdBN?.toString?.() || "0";

        history = await buildHistory(c, walletAddress);

        if (ridStr !== "0") {
          let ts = "";
          try {
            const tsBN = await c.pendingRequestedAt(pendingReqIdBN);
            const tsNum = Number(tsBN?.toString?.() || 0);
            if (tsNum) ts = new Date(tsNum * 1000).toLocaleString();
          } catch {
            // ignore ts parse
          }
          last = {
            requestId: ridStr,
            status: "pending",
            requestedAt: ts,
            txHash: "",
            blockNumber: undefined,
            randomWords: [],
          };
        } else if (history.length) {
          const fulfilled = history.find((h) => h.status === "fulfilled");
          if (fulfilled) {
            last = {
              requestId: fulfilled.requestId,
              status: "fulfilled",
              requestedAt: fulfilled.time,
              txHash: fulfilled.tx || "",
              blockNumber: fulfilled.blockNumber,
              randomWords: fulfilled.randomWords || [],
            };
          } else {
            last.status = "idle";
          }
        }
      } catch (e) {
        console.error("refreshVRFPanel history", e);
      }
    }

    setVRFUIData({
      network: net?.name
        ? `${net.name} (${net.chainId})`
        : `chainId ${net.chainId}`,
      chainId: Number(net?.chainId),
      userAddress: walletAddress || "",
      subscription: { id: subId, linkBalance: "", consumers: [] },
      params,
      last,
      history,
    });
  } catch (e) {
    console.error("refreshVRFPanel", e);
  }
}

export async function checkVRFResolution({
  walletAddress,
  contractRef,
  fetchWalletAssets,
  fetchStats,
  fetchREWARDS,
  resolvePendingFromHistoryOrOwnershipFn,
  setVRFPending,
  setIsRedeeming,
  setRedeemMsg,
  refreshVRFPanelFn,
  setRedeemStartedAt,
}) {
  try {
    if (!walletAddress) return;
    const c = contractRef.current || getReadOnlyContract();

    let rid = null;
    try {
      rid = await c.pendingMintRequest(walletAddress);
    } catch {
      return;
    }
    const isZero =
      rid && typeof rid.isZero === "function"
        ? rid === 0n
        : String(rid || "0") === "0";

    const inferredFulfilled = isZero
      ? true
      : await resolvePendingFromHistoryOrOwnershipFn(c, walletAddress);

    if (inferredFulfilled) {
      await fetchWalletAssets(walletAddress);
      await fetchStats();
      await fetchREWARDS();
      if (typeof refreshVRFPanelFn === "function") await refreshVRFPanelFn();
      setVRFPending(false);
      setIsRedeeming(false);
      setRedeemMsg("Reveal complete!");
      if (typeof setRedeemStartedAt === "function") {
        setRedeemStartedAt(null);
      }
      setTimeout(() => setRedeemMsg(""), 3500);
    }
  } catch {
    // ignore VRF resolution errors
  }
}

export function openVRFExplorer(
  hashOrId,
  getReadOnlyContractFn = getReadOnlyContract,
) {
  (async () => {
    try {
      const c = getReadOnlyContractFn();
      const net = await c.provider.getNetwork();
      const base = explorerBaseFor(net?.chainId);
      if (!base) return window.open("", "_blank");
      const url = `${base}/tx/${hashOrId}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore window open errors
    }
  })();
}


