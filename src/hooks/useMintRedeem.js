import * as React from "react";
import { ethers } from "ethers";

export function useMintRedeem(params) {
  const {
    walletAddress,
    contractRef,
    getReadOnlyContract,
    getContract,
    ensureAmoy,
    getReaderRO,
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    onRefreshTokenMetaRef,
    refreshVRFPanel,
    checkVrfResolution,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    preflightRedeemCheck,
    prettyError,
    setMyNFTs,
    isRedeeming,
    vrfPending,
    setIsRedeeming,
    setRedeemMsg,
    setRedeemStartBlock,
    setRedeemStartedAt,
    setPendingTicketId,
    setVrfPending,
    setTopFirstId,
  } = params;

  const resolveTicketPriceWei = React.useCallback(async () => {
    const c = contractRef.current || getReadOnlyContract();
    const candidates = ["getTicketPrice", "ticketPrice", "getTicketPriceWei", "ticketPriceWei"];
    for (const n of candidates) {
      const f = c[n];
        if (typeof f === "function") {
          try {
            const v = await f();
            if (v != null) return ethers.BigNumber.from(v);
          } catch (err) {
            console.debug("resolveTicketPriceWei candidate failed", n, err);
          }
        }
    }
    const reader = getReaderRO();
    const snap = await reader.getFrontendSnapshotLite();
    const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
    if (wei == null) throw new Error("Ticket price unavailable");
    return ethers.BigNumber.from(wei);
  }, [contractRef, getReadOnlyContract, getReaderRO]);

  const mintTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    try {
      const contract = contractRef.current || getContract();
      contractRef.current = contract;

      const net = await contract.provider.getNetwork();
      if (Number(net?.chainId) !== 80002) await ensureAmoy();

      const price = ethers.BigNumber.from(await resolveTicketPriceWei());
      if (!price || price.lte(0)) {
        return alert("Mint price unavailable or zero; try again later.");
      }

      try {
        await contract.callStatic.mintTicket({ value: price });
      } catch (err) {
        console.error("callStatic mintTicket", err);
        const msg =
          err?.errorName === "MaxPerWallet"
            ? "Max per wallet reached. Try a different wallet or wait until limit resets."
            : err?.data?.message || err?.reason || err?.message || "Unknown error";
        return alert("Mint would revert: " + msg);
      }

      try {
        await contract.estimateGas.mintTicket({ value: price });
      } catch (err) {
        console.error("estimateGas mintTicket", err);
        const msg =
          err?.errorName === "MaxPerWallet"
            ? "Max per wallet reached. Try a different wallet or wait until limit resets."
            : err?.data?.message || err?.reason || err?.message || "Unknown error";
        return alert("Mint gas estimation failed: " + msg);
      }
      const tx = await contract.mintTicket({ value: price });
      await tx.wait();

      await fetchWalletAssets(walletAddress);
      await fetchStats();
      await fetchRewards();
      if (onRefreshTokenMetaRef.current) await onRefreshTokenMetaRef.current();
      alert("Ticket minted.");
      refreshVRFPanel();
    } catch (err) {
      const msg =
        err?.errorName === "MaxPerWallet"
          ? "Max per wallet reached. Try a different wallet or wait until limit resets."
          : err?.data?.message || err?.reason || err?.message || prettyError(err);
      alert("Mint failed: " + msg);
      console.error("mintTicket", err);
    }
  }, [
    walletAddress,
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    onRefreshTokenMetaRef,
    ensureAmoy,
    resolveTicketPriceWei,
    refreshVRFPanel,
    getContract,
    prettyError,
    contractRef,
  ]);

  const redeemTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    if (isRedeeming || vrfPending) return;
    try {
      const contract = contractRef.current || getContract();
      const net = await contract.provider.getNetwork();
      if (Number(net?.chainId) !== 80002) await ensureAmoy();

      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Redeem is paused.");
      }

      setIsRedeeming(true);
      setRedeemMsg("Submitting redeem transaction...");

      let tickets = [];
      try {
        const ticketMetas = await fetchMyTickets(walletAddress);
        tickets = ticketMetas.map((t) => ethers.BigNumber.from(t.tokenId));
      } catch (err) {
        console.debug("redeemTicket fetchMyTickets failed", err);
      }

      if (!tickets.length) {
        setIsRedeeming(false);
        setRedeemMsg("");
        return alert("You don't have any ticket to redeem.");
      }

      const startBlock = await contract.provider.getBlockNumber();
      setRedeemStartBlock(startBlock);
      if (typeof setRedeemStartedAt === "function") {
        setRedeemStartedAt(Date.now());
      }

      const ticketIdBN = tickets[0];
      const ticketIdStr = ticketIdBN.toString();

      await preflightRedeemCheck(contract);

      try {
        await contract.estimateGas.redeemTicketAndMintNFT(ticketIdBN);
      } catch (err) {
        console.warn("estimateGas redeemTicketAndMintNFT failed, sending anyway", err);
      }
      setRedeemMsg("Please confirm in your wallet...");
      const tx = await contract.redeemTicketAndMintNFT(ticketIdBN);
      setRedeemMsg("Waiting for transaction confirmation...");
      await tx.wait();

      const placeholder = {
        tokenId: ticketIdStr,
        image: "/images/Biggi.png",
        meta: {
          name: `Ticket #${ticketIdStr} \u2014 VRF pending`,
          description: "Your NFT is being selected via Chainlink VRF.",
        },
        isTicket: true,
        isPlaceholder: true,
        isPending: true,
      };

      setPendingTicketId(ticketIdStr);
      setVrfPending(true);
      setRedeemMsg("Redeem confirmed. Waiting for VRF reveal...");
      setTopFirstId(ticketIdStr);

      const ticketsNow = await fetchMyTickets(walletAddress);
      const nftsNow = await fetchOwnedNFTsViaTransfers(walletAddress, ticketsNow.length);
      const filteredTickets = ticketsNow.filter((t) => String(t.tokenId) !== ticketIdStr);
      const byId = new Map();
      for (const t of filteredTickets) byId.set(t.tokenId, t);
      for (const n of nftsNow) byId.set(n.tokenId, n);
      const baseAssets = Array.from(byId.values());
      setMyNFTs([placeholder, ...baseAssets]);

      await fetchRewards();
      await fetchStats();
      refreshVRFPanel();

      setTimeout(() => {
        (async () => {
          try {
            await checkVrfResolution();
            await fetchWalletAssets(walletAddress);
          } catch (err) {
            console.debug("VRF follow-up refresh failed", err);
          }
        })();
      }, 25000);
    } catch (err) {
      setIsRedeeming(false);
      setVrfPending(false);
      setRedeemMsg("");
      setPendingTicketId(null);
      if (typeof setRedeemStartedAt === "function") {
        setRedeemStartedAt(null);
      }
      alert("Redeem failed: " + prettyError(err));
      console.error("redeemTicket", err);
    }
  }, [
    walletAddress,
    fetchRewards,
    fetchStats,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    prettyError,
    preflightRedeemCheck,
    fetchWalletAssets,
    refreshVRFPanel,
    checkVrfResolution,
    contractRef,
    getContract,
    ensureAmoy,
    setMyNFTs,
    isRedeeming,
    vrfPending,
    setIsRedeeming,
    setRedeemMsg,
    setRedeemStartBlock,
    setRedeemStartedAt,
    setPendingTicketId,
    setVrfPending,
    setTopFirstId,
  ]);

  const onVRFRequest = React.useCallback(() => {
    redeemTicket();
  }, [redeemTicket]);

  const onVRFRefresh = React.useCallback(async () => {
    await fetchStats();
    await fetchRewards();
    if (walletAddress) await fetchWalletAssets(walletAddress);
    await refreshVRFPanel();
    await checkVrfResolution();
  }, [fetchStats, fetchRewards, fetchWalletAssets, walletAddress, refreshVRFPanel, checkVrfResolution]);

  const onVRFCancelPending = React.useCallback(() => {
    alert("Cancel pending is not available in this UI.");
  }, []);

  const onVRFUpdateParams = React.useCallback(() => {
    alert("Updating VRF params is owner-only and not wired in this UI.");
  }, []);

  return {
    resolveTicketPriceWei,
    mintTicket,
    redeemTicket,
    onVRFRequest,
    onVRFRefresh,
    onVRFCancelPending,
    onVRFUpdateParams,
  };
}
