import * as React from "react";
import ActionButtons from "./ActionButtons";
import IconRow from "./IconRow";

function TopBar({
  onMint,
  onRedeem,
  onClaim,
  isRedeeming,
  vrfPending,
  actionPerforming,
  actionError,
  icons = [],        // ✅ fallback, kdyby ještě nebyly k dispozici
  onIconClick,
  isMobile = false,  // ⬅️ přijmeme od Appu
}) {
  return (
    <div className={`top-bar ${isMobile ? "mobile" : "desktop"}`}>
      {/* DESKTOP layout */}
      {!isMobile && (
        <>
          <div className="left-block">
            <img src="/images/main-logo1.png" className="left-logo" alt="BiggiEyes Logo" />
            <ActionButtons
              onMint={onMint}
              onRedeem={onRedeem}
              onClaim={onClaim}
              isRedeeming={isRedeeming}
              vrfPending={vrfPending}
              performing={actionPerforming}
              actionError={actionError}
            />
          </div>

          <IconRow icons={icons} onIconClick={onIconClick} />

          <div className="right-logo-group">
            <img src="/images/main-logo2.png" className="right-logo" alt="BiggiEyes Secondary Logo" />
            <div className="right-logo-desc">
              BiggiEyes: A Dynamic NFT Ecosystem with Progression and a $500,000 Grand Prize
            </div>
          </div>
        </>
      )}

      {/* MOBILE layout */}
      {isMobile && (
        <>
          <div className="mobile-hero">
            <img src="/images/main-logo1.png" className="mobile-hero__logo" alt="BiggiEyes Logo" />
          </div>

          <div className="mobile-icons">
            <IconRow icons={icons} onIconClick={onIconClick} />
          </div>

          <div className="mobile-actions">
            <ActionButtons
              onMint={onMint}
              onRedeem={onRedeem}
              onClaim={onClaim}
              isRedeeming={isRedeeming}
              vrfPending={vrfPending}
              performing={actionPerforming}
              actionError={actionError}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default React.memo(TopBar);