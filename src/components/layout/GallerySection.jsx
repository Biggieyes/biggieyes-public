import * as React from "react";

const Gallery = React.lazy(() => import("../Gallery"));

export default function GallerySection({
  hideExtras,
  galleryLoading,
  galleryNotice,
  myNFTs,
  ticketPrice,
  activeTicketChapterId,
  activeTicketChapterCount,
  dynamicTraitsById,
  topFirstId,
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

  React.useEffect(() => {
    if (!walletAddress) return;
    fetchWalletAssetsRef.current?.(walletAddress);
  }, [walletAddress]);

  if (hideExtras) return null;

  return (
    <div className="gallery-section" id={sectionId || undefined}>
      {galleryNotice ? (
        <div className="gallery__notice">{galleryNotice}</div>
      ) : null}

      <React.Suspense fallback={null}>
        <Gallery
          address={walletAddress}
          items={myNFTs}
          loading={galleryLoading}
          useProvidedOnly
          liveTicketPrice={ticketPrice}
          activeTicketChapterId={activeTicketChapterId}
          activeTicketChapterCount={activeTicketChapterCount}
          dynamicTraitsById={dynamicTraitsById}
          topFirstId={topFirstId}
          onOpenDetails={fetchDynamicTraitsFor}
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
