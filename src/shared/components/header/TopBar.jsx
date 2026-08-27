import * as React from "react";
import ActionButtons from "./ActionButtons";
import IconRow from "./IconRow";

const TOPBAR_LOGOS = {
  primary: {
    src: "/images/main-logo1.optimized.lossless.webp",
    fallbackSrc: "/images/main-logo1.fallback.png",
    width: 460,
    height: 307,
  },
  secondary: {
    src: "/images/main-logo2.optimized.lossless.webp",
    fallbackSrc: "/images/main-logo2.fallback.png",
    width: 368,
    height: 245,
  },
};

const OPENSEA_BIGGI_URL =
  "https://opensea.io/collection/biggi-ticket-339884819/overview";

const BIGGI_STORY_PARAGRAPHS = [
  "In BiggiVerse, eye colors are not style like in our world - they are maps of origin. This universe is split into 10 blocks (10 zones of reality), and each zone leaves a trace: an eye color and a distinct type of background. That is why eyes and backgrounds in BiggiEyes actually mean something - they show which layer of BiggiVerse a being comes from.",
  "The main character is a human boy named Biggi. When you mint, you do not get a finished being right away - you get a Ticket featuring Biggi. The Ticket is fully tradable (you can buy it, sell it, transfer it), because in BiggiVerse the chance to transform has real value. The Ticket price increases dynamically after every mint, so holding a Ticket can be worthwhile even without redeeming it. At the same time, the Ticket provides no extra perks and no weekly rewards - it is purely a tradable entry pass with a rising price.",
  "Redeem is the moment Biggi enters the Archive of Eyes - a place where his possible future forms are stored on IPFS. No person and no team decides which form you get: it is chosen fairly by VRF (verifiable randomness). VRF selects one specific mutation, and the Ticket becomes the final NFT - Biggi's mutated form with a specific eye color (block) and background. This NFT is also tradable, and only these finalized NFTs make sense for weekly rewards and other on-chain mechanics tied to a specific block or rarity.",
  "Weekly rewards are calculated from finalized NFTs only. Your owned blocks and rarities define your reward weight, and each cycle settles through transparent on-chain accounting. In short: tickets are entry assets, while redeemed NFTs are the reward-producing assets.",
  "The ecosystem is built as one connected loop: mint flow, REWARDS pool, BUYBACK actions, DRIP distribution, and liquidity routing. The tokenomics dashboards expose these links so you can see where value moves, how pools are funded, and how weekly payouts stay anchored to real contract state.",
  "A Ticket can also gain value for a second reason: the outcome of redeem has its own market logic. Some revealed NFTs can become the missing piece someone needs - for example to qualify for Collection Rewards or other collection-based conditions. So even the Ticket itself can be more valuable, because it carries the potential to turn into exactly the NFT someone is hunting for.",
  "The series always has five chapters. Each chapter works the same way: first comes the VRF collection (always 550 Tickets). The VRF chapter also creates the truth of pricing: the VRF collection determines the block prices (eye colors and rarities) used for the follow-up mint. Only after every Ticket in that VRF chapter is sold out does the Public collection for that chapter unlock. The Public mint then uses the block prices set by the VRF collection - meaning Public always follows what actually happened in the VRF episode, not a manually fixed number.",
  "On top of that there is a game within the game: some NFTs across the series may randomly include a Secret Key - a rare fragment that becomes usable only in the final collection of the entire series. And sometimes metadata includes a Free Ticket - a free entry into the next VRF episode, pushing you into the next chapter without paying again.",
  "Everything leads to the finale: Last Episode. This is the closing chapter of the entire series, where the Secret Key turns from a rare detail into a crucial element, and where the main meta-reward awaits: $500,000. Because BiggiEyes is a story about sight and perception, Last Episode also has a real-world impact: a portion of the proceeds from Last Episode will be sent to a transparent account of a non-profit organization supporting children with visual impairments - publicly traceable and verifiable.",
];

