// useVRF.js
import * as React from "react";
// ...existing code...
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { getROProvider, ABI_VRF_READER, getReadOnlyContract } from "../utils/contract";

/**
 * useVRF poskytuje:
 * - buildVRFHistory(contract, address)
 * - refreshVRFPanel(contract, walletAddress)
 * - checkVRFResolution(contract, walletAddress)
 */
export function useVRF() {
  const queryLogsBatched = async (
    contract,
    filter,
    fromBlock,
    toBlock,
    step = 2000,
  ) => {
    const out = [];
    let start = fromBlock;
    let batch = step;
    while (start <= toBlock) {
      const end = Math.min(start + batch - 1, toBlock);
      try {
        const part = await contract.queryFilter(filter, start, end);
        if (part?.length) out.push(...part);
        start = end + 1;
        batch = step;
      } catch (err) {
        if (batch <= 1) throw err;
        batch = Math.max(1, Math.floor(batch / 2));
        continue;
      }
    }
    return out;
  };

  // Helper: získej instanci VRFReader contractu
  function getVRFReaderContract(provider) {
    return new Contract(
      "0x96dD4cB12d5BDa5014BCA2291FBF857662d0B263",
      ABI_VRF_READER,
      provider || getROProvider(),
    );
  }

  const buildVRFHistory = React.useCallback(async (c, address) => {
    const latest = await c.provider.getBlockNumber();
    const from = Math.max(0, latest - 120000);

    const reqLogs = await queryLogsBatched(
      c,
      c.filters.VRFRequested(address),
      from,
      latest,
    );
    const fulfillLogsRaw = await queryLogsBatched(
      c,
      c.filters.VRFFulfillStarted(),
      from,
      latest,
    );

    const fulfillByReq = new Map();
    for (const l of fulfillLogsRaw) {
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
        const block = await c.provider.getBlock(rl.blockNumber);
        if (block?.timestamp)
          time = new Date(block.timestamp * 1000).toLocaleString();
      } catch (err) {
        console.debug("buildVRFHistory block fetch failed", err);
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
  }, []);

  const refreshVRFPanel = React.useCallback(
    async (walletAddress) => {
      try {
        const provider = getROProvider();
        const c = getVRFReaderContract(provider);
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
        } catch (err) {
          console.debug("refreshVRFPanel params fetch failed", err);
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
            history = await buildVRFHistory(c, walletAddress);

            if (ridStr !== "0") {
              let ts = "";
              try {
                const tsBN = await c.pendingRequestedAt(pendingReqIdBN);
                const tsNum = Number(tsBN?.toString?.() || 0);
                if (tsNum) ts = new Date(tsNum * 1000).toLocaleString();
              } catch (err) {
                console.debug("refreshVRFPanel pendingRequestedAt failed", err);
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

        return {
          network: net?.name
            ? `${net.name} (${net.chainId})`
            : `chainId ${net.chainId}`,
          chainId: Number(net?.chainId),
          userAddress: walletAddress || "",
          subscription: { id: subId, linkBalance: "", consumers: [] },
          params,
          last,
          history,
        };
      } catch (e) {
        console.error("refreshVRFPanel", e);
        return null;
      }
    },
    [buildVRFHistory],
  );

  const checkVRFResolution = React.useCallback(
    async (walletAddress) => {
      try {
        if (!walletAddress) return { resolved: false };
        const c = getReadOnlyContract();
        const rid = await c
          .pendingMintRequest(walletAddress)
          .catch(() => BigInt(0));
        const isZero =
          rid && typeof rid.isZero === "function"
            ? rid === 0n
            : String(rid || "0") === "0";
        let inferredFulfilled = isZero ? true : false;
        if (!isZero) {
          const hist = await buildVRFHistory(c, walletAddress);
          inferredFulfilled = !!hist.find((h) => h.status === "fulfilled");
        }
        return { resolved: inferredFulfilled };
      } catch (e) {
        console.error("checkVRFResolution", e);
        return { resolved: false };
      }
    },
    [buildVRFHistory],
  );

  return { buildVRFHistory, refreshVRFPanel, checkVRFResolution };
}


