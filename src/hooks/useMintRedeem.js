import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { getFrontendSnapshotLiteActive } from "../utils/contract";

export function useMintRedeem(params) {
  const {
    walletAddress,
    contractRef,
    getReadOnlyContract,
    getContract,
    ensureAmoy,
    getReaderRO,
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    onRefreshTokenMetaRef,
    refreshVRFPanel,
    checkVRFResolution,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    preflightRedeemCheck,
    prettyError,
    setMyNFTs,
    isRedeeming,
    VRFPending,
    setIsRedeeming,
    setRedeemMsg,
    setRedeemStartBlock,
    setRedeemStartedAt,
    setPendingTicketId,
    setVRFPending,
    setTopFirstId,
  } = params;
  const [performing, setPerforming] = React.useState(false);
  const [error, setError] = React.useState(null);

  const resolveTicketPriceWei = React.useCallback(async () => {
    const c = contractRef.current || getReadOnlyContract();
    const candidates = [
      "getTicketPrice",
      "ticketPrice",
      "getTicketPriceWei",
      "ticketPriceWei",
    ];
    for (const n of candidates) {
      const f = c[n];
      if (typeof f === "function") {
        try {
          const v = await f();
          if (v != null) return BigInt(v);
        } catch (err) {
          console.debug("resolveTicketPriceWei candidate failed", n, err);
        }
      }
    }
    const reader = typeof getReaderRO === "function" ? getReaderRO() : null;
    const snap = await getFrontendSnapshotLiteActive(reader);
    const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
    if (wei == null) throw new Error("Ticket price unavailable");
    return BigInt(wei);
  }, [contractRef, getReadOnlyContract, getReaderRO]);

  const mintTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    setPerforming(true);
    setError(null);
    try {
      const contract = contractRef.current || getContract();
      contractRef.current = contract;

      const net = await contract.provider.getNetwork();
      if (Number(net?.chainId) !== 80002) await ensureAmoy();

      if (typeof contract.mintTicket !== "function") {
        if (typeof contract.mintPublic === "function") {
          alert(
            "Tento kontrakt je public (main2). Mint lístků není podporovaný. Použij COLLECTION 2 panel.",
          );
        } else {
          alert("Mint není na tomto kontraktu dostupný.");
        }
        return;
      }

      // Preflight: distributor must be configured and deployed (prevents "distributor fwd failed").
      try {
        if (typeof contract.distributor === "function") {
          const dist = await contract.distributor().catch(() => "");
          if (!dist || dist === ZeroAddress) {
            return alert(
              "Distributor není nastavený na kontraktu. Mint nebude fungovat.",
            );
          }
          const code = await contract.provider.getCode(dist).catch(() => "0x");
          if (!code || code === "0x") {
            return alert(
              "Distributor adresa nemá žádný bytecode. Zkontroluj konfiguraci kontraktu.",
            );
          }
        }
      } catch (err) {
        console.debug("mintTicket distributor preflight failed", err);
      }

      const price = BigInt(await resolveTicketPriceWei());
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
            : err?.data?.message ||
              err?.reason ||
              err?.message ||
              "Unknown error";
        return alert("Mint would revert: " + msg);
      }

      try {
        await contract.estimateGas.mintTicket({ value: price });
      } catch (err) {
        console.error("estimateGas mintTicket", err);
        const msg =
          err?.errorName === "MaxPerWallet"
            ? "Max per wallet reached. Try a different wallet or wait until limit resets."
            : err?.data?.message ||
              err?.reason ||
              err?.message ||
              "Unknown error";
        return alert("Mint gas estimation failed: " + msg);
      }
      const tx = await contract.mintTicket({ value: price });
      await tx.wait();

      await fetchWalletAssets(walletAddress);
      await fetchStats();
      await fetchREWARDS();
      if (onRefreshTokenMetaRef.current) await onRefreshTokenMetaRef.current();
      alert("Ticket minted.");
      refreshVRFPanel();
    } catch (err) {
      setError(err);
      const msg =
        err?.errorName === "MaxPerWallet"
          ? "Max per wallet reached. Try a different wallet or wait until limit resets."
          : err?.data?.message ||
            err?.reason ||
            err?.message ||
            prettyError(err);
      alert("Mint failed: " + msg);
      console.error("mintTicket", err);
    } finally {
      setPerforming(false);
    }
  }, [
    walletAddress,
    fetchStats,
    fetchREWARDS,
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
    if (isRedeeming || VRFPending) return;
    setPerforming(true);
    setError(null);
    try {
      const contract = contractRef.current || getContract();
      const net = await contract.provider.getNetwork();
      if (Number(net?.chainId) !== 80002) await ensureAmoy();

      if (typeof contract.redeemTicketAndMintNFT !== "function") {
        alert(
          "Redeem není na public kolekci dostupný. Použij COLLECTION 2 panel.",
        );
        return;
      }

      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Redeem is paused.");
      }

      setIsRedeeming(true);
      setRedeemMsg("Submitting redeem transaction...");

      let tickets = [];
      try {
        const ticketMetas = await fetchMyTickets(walletAddress);
        tickets = ticketMetas.map((t) => BigInt(t.tokenId));
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
        console.warn(
          "estimateGas redeemTicketAndMintNFT failed, sending anyway",
          err,
        );
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
      setVRFPending(true);
      setRedeemMsg("Redeem confirmed. Waiting for VRF reveal...");
      setTopFirstId(ticketIdStr);

      const ticketsNow = await fetchMyTickets(walletAddress);
      const nftsNow = await fetchOwnedNFTsViaTransfers(
        walletAddress,
        ticketsNow.length,
      );
      const filteredTickets = ticketsNow.filter(
        (t) => String(t.tokenId) !== ticketIdStr,
      );
      const byId = new Map();
      for (const t of filteredTickets) byId.set(t.tokenId, t);
      for (const n of nftsNow) byId.set(n.tokenId, n);
      const baseAssets = Array.from(byId.values());
      setMyNFTs([placeholder, ...baseAssets]);

      await fetchREWARDS();
      await fetchStats();
      refreshVRFPanel();

      setTimeout(() => {
        (async () => {
          try {
            await checkVRFResolution();
            await fetchWalletAssets(walletAddress);
          } catch (err) {
            console.debug("VRF follow-up refresh failed", err);
          }
        })();
      }, 25000);
    } catch (err) {
      setError(err);
      setIsRedeeming(false);
      setVRFPending(false);
      setRedeemMsg("");
      setPendingTicketId(null);
      if (typeof setRedeemStartedAt === "function") {
        setRedeemStartedAt(null);
      }
      alert("Redeem failed: " + prettyError(err));
      console.error("redeemTicket", err);
    } finally {
      setPerforming(false);
    }
  }, [
    walletAddress,
    fetchREWARDS,
    fetchStats,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    prettyError,
    preflightRedeemCheck,
    fetchWalletAssets,
    refreshVRFPanel,
    checkVRFResolution,
    contractRef,
    getContract,
    ensureAmoy,
    setMyNFTs,
    isRedeeming,
    VRFPending,
    setIsRedeeming,
    setRedeemMsg,
    setRedeemStartBlock,
    setRedeemStartedAt,
    setPendingTicketId,
    setVRFPending,
    setTopFirstId,
  ]);

  const onVRFRequest = React.useCallback(() => {
    redeemTicket();
  }, [redeemTicket]);

  const onVRFRefresh = React.useCallback(async () => {
    await fetchStats();
    await fetchREWARDS();
    if (walletAddress) await fetchWalletAssets(walletAddress);
    await refreshVRFPanel();
    await checkVRFResolution();
  }, [
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    walletAddress,
    refreshVRFPanel,
    checkVRFResolution,
  ]);

  const onVRFCancelPending = React.useCallback(() => {
    alert("Cancel pending is not available in this UI.");
  }, []);

  const onVRFUpdateParams = React.useCallback(() => {
    alert("Updating VRF params is owner-only and not wired in this UI.");
  }, []);

  return {
    performing,
    error,
    resolveTicketPriceWei,
    mintTicket,
    redeemTicket,
    onVRFRequest,
    onVRFRefresh,
    onVRFCancelPending,
    onVRFUpdateParams,
  };
}




