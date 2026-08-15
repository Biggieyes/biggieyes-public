import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress } from "ethers";
import { useContracts } from "./ContractsProvider";
import {
  queryLogsBatched,
  getSafeDeployBlock,
  isFullHistoryEnabled,
} from "../shared/utils/shared";
import {
  ensurePolygon,
  getProviderForContract,
  getReadOnlyTicketHub,
  getTicketHub,
} from "../shared/utils/contract";
import { buildFeeOverrides } from "../shared/utils/txFees";
import { ADDR } from "../shared/utils/addresses.js";

const Ctx = React.createContext(null);
const FULL_HISTORY = isFullHistoryEnabled();

export function VRFProvider({ children }) {
  const { mainRO, biggiMainReaderRead, readerRead } = useContracts();

  const [params, setParams] = React.useState({
    keyHash: "",
    expectedKeyHash: ADDR.VRF_KEY_HASH || "",
    keyHashMatches: null,
    confirmations: 3,
    numWords: 1,
    callbackGasLimit: 300000,
    coordinator: ADDR.VRF_COORDINATOR || "",
    expectedCoordinator: ADDR.VRF_COORDINATOR || "",
    coordinatorMatches: null,
    collection: ADDR.COLLECTION_VRF || ADDR.MAIN || "",
    ticketHub: ADDR.TICKET_HUB || "",
    vrfRouter: ADDR.VRF_ROUTER || "",
  });
  const [subscriptionId, setSubscriptionId] = React.useState("");
  const [last, setLast] = React.useState({
    requestId: "",
    status: "idle",
    requestedAt: "",
    txHash: "",
  });
  const [history, setHistory] = React.useState([]);
  const [VRFPending, setVRFPending] = React.useState(false);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [redeemMsg, setRedeemMsg] = React.useState("");

  const findTicketsViaLogs = React.useCallback(async (contract, addr) => {
    if (!contract || !addr) return [];
    const provider = getProviderForContract(contract);
    if (!provider || typeof provider.getBlockNumber !== "function")
      throw new Error("Provider not available");
    const latest = await provider.getBlockNumber();
    const fromBlock = await getSafeDeployBlock(provider);
    const toFilter = contract.filters.Transfer(null, addr, null);
    const fromFilter = contract.filters.Transfer(addr, null, null);
    const [toLogs, fromLogs] = await Promise.all([
      queryLogsBatched(contract, toFilter, fromBlock, latest),
      queryLogsBatched(contract, fromFilter, fromBlock, latest),
    ]);
    const ordered = [...toLogs, ...fromLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.logIndex - b.logIndex;
    });
    const held = new Set();
    const me = String(addr).toLowerCase();
    for (const log of ordered) {
      const from = String(log.args?.from ?? log.args?.[0] ?? "").toLowerCase();
      const to = String(log.args?.to ?? log.args?.[1] ?? "").toLowerCase();
      const tokenId = (log.args?.tokenId ?? log.args?.[2])?.toString?.() || "";
      if (!tokenId) continue;
      if (to === me) held.add(tokenId);
      if (from === me) held.delete(tokenId);
    }
    return Array.from(held);
  }, []);

  const refresh = React.useCallback(
    async (userAddr = "") => {
      try {
        const c = await mainRO();
        const provider = getProviderForContract(c);
        const net = await provider?.getNetwork?.().catch(() => null);
        let nextParams = params;
        let nextSubscriptionId = subscriptionId;
        let nextSubscriptionMatches = null;
        let nextHistory = [];
        let nextLast = last;

        // params
        try {
          const [kh, conf, n, gas, sub] = await Promise.all([
            c.keyHash().catch(() => ""),
            c.requestConfirmations().catch(() => 3),
            c.numWords().catch(() => 1),
            c.callbackGasLimit().catch(() => 300000),
            c.s_subscriptionId?.().catch?.(() => "") ?? "",
          ]);
          const expectedKeyHash = ADDR.VRF_KEY_HASH || "";
          const expectedCoordinator = ADDR.VRF_COORDINATOR || "";
          const expectedSubId = ADDR.VRF_SUB_ID || "";
          const liveKeyHash = kh || "";
          const liveSubId = sub?.toString?.() || "";
          const keyHashMatches =
            liveKeyHash && expectedKeyHash
              ? String(liveKeyHash).toLowerCase() ===
                String(expectedKeyHash).toLowerCase()
              : null;
          nextParams = {
            keyHash: liveKeyHash || expectedKeyHash,
            keyHashLive: liveKeyHash,
            expectedKeyHash,
            keyHashMatches,
            confirmations: Number(conf ?? 3),
            numWords: Number(n ?? 1),
            callbackGasLimit: Number(gas ?? 300000),
            coordinator: expectedCoordinator,
            coordinatorLive: "",
            expectedCoordinator,
            coordinatorMatches: null,
            collection: ADDR.COLLECTION_VRF || ADDR.MAIN || "",
            ticketHub: ADDR.TICKET_HUB || "",
            vrfRouter: ADDR.VRF_ROUTER || "",
          };
          nextSubscriptionId = liveSubId || expectedSubId;
          nextSubscriptionMatches =
            liveSubId && expectedSubId
              ? String(liveSubId) === String(expectedSubId)
              : null;
          setParams(nextParams);
          setSubscriptionId(nextSubscriptionId);
        } catch {}

        // history (simplified: only fulfilled/pending for the user)
        if (userAddr) {
          if (!provider || typeof provider.getBlockNumber !== "function")
            throw new Error("Provider not available");
          const latest = await provider.getBlockNumber();
          const baseFrom = await getSafeDeployBlock(provider);
          const from = FULL_HISTORY
            ? baseFrom
            : Math.max(baseFrom, latest - 120000);
          const reqLogs = await queryLogsBatched(
            c,
            c.filters.VRFRequested?.(userAddr) ?? c.filters.VRFRequested(),
            from,
            latest,
          );
          const fulfRaw = await queryLogsBatched(
            c,
            c.filters.VRFFulfillStarted?.() ?? c.filters.VRFFulfillStarted(),
            from,
            latest,
          );
          const fulf = fulfRaw.filter(
            (l) =>
              (l.args?.minter || l.args?.[1] || "").toLowerCase?.() ===
              userAddr.toLowerCase(),
          );
          const byReq = new Map(
            fulf.map((l) => [
              (l.args?.requestId || l.args?.[0])?.toString?.() || "",
              l,
            ]),
          );

          const rows = [];
          for (const rl of reqLogs) {
            const rid =
              (rl.args?.requestId || rl.args?.[1])?.toString?.() || "";
            const f = byReq.get(rid);
            rows.push({
              requestId: rid,
              status: f ? "fulfilled" : "pending",
              tx: f?.transactionHash || "",
              blockNumber: f?.blockNumber || rl.blockNumber,
              time: "",
            });
          }
          rows.sort((a, b) => a.blockNumber - b.blockNumber);
          nextHistory = rows.slice(-25).reverse();
          const fulfilled = nextHistory.find(
            (row) => String(row.status).toLowerCase() === "fulfilled",
          );
          if (fulfilled) {
            nextLast = {
              requestId: fulfilled.requestId || "",
              status: "fulfilled",
              requestedAt: fulfilled.time || "",
              txHash: fulfilled.tx || "",
              blockNumber: fulfilled.blockNumber,
              randomWords: fulfilled.randomWords || [],
            };
          }
          setHistory(nextHistory);
          setLast(nextLast);
        }

        return {
          network: net?.name
            ? `${net.name} (${net.chainId})`
            : net?.chainId
              ? `chainId ${net.chainId}`
              : "EVM",
          chainId: net?.chainId != null ? Number(net.chainId) : undefined,
          userAddress: userAddr || "",
          subscription: {
            id: nextSubscriptionId,
            expectedId: ADDR.VRF_SUB_ID || "",
            matches: nextSubscriptionMatches,
          },
          params: nextParams,
          last: nextLast,
          history: nextHistory,
        };
      } catch (e) {
        console.error("VRFProvider.refresh", e);
        return null;
      }
    },
    [last, mainRO, params, subscriptionId],
  );

  const requestRedeem = React.useCallback(
    async (userAddr = "") => {
      try {
        await ensurePolygon();
        const main = await mainRO();
        const mainProvider = getProviderForContract(main);
        const ticketHubRead = getReadOnlyTicketHub(mainProvider);
        const ticketHubWrite = await getTicketHub();
        const provider =
          getProviderForContract(ticketHubWrite) ||
          getProviderForContract(ticketHubRead) ||
          mainProvider;
        setIsRedeeming(true);
        setRedeemMsg("Submitting redeem...");

        const mainPaused =
          typeof main?.paused === "function"
            ? await main.paused().catch(() => false)
            : false;
        const ticketHubPaused =
          typeof ticketHubRead?.paused === "function"
            ? await ticketHubRead.paused().catch(() => false)
            : false;
        if (mainPaused || ticketHubPaused) {
          throw new Error("Redeem is paused.");
        }

        if (typeof main?.pendingMintRequest === "function") {
          const pendingReq = await main
            .pendingMintRequest(userAddr)
            .catch(() => 0n);
          if (String(pendingReq || "0") !== "0") {
            setVRFPending(true);
            setRedeemMsg("VRF pending...");
            setIsRedeeming(false);
            return null;
          }
        }

        // find the first ticket (prefer reader, fallback to logs)
        let tickets = [];
        try {
          const reader =
            (typeof biggiMainReaderRead === "function"
              ? biggiMainReaderRead()
              : null) ||
            (typeof readerRead === "function" ? readerRead() : null);
          if (reader && typeof reader.findTicket === "function") {
            tickets = await reader.findTicket(userAddr);
          } else if (typeof ticketHubRead.findTicket === "function") {
            tickets = await ticketHubRead.findTicket(userAddr);
          }
        } catch {}
        if (!Array.isArray(tickets)) tickets = tickets ? [tickets] : [];

        if (!tickets.length && typeof ticketHubRead.findTicket === "function") {
          tickets = await ticketHubRead.findTicket(userAddr).catch(() => []);
          if (!Array.isArray(tickets)) tickets = tickets ? [tickets] : [];
        }

        if (!tickets?.length) {
          try {
            tickets = await findTicketsViaLogs(ticketHubRead, userAddr);
          } catch {
            tickets = [];
          }
        }

        if (!tickets?.length) {
          setIsRedeeming(false);
          setRedeemMsg("");
          throw new Error("No ticket");
        }

        const id = (() => {
          const raw = tickets[0];
          if (raw == null) return null;
          if (typeof raw === "bigint") return raw;
          if (typeof raw === "number") return BigInt(raw);
          if (typeof raw === "string") return BigInt(raw);
          if (typeof raw?.toString === "function") return BigInt(raw.toString());
          return null;
        })();
        if (id == null) {
          setIsRedeeming(false);
          setRedeemMsg("");
          throw new Error("Unable to read ticket ID");
        }

        try {
          if (typeof ticketHubRead?.ownerOf === "function") {
            const owner = await ticketHubRead.ownerOf(id);
            if (
              owner &&
              String(owner).toLowerCase() !== String(userAddr).toLowerCase()
            ) {
              throw new Error("Ticket is not owned by the connected wallet.");
            }
          }
        } catch (ownershipErr) {
          if (
            String(ownershipErr?.message || "").includes(
              "connected wallet",
            )
          ) {
            throw ownershipErr;
          }
        }

        const redeemFn = ticketHubWrite?.redeemTicket;
        if (typeof redeemFn !== "function") {
          throw new Error("Redeem function not available on TICKET_HUB contract.");
        }
        const estimate =
          ticketHubWrite?.estimateGas?.redeemTicket ||
          redeemFn?.estimateGas ||
          null;
        if (estimate) await estimate(id);
        if (redeemFn?.staticCall) await redeemFn.staticCall(id);
        if (ticketHubWrite?.callStatic?.redeemTicket) {
          await ticketHubWrite.callStatic.redeemTicket(id);
        }
        setRedeemMsg("Confirm in wallet...");
        const feeOverrides = await buildFeeOverrides(provider, {
          forceLegacy: true,
        });
        const tx = await redeemFn(id, { ...feeOverrides });
        setRedeemMsg("Waiting for confirmation...");
        await tx.wait();

        setVRFPending(true);
        setIsRedeeming(false);
        setRedeemMsg("VRF pending...");
        return tx;
      } catch (e) {
        setIsRedeeming(false);
        setVRFPending(false);
        setRedeemMsg("");
        throw e;
      }
    },
    [biggiMainReaderRead, findTicketsViaLogs, mainRO, readerRead],
  );

  const checkResolution = React.useCallback(
    async (userAddr = "") => {
      try {
        if (!userAddr) return;
        const c = await mainRO();
        const rid = await c
          .pendingMintRequest(userAddr)
          .catch(() => BigInt(0));
        const isZero =
          rid && typeof rid.isZero === "function"
            ? rid === 0n
            : String(rid || "0") === "0";
        if (isZero) {
          setVRFPending(false);
          setIsRedeeming(false);
          setRedeemMsg("Reveal complete!");
          setTimeout(() => setRedeemMsg(""), 3000);
        }
      } catch {}
    },
    [mainRO],
  );

  return (
    <Ctx.Provider
      value={{
        params,
        subscriptionId,
        last,
        history,
        VRFPending,
        isRedeeming,
        redeemMsg,
        refresh,
        requestRedeem,
        checkResolution,
        refreshVRFPanel: refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useVRF() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useVRF must be used inside <VRFProvider>");
  return v;
}


