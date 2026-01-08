import * as React from "react";
import { resetROProvider } from "../utils/contract";

export function useContractListeners({
  ZERO_ADDRESS,
  contractRef,
  getContract,
  setWalletAddress,
  setMyNFTs,
  setDynamicTraitsById,
  setVRFPending,
  setIsRedeeming,
  setRedeemMsg,
  setTopFirstId,
  setPendingTicketId,
  setRedeemStartBlock,
  setRedeemStartedAt,
  fetchStats,
  fetchREWARDS,
  fetchWalletAssets,
  fetchLastMinted,
  refreshVRFPanel,
  scheduleFetchStats,
  scheduleFetchREWARDS,
  enrichMetaWithPrices,
  readJsonFromURI,
  resolveImageUrl,
  unsubRef,
  walletAddress,
}) {
  return React.useCallback(
    (addr) => {
      try {
        const contract = contractRef.current || getContract();
        contractRef.current = contract;

        const zeroL = ZERO_ADDRESS.toLowerCase();

        const onTransfer = async (from, to, tokenId) => {
          try {
            const fromL = (from || "").toLowerCase();
            const toL = (to || "").toLowerCase();
            const me = addr.toLowerCase();
            const tid = tokenId.toString();

            scheduleFetchStats(800);
            scheduleFetchREWARDS(800);
            refreshVRFPanel();

            if (fromL === me && toL === zeroL) {
              setVRFPending(true);
              setRedeemMsg("Redeem confirmed. Waiting for VRF reveal...");
              if (typeof setRedeemStartedAt === "function") {
                setRedeemStartedAt((prev) => prev || Date.now());
              }
              setMyNFTs((prev) => prev.filter((x) => x.tokenId !== tid));
            }

            if (toL === me) {
              let isT = false;
              try {
                isT = await contract.isTicket(tid);
              } catch (err) {
                console.debug("isTicket check failed", err);
              }

              let meta = {};
              let image = "/images/Biggi.png";
              try {
                const uri = await contract.tokenURI(tid);
                const raw = await readJsonFromURI(uri);
                meta = await enrichMetaWithPrices(contract, tid, raw || {});
                const imageUrl = raw?.image || raw?.image_url;
                image = resolveImageUrl(imageUrl, uri) || image;
              } catch (err) {
                console.debug("onTransfer metadata read failed", err);
              }

              if (!isT) {
                setVRFPending(false);
                setIsRedeeming(false);
                setRedeemMsg("Reveal complete!");
                if (typeof setRedeemStartedAt === "function") {
                  setRedeemStartedAt(null);
                }
                setTimeout(() => setRedeemMsg(""), 3500);

                setMyNFTs((prev) => {
                  const withoutPending = prev.filter((x) => !x.isPending);
                  const withoutSame = withoutPending.filter(
                    (x) => x.tokenId !== tid,
                  );
                  const card = {
                    tokenId: tid,
                    image,
                    meta: meta || {},
                    isTicket: false,
                  };
                  return [card, ...withoutSame];
                });
                setTopFirstId(tid);
                setPendingTicketId(null);

                setTimeout(() => {
                  (async () => {
                    try {
                      await fetchWalletAssets(addr);
                    } catch (err) {
                      console.debug(
                        "fetchWalletAssets after transfer failed",
                        err,
                      );
                    }
                  })();
                }, 1500);
              } else {
                setMyNFTs((prev) => [
                  { tokenId: tid, image, meta: meta || {}, isTicket: true },
                  ...prev,
                ]);
              }
            }

            if (fromL === me && toL !== zeroL) {
              setMyNFTs((prev) => prev.filter((x) => x.tokenId !== tid));
            }
          } catch (e) {
            console.error("onTransfer", e);
          }
        };

        contract.on("Transfer", onTransfer);

        const handleAccountsChanged = async (accs) => {
          try {
            const a = accs?.[0] || "";
            setWalletAddress(a);
            resetROProvider();
            setMyNFTs([]);
            setDynamicTraitsById({});
            setVRFPending(false);
            setIsRedeeming(false);
            setRedeemMsg("");
            setTopFirstId(null);
            setPendingTicketId(null);
            setRedeemStartBlock(null);
            if (typeof setRedeemStartedAt === "function") {
              setRedeemStartedAt(null);
            }
            if (a) {
              await fetchStats();
              await fetchREWARDS();
              await fetchWalletAssets(a);
              await fetchLastMinted();
              await refreshVRFPanel();
            }
          } catch (err) {
            console.error("accountsChanged handler failed", err);
          }
        };

        const handleChainChanged = async () => {
          try {
            resetROProvider();
            await fetchStats();
            await fetchREWARDS();
            if (walletAddress) await fetchWalletAssets(walletAddress);
            setDynamicTraitsById({});
            if (typeof setRedeemStartedAt === "function") {
              setRedeemStartedAt(null);
            }
            await refreshVRFPanel();
          } catch (err) {
            console.error("chainChanged handler failed", err);
          }
        };

        window.ethereum?.on?.("accountsChanged", handleAccountsChanged);
        window.ethereum?.on?.("chainChanged", handleChainChanged);

        const prev = unsubRef.current;
        unsubRef.current = () => {
          try {
            contract.off("Transfer", onTransfer);
          } catch (err) {
            console.debug("remove Transfer listener failed", err);
          }
          window.ethereum?.removeListener?.(
            "accountsChanged",
            handleAccountsChanged,
          );
          window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
          prev?.();
        };
      } catch (e) {
        console.error("attachEventListeners", e);
        unsubRef.current = () => {};
      }
    },
    [
      ZERO_ADDRESS,
      contractRef,
      getContract,
      setWalletAddress,
      setMyNFTs,
      setDynamicTraitsById,
      setVRFPending,
      setIsRedeeming,
      setRedeemMsg,
      setTopFirstId,
      setPendingTicketId,
      setRedeemStartBlock,
      setRedeemStartedAt,
      fetchStats,
      fetchREWARDS,
      fetchWalletAssets,
      fetchLastMinted,
      refreshVRFPanel,
      scheduleFetchStats,
      scheduleFetchREWARDS,
      enrichMetaWithPrices,
      readJsonFromURI,
      resolveImageUrl,
      unsubRef,
      walletAddress,
    ],
  );
}



