import * as React from "react";
import NFTStatusBlock from "./NFTStatusBlock";

const Gallery = React.lazy(() => import("../Gallery"));

function GalleryHelp() {
  return (
    <div
      role="region"
      aria-label="NFT card help"
      style={{
        marginTop: 10,
        background: "rgba(0,0,0,0.55)",
        border: "1px solid #00ffd0",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,.35)",
      }}
    >
      <table
        className="nft-attributes-table"
        style={{ width: "100%", fontSize: 14, color: "#e9f2ff" }}
      >
        <tbody>
          <tr>
            <td style={{ opacity: 0.8, padding: "6px 8px" }}>Image zoom</td>
            <td style={{ padding: "6px 8px" }}>
              Click the thumbnail inside the card - a local zoom opens with the
              X button.
            </td>
          </tr>
          <tr>
            <td style={{ opacity: 0.8, padding: "6px 8px" }}>Details</td>
            <td style={{ padding: "6px 8px" }}>
              The "Details" button expands the metadata: Mint-time values and
              Attributes.
            </td>
          </tr>
          <tr>
            <td style={{ opacity: 0.8, padding: "6px 8px" }}>
              Mint-time values
            </td>
            <td style={{ padding: "6px 8px" }}>
              Prefer the values from metadata. When they are missing, they are
              recalculated from on-chain data as a fallback.
            </td>
          </tr>
          <tr>
            <td style={{ opacity: 0.8, padding: "6px 8px" }}>Ticket vs. NFT</td>
            <td style={{ padding: "6px 8px" }}>
              A ticket is an entry pass. After "Redeem" the final NFT is
              revealed via VRF.
            </td>
          </tr>
          <tr>
            <td style={{ opacity: 0.8, padding: "6px 8px" }}>VRF pending</td>
            <td style={{ padding: "6px 8px" }}>
              After the transaction is confirmed you may briefly see a pending
              state; the NFT appears automatically.
            </td>
          </tr>
          <tr>
            <td style={{ opacity: 0.8, padding: "6px 8px" }}>IPFS images</td>
            <td style={{ padding: "6px 8px" }}>
              Images load from IPFS; the first view may take a bit longer.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function GallerySection({
  cardsHelpOpen,
  setCardsHelpOpen,
  hideExtras,
  galleryLoading,
  galleryNotice,
  myNFTs,
  dynamicTraitsById,
  setTopFirstId,
  fetchDynamicTraitsFor,
  setZoomImg,
  VRFPending,
  isRedeeming,
  redeemMsg,
  fetchStats,
  fetchREWARDS,
  fetchWalletAssets,
  walletAddress,
  isMobile,
}) {
  if (hideExtras) return null;

  React.useEffect(() => {
    if (!walletAddress) return;
    if (VRFPending || isRedeeming) return;
    fetchWalletAssets(walletAddress);
  }, [walletAddress, VRFPending, isRedeeming, fetchWalletAssets]);

  return (
    <div className="gallery-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ color: "#fff", margin: 0 }}>My NFTs</h2>
        <button
          type="button"
          onClick={() => setCardsHelpOpen((v) => !v)}
          aria-label="Open NFT card help"
          aria-expanded={cardsHelpOpen ? "true" : "false"}
          title="Info"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#ffe800",
            color: "#111",
            border: "2px solid #00ffd0",
            fontWeight: 900,
            cursor: "pointer",
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,.35)",
          }}
        >
          i
        </button>
      </div>

      {cardsHelpOpen && <GalleryHelp />}

      <NFTStatusBlock
        isRedeeming={isRedeeming}
        VRFPending={VRFPending}
        redeemMsg={redeemMsg}
        isMobile={isMobile}
        fetchStats={fetchStats}
        fetchREWARDS={fetchREWARDS}
        fetchWalletAssets={fetchWalletAssets}
        walletAddress={walletAddress}
        galleryLoading={galleryLoading}
        myNFTs={myNFTs}
      />

      {galleryNotice ? (
        <div className="gallery__notice">{galleryNotice}</div>
      ) : null}

      <React.Suspense fallback={null}>
        <Gallery
          address={walletAddress}
          items={myNFTs}
          dynamicTraitsById={dynamicTraitsById}
          onOpenDetails={(nft) => {
            setTopFirstId((prev) => prev || (nft?.tokenId ?? null));
            fetchDynamicTraitsFor(nft);
          }}
          onZoom={(nft) => setZoomImg(nft.image)}
          compact={isMobile}
          useProvidedOnly
        />
      </React.Suspense>

      {VRFPending && (
        <div
          style={{
            marginTop: 10,
            color: "#ffe800",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          VRF pending - your NFT will appear automatically once revealed.
        </div>
      )}
    </div>
  );
}



