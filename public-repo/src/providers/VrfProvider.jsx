import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress } from "ethers";
import { useContracts } from "./ContractsProvider";
import {
  queryLogsBatched,
  getSafeDeployBlock,
  isFullHistoryEnabled,
} from "../shared/utils/shared";
import {
  getProviderForContract,
  getReadOnlyTicketHub,
  getTicketHub,
} from "../shared/utils/contract";
import { CORE_CHAPTERS } from "../shared/utils/addresses.js";
import { resolveRedeemableTicketForActiveChapter } from "../shared/utils/ticketChapters.js";

const Ctx = React.createContext(null);
const FULL_HISTORY = isFullHistoryEnabled();

export function VRFProvider({ children }) {
  const { mainRO, chapterMainRead, biggiMainReaderRead, readerRead } =
    useContracts();

  const [params, setParams] = React.useState({
    keyHash: "",
    confirmations: 3,
    numWords: 1,
    callbackGasLimit: 300000,
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
  const [pendingChapterId, setPendingChapterId] = React.useState(null);

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
        // params
        try {
          const [kh, conf, n, gas, sub] = await Promise.all([
            c.keyHash().catch(() => ""),
            c.requestConfirmations().catch(() => 3),
            c.numWords().catch(() => 1),
            c.callbackGasLimit().catch(() => 300000),
            c.s_subscriptionId?.().catch?.(() => "") ?? "",
          ]);
          setParams({
            keyHash: kh || "",
            confirmations: Number(conf ?? 3),
            numWords: Number(n ?? 1),
            callbackGasLimit: Number(gas ?? 300000),
          });
          setSubscriptionId(sub?.toString?.() || "");
        } catch {}

        // history (simplified: only fulfilled/pending for the user)
        if (userAddr) {
          const provider = getProviderForContract(c);
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
          setHistory(rows.slice(-25).reverse());
        }
      } catch (e) {
        console.error("VRFProvider.refresh", e);
      }
    },
    [mainRO],
  );

  const requestRedeem = React.useCallback(
    async (userAddr = "") => {
      try {
        const main = await mainRO();
        const provider = getProviderForContract(main);
        const ticketHubRead = getReadOnlyTicketHub(provider);
        const ticketHubWrite = await getTicketHub();
        setIsRedeeming(true);
        setRedeemMsg("Submitting redeem...");

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

        const activeTicket = await resolveRedeemableTicketForActiveChapter(
          ticketHubRead,
          tickets,
        );
        const id = activeTicket.ticketId;
        const activeMain =
          typeof chapterMainRead === "function"
            ? chapterMainRead(activeTicket.chapterId)
            : main;
        if (typeof activeMain?.pendingMintRequest === "function") {
          const pendingRequest = await activeMain
            .pendingMintRequest(userAddr)
            .catch(() => 0n);
          if (String(pendingRequest || "0") !== "0") {
            setPendingChapterId(activeTicket.chapterId);
            setVRFPending(true);
            setRedeemMsg("VRF pending...");
            setIsRedeeming(false);
            return null;
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
        if (ticketHubWrite?.callStatic?.redeemTicket)
          await ticketHubWrite.callStatic.redeemTicket(id);
        setRedeemMsg("Confirm in wallet...");
        const tx = await redeemFn(id);
        setRedeemMsg("Waiting for confirmation...");
        await tx.wait();

        setVRFPending(true);
        setPendingChapterId(activeTicket.chapterId);
        setRedeemMsg("VRF pending...");
      } catch (e) {
        setIsRedeeming(false);
        setVRFPending(false);
        setRedeemMsg("");
        throw e;
      }
    },
    [
      biggiMainReaderRead,
      chapterMainRead,
      findTicketsViaLogs,
      mainRO,
      readerRead,
    ],
  );

  const checkResolution = React.useCallback(
    async (userAddr = "") => {
      try {
        if (!userAddr) return;
        const chapterIds = pendingChapterId
          ? [pendingChapterId]
          : CORE_CHAPTERS.map((chapter) => chapter.chapterId);
        const requests = await Promise.all(
          chapterIds.map(async (chapterId) => {
            const contract =
              typeof chapterMainRead === "function"
                ? chapterMainRead(chapterId)
                : await mainRO();
            return contract
              .pendingMintRequest(userAddr)
              .catch(() => BigInt(0));
          }),
        );
        const hasPending = requests.some(
          (requestId) => String(requestId || "0") !== "0",
        );
        if (!hasPending) {
          setPendingChapterId(null);
          setVRFPending(false);
          setIsRedeeming(false);
          setRedeemMsg("Reveal complete!");
          setTimeout(() => setRedeemMsg(""), 3000);
        }
      } catch {}
    },
    [chapterMainRead, mainRO, pendingChapterId],
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