function TopBar({
  onMint,
  onRedeem,
  onClaim,
  isRedeeming,
  VRFPending,
  actionPerforming,
  actionStatusLabel,
  actionError,
  icons = [], // ✅ fallback, kdyby ještě nebyly k dispozici
  onIconClick,
  isMobile = false, // ⬅️ přijmeme od Appu
  infoGateActive = false,
  onInfoGateComplete,
  onInfoButtonRect,
  forceInfoOpenTick = 0,
  mintDisabledReason = "",
}) {
  return (
    <div className={`top-bar ${isMobile ? "mobile" : "desktop"}`}>
      {/* DESKTOP layout */}
      {!isMobile && (
        <>
          <div className="left-block">
            <div className="left-logo-row">
              <a
                className="opensea-btn-top"
                href={OPENSEA_BIGGI_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Open BiggiEyes on OpenSea"
              >
                <span className="opensea-icon" aria-hidden>
                  OS
                </span>
                <span className="wallet-btn-label">OpenSea</span>
              </a>
              <img
                src={TOPBAR_LOGOS.primary.src}
                className="left-logo"
                alt="BiggiEyes Logo"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={TOPBAR_LOGOS.primary.width}
                height={TOPBAR_LOGOS.primary.height}
                onError={(event) => {
                  if (event.currentTarget.dataset.fallbackApplied === "1") return;
                  event.currentTarget.dataset.fallbackApplied = "1";
                  event.currentTarget.src = TOPBAR_LOGOS.primary.fallbackSrc;
                }}
              />
            </div>
            <ActionButtons
              onMint={onMint}
              onRedeem={onRedeem}
              onClaim={onClaim}
              isRedeeming={isRedeeming}
              VRFPending={VRFPending}
              performing={actionPerforming}
              performingLabel={actionStatusLabel}
              actionError={actionError}
              isMobile={isMobile}
              infoGateActive={infoGateActive}
              onInfoGateComplete={onInfoGateComplete}
              onInfoButtonRect={onInfoButtonRect}
              forceInfoOpenTick={forceInfoOpenTick}
              mintDisabledReason={mintDisabledReason}
            />
          </div>

          <div className="panel-nav">
            <IconRow icons={icons} onIconClick={onIconClick} />
          </div>

          <div className="right-logo-group">
            <img
              src={TOPBAR_LOGOS.secondary.src}
              className="right-logo"
              alt="BiggiEyes Secondary Logo"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              width={TOPBAR_LOGOS.secondary.width}
              height={TOPBAR_LOGOS.secondary.height}
              onError={(event) => {
                if (event.currentTarget.dataset.fallbackApplied === "1") return;
                event.currentTarget.dataset.fallbackApplied = "1";
                event.currentTarget.src = TOPBAR_LOGOS.secondary.fallbackSrc;
              }}
            />
            <div className="right-logo-story-caption">
              Below is the Biggi story. Scroll to read it from the beginning.
            </div>
            <div className="right-logo-desc right-logo-story">
              {BIGGI_STORY_PARAGRAPHS.map((paragraph, idx) => (
                <p className="right-logo-story__paragraph" key={`story-${idx}`}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </>
      )}

      {/* MOBILE layout */}
      {isMobile && (
        <>
          <div className="mobile-icons">
            <div className="panel-nav panel-nav--mobile">
              <IconRow icons={icons} onIconClick={onIconClick} />
            </div>
          </div>

          <div className="mobile-actions">
            <ActionButtons
              onMint={onMint}
              onRedeem={onRedeem}
              onClaim={onClaim}
              isRedeeming={isRedeeming}
              VRFPending={VRFPending}
              performing={actionPerforming}
              performingLabel={actionStatusLabel}
              actionError={actionError}
              isMobile
              infoGateActive={infoGateActive}
              onInfoGateComplete={onInfoGateComplete}
              onInfoButtonRect={onInfoButtonRect}
              forceInfoOpenTick={forceInfoOpenTick}
              mintDisabledReason={mintDisabledReason}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default React.memo(TopBar);
