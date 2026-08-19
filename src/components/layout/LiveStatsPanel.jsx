import * as React from "react";

const LiveStats = React.lazy(() => import("../LiveStats"));

export default function LiveStatsPanel({
  walletAddress,
  lastMinted,
  biggiMinted,
  maxSupply,
  ticketMinted,
  maxTickets,
  ticketPrice,
  blockMintCounts,
  BACKGROUND_NAMES,
  blockPrices,
  backgroundMintCounts,
  rewardPool,
  myClaimable,
  myNFTs,
  mintVolumeMatic,
  epochStartTs,
  userLastClaimTs,
  fetchChainNowTs,
  isMobile,
}) {
  return (
    <div
      className="widget-center-wrapper"
      id="live-stats"
      style={isMobile ? { paddingTop: 8 } : undefined}
    >
      <React.Suspense fallback={null}>
        <LiveStats
          walletAddress={walletAddress}
          lastImage={lastMinted.image}
          lastNftId={lastMinted.tokenId}
          lastBlockName={lastMinted.blockName}
          lastBackgroundName={lastMinted.backgroundName}
          lastContractAddress={lastMinted.contractAddress}
          lastChapterId={lastMinted.chapterId}
          lastFinalPrice={lastMinted?.finalPrice ?? null}
          biggiMinted={biggiMinted}
          maxSupply={maxSupply}
          ticketMinted={ticketMinted}
          maxTickets={maxTickets}
          ticketPrice={ticketPrice}
          blockMintCounts={blockMintCounts}
          blockNames={BACKGROUND_NAMES}
          blockPrices={blockPrices}
          backgroundMintCounts={backgroundMintCounts}
          rewardPool={rewardPool}
          myClaimable={myClaimable}
          items={myNFTs}
          mintVolumeMatic={mintVolumeMatic}
          epochStart={epochStartTs}
          userLastClaimTs={userLastClaimTs}
          weekSeconds={7 * 24 * 60 * 60}
          fetchChainNowTs={fetchChainNowTs}
          compact={isMobile}
        />
      </React.Suspense>
    </div>
  );
}
