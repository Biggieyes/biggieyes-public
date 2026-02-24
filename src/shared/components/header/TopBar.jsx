import * as React from "react";
import ActionButtons from "./ActionButtons";
import IconRow from "./IconRow";

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
}) {
  return (
    <div className={`top-bar ${isMobile ? "mobile" : "desktop"}`}>
      {/* DESKTOP layout */}
      {!isMobile && (
        <>
          <div className="left-block">
            <img
              src="/images/main-logo1.png"
              className="left-logo"
              alt="BiggiEyes Logo"
            />
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
            />
          </div>

          <div className="panel-nav">
            <IconRow icons={icons} onIconClick={onIconClick} />
          </div>

          <div className="right-logo-group">
            <img
              src="/images/main-logo2.png"
              className="right-logo"
              alt="BiggiEyes Secondary Logo"
            />
            <div className="right-logo-desc">
              BiggiEyes: A Dynamic NFT ECOSYSTEM with Progression and a $500,000
              Grand Prize
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
            />
          </div>
        </>
      )}
    </div>
  );
}

export default React.memo(TopBar);



