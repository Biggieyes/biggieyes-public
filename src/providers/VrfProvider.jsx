import * as React from "react";
import { ethers } from "ethers";
import { useContracts } from "./ContractsProvider";

const Ctx = React.createContext(null);
const DEPLOY_BLOCK = 26412543;

export function VrfProvider({ children }) {
  const { mainRO, mainRW } = useContracts();

  const [params, setParams] = React.useState({
    keyHash: "",
    confirmations: 3,
    numWords: 1,
    callbackGasLimit: 300000,
  });
  const [subscriptionId, setSubscriptionId] = React.useState("");
  const [last, setLast] = React.useState({ requestId: "", status: "idle", requestedAt: "", txHash: "" });
  const [history, setHistory] = React.useState([]);
  const [vrfPending, setVrfPending] = React.useState(false);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [redeemMsg, setRedeemMsg] = React.useState("");

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
          const latest = await c.provider.getBlockNumber();
          const reqLogs = await c.queryFilter(
            c.filters.VRFRequested?.(userAddr) ?? c.filters.VRFRequested(),
            Math.max(DEPLOY_BLOCK, latest - 120000),
            latest
          );
          const fulfRaw = await c.queryFilter(
            c.filters.VRFFulfillStarted?.() ?? c.filters.VRFFulfillStarted(),
            Math.max(DEPLOY_BLOCK, latest - 120000),
            latest
          );
          const fulf = fulfRaw.filter(
            (l) => (l.args?.minter || l.args?.[1] || "").toLowerCase?.() === userAddr.toLowerCase()
          );
          const byReq = new Map(
            fulf.map((l) => [(l.args?.requestId || l.args?.[0])?.toString?.() || "", l])
          );

          const rows = [];
          for (const rl of reqLogs) {
            const rid = (rl.args?.requestId || rl.args?.[1])?.toString?.() || "";
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
        console.error("VrfProvider.refresh", e);
      }
    },
    [mainRO]
  );

  const requestRedeem = React.useCallback(
    async (userAddr = "") => {
      try {
        const c = await mainRW();
        setIsRedeeming(true);
        setRedeemMsg("Submitting redeem...");

        // find the first ticket
        let tickets = [];
        try {
          tickets = await c.findTicket(userAddr);
        } catch {}
        if (!tickets?.length) {
          setIsRedeeming(false);
          setRedeemMsg("");
          throw new Error("No ticket");
        }

        const id = tickets[0];
        await c.callStatic.redeemTicketAndMintNFT(id);
        setRedeemMsg("Confirm in wallet...");
        const tx = await c.redeemTicketAndMintNFT(id);
        setRedeemMsg("Waiting for confirmation...");
        await tx.wait();

        setVrfPending(true);
        setRedeemMsg("VRF pending...");
      } catch (e) {
        setIsRedeeming(false);
        setVrfPending(false);
        setRedeemMsg("");
        throw e;
      }
    },
    [mainRW]
  );

  const checkResolution = React.useCallback(
    async (userAddr = "") => {
      try {
        if (!userAddr) return;
        const c = await mainRO();
        const rid = await c.pendingMintRequest(userAddr).catch(() => ethers.BigNumber.from(0));
        const isZero =
          rid && typeof rid.isZero === "function" ? rid.isZero() : String(rid || "0") === "0";
        if (isZero) {
          setVrfPending(false);
          setIsRedeeming(false);
          setRedeemMsg("Reveal complete!");
          setTimeout(() => setRedeemMsg(""), 3000);
        }
      } catch {}
    },
    [mainRO]
  );

  return (
    <Ctx.Provider
      value={{
        params,
        subscriptionId,
        last,
        history,
        vrfPending,
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

export function useVrf() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useVrf must be used inside <VrfProvider>");
  return v;
}
