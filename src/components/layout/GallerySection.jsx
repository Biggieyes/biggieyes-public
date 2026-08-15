import * as React from "react";
const Gallery = React.lazy(() => import("../Gallery"));

const HELP_ROWS = [
  {
    topic: "Image zoom",
    detail:
      "Click the thumbnail inside the card. A local zoom modal opens and can be closed with X.",
  },
  {
    topic: "Details",
    detail:
      "Use the Details button to open metadata with mint-time values and attributes.",
  },
  {
    topic: "Mint-time values",
    detail:
      "Metadata values are preferred; when unavailable, the UI falls back to on-chain recalculation.",
  },
  {
    topic: "Ticket vs NFT",
    detail:
      "A ticket is an entry pass. After Redeem, the final NFT is revealed via Chainlink VRF.",
  },
  {
    topic: "VRF pending",
    detail:
      "A short pending state after transaction confirmation is expected; the NFT appears automatically.",
  },
  {
    topic: "IPFS images",
    detail:
      "Images load from IPFS gateways, so the first open can take slightly longer.",
  },
];

function GalleryHelp() {
  return (
    <div role="region" aria-label="NFT card help" className="gallery-help">
      <div className="gallery-help__header">
        <strong>Card Help</strong>
        <span>Quick reference for ticket and NFT states</span>
      </div>
      <table className="gallery-help__table">
        <thead>
          <tr>
            <th scope="col">Topic</th>
            <th scope="col">How it works</th>
          </tr>
        </thead>
        <tbody>
          {HELP_ROWS.map((row) => (
            <tr key={row.topic}>
              <td>{row.topic}</td>
              <td>{row.detail}</td>
            </tr>
          ))}
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
  ticketPrice,
  dynamicTraitsById,
  topFirstId,
  setTopFirstId,
  fetchDynamicTraitsFor,
  setZoomImg,
  fetchWalletAssets,
  walletAddress,
  isMobile,
  sectionId = "gallery",
}) {
  const fetchWalletAssetsRef = React.useRef(fetchWalletAssets);

  React.useEffect(() => {
    fetchWalletAssetsRef.current = fetchWalletAssets;
  }, [fetchWalletAssets]);

  if (hideExtras) return null;

  React.useEffect(() => {
    if (!walletAddress) return;
    fetchWalletAssetsRef.current?.(walletAddress);
  }, [walletAddress]);

  return (
    <div className="gallery-section" id={sectionId || undefined}>
      <div className="gallery-section__header">
        <h2 style={{ color: "#fff", margin: 0 }}>My NFTs</h2>
        <button
          type="button"
          onClick={() => setCardsHelpOpen((v) => !v)}
          aria-label="Open NFT card help"
          aria-expanded={cardsHelpOpen ? "true" : "false"}
          title="Info"
          className={`gallery-section__info-btn${cardsHelpOpen ? " is-open" : ""}`}
        >
          <span className="gallery-section__info-icon" aria-hidden="true">
            i
          </span>
        </button>
      </div>

      {cardsHelpOpen && <GalleryHelp />}

      {galleryNotice ? (
        <div className="gallery__notice">{galleryNotice}</div>
      ) : null}

      {!galleryLoading && myNFTs.length === 0 ? (
        <div style={{ color: "#aaa" }}>You don't own any NFTs or tickets.</div>
      ) : null}

      <React.Suspense fallback={null}>
        <Gallery
          address={walletAddress}
          items={myNFTs}
          useProvidedOnly
          liveTicketPrice={ticketPrice}
          dynamicTraitsById={dynamicTraitsById}
          topFirstId={topFirstId}
          onOpenDetails={(nft) => {
            fetchDynamicTraitsFor(nft);
          }}
          onZoom={(nft) =>
            setZoomImg({
              src: nft?.image || "/images/Biggi.png",
              alt: nft?.name || nft?.meta?.name || "NFT zoom",
              anchorRect: nft?.anchorRect || null,
            })
          }
          compact={isMobile}
        />
      </React.Suspense>

    </div>
  );
}



