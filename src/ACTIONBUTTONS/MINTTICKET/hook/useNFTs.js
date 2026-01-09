import * as React from "react";
import { ZeroAddress } from "ethers";
import {
  getContract,
  getReadOnlyContract,
  getLiquidityContract,
} from "../../../utils/contract";
import { getLogsBatched } from "../../../wallet/wc";
import { readJsonFromURI, resolveImageUrl } from "../../../services/ipfs";

/**
 * Hook pro správu NFT a ticketů (mint, redeem, claim, refresh)
 * Extrahováno z App.jsx — plně kompatibilní.
 */
export function useNFTs({
  walletAddress,
  ensureAmoy,
  prettyError,
  fetchStats,
  fetchREWARDS,
}) {
  const [myNFTs, setMyNFTs] = React.useState([]);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [VRFPending, setVRFPending] = React.useState(false);
  const [redeemMsg, setRedeemMsg] = React.useState("");
  const [pendingTicketId, setPendingTicketId] = React.useState(null);
  const [lastMinted, setLastMinted] = React.useState({});
  const [performing, setPerforming] = React.useState(false);
  const [error, setError] = React.useState(null);
  const unsubRef = React.useRef(() => {});

  /* ------------------- pomocné funkce ------------------- */
  const findTicketsViaLogs = React.useCallback(async (contract, addr) => {
    const FROM = 27105502; // deploy block
    const latest = await contract.provider.getBlockNumber();
    const toFilter = contract.filters.Transfer(null, addr, null);
    const fromFilter = contract.filters.Transfer(addr, null, null);
    const [toLogs, fromLogs] = await Promise.all([
      getLogsBatched(contract.provider, toFilter, FROM, latest),
      getLogsBatched(contract.provider, fromFilter, FROM, latest),
    ]);
    const all = [...toLogs, ...fromLogs].sort((a, b) =>
      a.blockNumber !== b.blockNumber
        ? a.blockNumber - b.blockNumber
        : a.logIndex - b.logIndex,
    );
    const held = new Set();
    const me = addr.toLowerCase();
    for (const l of all) {
      const from = String(l.args?.from ?? "").toLowerCase();
      const to = String(l.args?.to ?? "").toLowerCase();
      const tid = l.args?.tokenId?.toString?.() || "";
      if (!tid) continue;
      if (to === me) held.add(tid);
      if (from === me) held.delete(tid);
    }
    return Array.from(held);
  }, []);

  /* ------------------- FETCH WALLET ASSETS ------------------- */
  const fetchWalletAssets = React.useCallback(
    async (addr) => {
      if (!addr) return;
      const contract = getReadOnlyContract();
      try {
        const ids = await findTicketsViaLogs(contract, addr);
        const metas = await Promise.all(
          ids.map(async (tid) => {
            let image = "/images/Biggi.png";
            let meta = { name: `Token #${tid}`, description: "" };
            try {
              const uri = await contract.tokenURI(tid);
              const json = await readJsonFromURI(uri);
              if (json) {
                meta = json;
                const imgUrl = json.image || json.image_url;
                image = resolveImageUrl(imgUrl, uri) || image;
              }
            } catch (err) {
              console.debug("fetchWalletAssets tokenURI read failed", err);
            }
            return { tokenId: String(tid), image, meta };
          }),
        );
        setMyNFTs(metas);
      } catch (e) {
        console.error("fetchWalletAssets", e);
      }
    },
    [findTicketsViaLogs],
  );

  /* ------------------- MINT TICKET ------------------- */
  const mintTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    setPerforming(true);
    setError(null);
    try {
      await ensureAmoy();
      const contract = getContract();
      const net = await contract.provider.getNetwork();
      if (net.chainId !== 80002) await ensureAmoy();

      if (await contract.paused()) return alert("Mint is paused.");

      const price = await contract.ticketPrice();
      await contract.estimateGas.mintTicket({ value: price });
      const tx = await contract.mintTicket({ value: price });
      await tx.wait();

      await fetchWalletAssets(walletAddress);
      await fetchStats();
      await fetchREWARDS();
      alert("Ticket minted.");
    } catch (err) {
      setError(err);
      alert("Mint failed: " + prettyError(err));
      console.error("mintTicket", err);
    } finally {
      setPerforming(false);
    }
  }, [
    walletAddress,
    fetchWalletAssets,
    fetchStats,
    fetchREWARDS,
    ensureAmoy,
    prettyError,
  ]);

  /* ------------------- REDEEM TICKET ------------------- */
  const redeemTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    if (isRedeeming || VRFPending) return;
    setPerforming(true);
    setError(null);
    try {
      await ensureAmoy();
      const contract = getContract();
      if (await contract.paused()) return alert("Redeem is paused.");

      setIsRedeeming(true);
      setRedeemMsg("Submitting redeem transaction…");

      const tickets = await findTicketsViaLogs(contract, walletAddress);
      if (!tickets.length) {
        setIsRedeeming(false);
        setRedeemMsg("");
        return alert("You don't have any ticket to redeem.");
      }

      const ticketId = tickets[0];
      const price = await contract.ticketPrice();

      await contract.estimateGas.redeemTicketAndMintNFT(ticketId);
      setRedeemMsg("Please confirm in your wallet…");

      const tx = await contract.redeemTicketAndMintNFT(ticketId, {
        value: price,
      });
      await tx.wait();

      setPendingTicketId(ticketId.toString());
      setVRFPending(true);
      setRedeemMsg("Redeem confirmed. Waiting for VRF reveal…");

      await fetchWalletAssets(walletAddress);
      await fetchREWARDS();
      await fetchStats();
    } catch (err) {
      setError(err);
      setIsRedeeming(false);
      setVRFPending(false);
      setRedeemMsg("");
      alert("Redeem failed: " + prettyError(err));
      console.error("redeemTicket", err);
    } finally {
      setPerforming(false);
    }
  }, [
    walletAddress,
    isRedeeming,
    VRFPending,
    fetchWalletAssets,
    fetchStats,
    fetchREWARDS,
    ensureAmoy,
    findTicketsViaLogs,
    prettyError,
  ]);

  /* ------------------- CLAIM REWARDS ------------------- */
  const claimREWARDS = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    setPerforming(true);
    setError(null);
    try {
      await ensureAmoy();
      const ids = myNFTs
        .filter((x) => !x.isTicket)
        .map((x) => BigInt(x.tokenId));
      if (!ids.length) return alert("No eligible NFTs to claim.");

      const brl = getLiquidityContract();
      const tx = await brl.claim(ids);
      await tx.wait();

      await fetchREWARDS();
      await fetchStats();
      alert("REWARDS claimed.");
    } catch (err) {
      setError(err);
      alert("Claim failed: " + prettyError(err));
      console.error("claimREWARDS", err);
    } finally {
      setPerforming(false);
    }
  }, [
    walletAddress,
    myNFTs,
    fetchREWARDS,
    fetchStats,
    ensureAmoy,
    prettyError,
  ]);

  /* ------------------- LAST MINTED ------------------- */
  const fetchLastMinted = React.useCallback(async () => {
    try {
      const contract = getReadOnlyContract();
      const total = await contract.totalSupply();
      const lastId = Number(total.toString());
      const uri = await contract.tokenURI(lastId);
      const meta = await readJsonFromURI(uri);
      const image = resolveImageUrl(meta?.image, uri);
      setLastMinted({ tokenId: lastId, image });
    } catch (e) {
      console.error("fetchLastMinted", e);
    }
  }, []);

  /* ------------------- EVENT HANDLING ------------------- */
  React.useEffect(() => {
    const contract = getReadOnlyContract();
    const onTransfer = async (from, to, tid) => {
      if (!walletAddress) return;
      const me = walletAddress.toLowerCase();
      const fromL = (from || "").toLowerCase();
      const toL = (to || "").toLowerCase();
      const zeroL = ZeroAddress.toLowerCase();

      if (toL === me && fromL !== zeroL) {
        await fetchWalletAssets(walletAddress);
      } else if (fromL === me && toL !== zeroL) {
        setMyNFTs((prev) => prev.filter((x) => x.tokenId !== tid.toString()));
      }
    };

    contract.on("Transfer", onTransfer);
    unsubRef.current = () => {
      try {
        contract.off("Transfer", onTransfer);
      } catch (err) {
        console.debug("remove Transfer listener failed", err);
      }
    };
    return () => unsubRef.current();
  }, [walletAddress, fetchWalletAssets]);

  return {
    myNFTs,
    lastMinted,
    isRedeeming,
    VRFPending,
    redeemMsg,
    pendingTicketId,
    performing,
    error,
    mintTicket,
    redeemTicket,
    claimREWARDS,
    fetchWalletAssets,
    fetchLastMinted,
    setMyNFTs,
    setVRFPending,
    setIsRedeeming,
    setRedeemMsg,
  };
}



