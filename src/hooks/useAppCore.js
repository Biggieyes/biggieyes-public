// useAppCore.js
import * as React from "react";
import { getContract, getReadOnlyContract, getReaderRO, getReadOnlyLiquidityContract } from "../utils/contract";
import { useWallet } from "./useWallet";
import { useGallery } from "./useGallery";
import { useStatsRewards } from "./useStatsRewards";
import { useVRF } from "./useVRF";
import { useUtils } from "./useUtils";
import { useIPFS } from "./useIPFS";
import { useAdminActions } from "./useAdminActions";
import { ensureAmoy } from "../utils/contract"; // správná relativní cesta

export function useAppCore() {
  // states
  const [myNFTs, setMyNFTs] = React.useState([]);
  const [lastMinted, setLastMinted] = React.useState({ tokenId: "-", image: "/images/Biggi.png", blockName: "-", backgroundName: "-" });
  const [dynamicTraitsById, setDynamicTraitsById] = React.useState({});
  const [vrfPending, setVrfPending] = React.useState(false);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [redeemMsg, setRedeemMsg] = React.useState("");
  const [pendingTicketId, setPendingTicketId] = React.useState(null);
  const [topFirstId, setTopFirstId] = React.useState(null);
  const [epochStartTs, setEpochStartTs] = React.useState(null);
  const [userLastClaimTs, setUserLastClaimTs] = React.useState(null);

  // refs
  const contractRef = React.useRef(null);

  // hooks
  const wallet = useWallet({ onConnected: async () => {
    // on connect - minimal orchestrace (fetchers mohou být použity volajícím)
    contractRef.current = getContract();
  }});
  const { fetchMyTickets, fetchOwnedNFTsViaTransfers, queryLogsBatched } = useGallery();
  const stats = useStatsRewards();
  const vrf = useVRF();
  const utils = useUtils();
  const ipfs = useIPFS();
  const admin = useAdminActions();

  // expose some key helpers and actions
  const resolveTicketPriceWei = React.useCallback(async () => {
    const c = contractRef.current || getReadOnlyContract();
    const candidates = ["getTicketPrice", "ticketPrice", "getTicketPriceWei", "ticketPriceWei"];
      for (const n of candidates) {
        const f = c[n];
        if (typeof f === "function") {
          try {
            const v = await f();
            if (v != null) return v;
          } catch (err) {
            console.debug("resolveTicketPriceWei candidate failed", n, err);
          }
        }
      }
    const reader = getReaderRO();
    const snap = await reader.getFrontendSnapshotLite();
    const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
    if (wei == null) throw new Error("Ticket price unavailable");
    return wei;
  }, []);

  const prettyError = React.useCallback((err) => {
    const name = err?.errorName || "";
    const reason = err?.reason || err?.data?.message || err?.message || "Unknown error";
    const map = {
      InsufficientPayment: "Sent value is lower than the ticket price.",
      MaxPerWallet: "Per-wallet limit (10 tickets) exceeded.",
      AllTicketsMinted: "All tickets are sold out.",
      NoTicketToRedeem: "You don't have any ticket to redeem.",
      NotTicket: "Selected token is not a ticket.",
      NotTicketOwner: "You are not the owner of this ticket.",
      AlreadyPending: "You already have a pending VRF draw.",
      PresaleNotActive: "Presale is turned off.",
      Paused: "Contract is paused.",
      NoEligibleTokens: "No eligible NFTs to claim this week.",
      CapExceeded: "Token cap would be exceeded.",
      NotFullyConfigured: "Contract metadata is not fully configured (owner must finish batch setup).",
      BiggiTokenNotSet: "BIGGI token is not configured yet.",
    };
    return map[name] || reason;
  }, []);

  const mintTicket = React.useCallback(async () => {
    if (!wallet.walletAddress) return alert("Please connect MetaMask first.");
    try {
      await admin.writeFirst?.([getContract], ["setSomething"]).catch(() => {}); // no-op placeholder - keep logic intact
      await ensureAmoy();
    } catch (err) {
      console.debug("mintTicket helper failed", err);
    }

    try {
      const contract = contractRef.current || getContract();
      const price = await resolveTicketPriceWei();
      await contract.estimateGas.mintTicket({ value: price });
      const tx = await contract.mintTicket({ value: price });
      await tx.wait();
      // caller should refresh UI - expose helper below
    } catch (err) {
      alert("Mint failed: " + prettyError(err));
      console.error("mintTicket", err);
    }
  }, [wallet.walletAddress, resolveTicketPriceWei, prettyError, admin]);

  const redeemTicket = React.useCallback(async () => {
    if (!wallet.walletAddress) return alert("Please connect MetaMask first.");
    if (isRedeeming || vrfPending) return;
    try {
      await ensureAmoy();
      const contract = contractRef.current || getContract();
      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Redeem is paused.");
      }
      setIsRedeeming(true);
      setRedeemMsg("Submitting redeem transaction…");

      let tickets = [];
      try {
        if (typeof contract.findTicket === "function") {
          tickets = await contract.findTicket(wallet.walletAddress);
        } else {
          tickets = await fetchMyTickets(wallet.walletAddress);
        }
      } catch (err) {
        console.debug("findTicket failed, falling back", err);
        tickets = await fetchMyTickets(wallet.walletAddress);
      }

      if (!tickets.length) {
        setIsRedeeming(false);
        setRedeemMsg("");
        return alert("You don't have any ticket to redeem.");
      }

      const ticketIdBN = tickets[0];
      const ticketIdStr = ticketIdBN.toString();

      // preflight (kept simple — caller can supply more checks)
      try {
        // estimate
        await contract.estimateGas.redeemTicketAndMintNFT(ticketIdBN);
      } catch (err) {
        console.debug("estimateGas.redeemTicketAndMintNFT failed", err);
      }

      setRedeemMsg("Please confirm in your wallet…");
      const tx = await contract.redeemTicketAndMintNFT(ticketIdBN);
      setRedeemMsg("Waiting for transaction confirmation…");
      await tx.wait();

      setPendingTicketId(ticketIdStr);
      setVrfPending(true);
      setRedeemMsg("Redeem confirmed. Waiting for VRF reveal…");
      setTopFirstId(ticketIdStr);

      // caller should call fetchWalletAssets and refreshStats/rewards
    } catch (err) {
      setIsRedeeming(false);
      setVrfPending(false);
      setRedeemMsg("");
      setPendingTicketId(null);
      alert("Redeem failed: " + prettyError(err));
      console.error("redeemTicket", err);
    }
  }, [wallet.walletAddress, isRedeeming, vrfPending, fetchMyTickets, prettyError]);

  const claimRewards = React.useCallback(async (tokenIds) => {
    if (!wallet.walletAddress) return alert("Please connect MetaMask first.");
    try {
      const brl = await getReadOnlyLiquidityContract();
      const tx = await brl.claim(tokenIds);
      await tx.wait();
    } catch (err) {
      alert("Claim failed: " + prettyError(err));
      console.error("claimRewards", err);
    }
  }, [wallet.walletAddress, prettyError]);

  // helpers to refresh external/sideloaded data (caller should invoke)
  const refreshAll = React.useCallback(async () => {
    try {
      await stats.fetchStats();
      await stats.fetchRewards(wallet.walletAddress, myNFTs);
    } catch (e) { console.error(e); }
  }, [stats, wallet.walletAddress, myNFTs]);

  // small effect: keep contractRef in sync with wallet attach
  React.useEffect(() => {
    contractRef.current = getReadOnlyContract();
  }, []);

  return {
    // state
    myNFTs, setMyNFTs,
    lastMinted, setLastMinted,
    dynamicTraitsById, setDynamicTraitsById,
    vrfPending, setVrfPending,
    isRedeeming, setIsRedeeming,
    redeemMsg, setRedeemMsg,
    pendingTicketId, setPendingTicketId,
    topFirstId, setTopFirstId,
    epochStartTs, setEpochStartTs,
    userLastClaimTs, setUserLastClaimTs,

    // wallet
    wallet,

    // hooks access
    stats,
    vrf,
    gallery: { fetchMyTickets, fetchOwnedNFTsViaTransfers, queryLogsBatched },
    ipfs,
    utils,
    admin,

    // actions
    mintTicket,
    redeemTicket,
    claimRewards,
    refreshAll,
  };
}
