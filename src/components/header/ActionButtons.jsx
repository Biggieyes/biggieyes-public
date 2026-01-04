import * as React from "react";
import "./InfoButton.css";

const ProjectInfoModal = React.lazy(() => import("../INFO/ProjectInfoModal"));

export default function ActionButtons({
  onMint,
  onRedeem,
  onClaim,
  isRedeeming,
  vrfPending,
  performing = false,
  actionError = null,
}) {
  const lockRef = React.useRef(false);
  const [infoOpen, setInfoOpen] = React.useState(false);

  const redeemDisabled = Boolean(isRedeeming || vrfPending || performing);
  const actionDisabled = Boolean(performing);
  const errorText = React.useMemo(() => {
    if (!actionError) return "";
    if (typeof actionError === "string") return actionError;
    return (
      actionError?.data?.message ||
      actionError?.reason ||
      actionError?.message ||
      String(actionError)
    );
  }, [actionError]);

  const runOnce = (handler, isDisabled) => () => {
    if (isDisabled || lockRef.current) return;
    lockRef.current = true;
    try { handler?.(); } finally {
      setTimeout(() => { lockRef.current = false; }, 800);
    }
  };

  const baseWrapperStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 14,
    backgroundColor: "#000",
    backgroundImage: 'url("/images/blocks-bg2.png")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    transition: "border-color .18s ease, box-shadow .18s ease, transform .12s ease",
    flex: "0 0 auto",
    margin: 5,
    position: "relative",
    overflow: "visible",
  };

  const buttonWrapper = (src, alt, onClick, options = {}) => {
    const {
      isDisabled = false,
      borderColor = "#1abc9c",
      glow = "rgba(26, 188, 156, 0.6)",
      variant,
    } = options;

    const hoverGlow = glow.replace(/([0-9]*\.?[0-9]+)\s*\)$/g, (_, alpha) => {
      const numeric = parseFloat(alpha);
      if (Number.isNaN(numeric)) return `${alpha})`;
      const bumped = Math.min(0.95, numeric + 0.2);
      return `${bumped.toFixed(2)})`;
    });

    const handleWrapperEnter = (event) => {
      if (isDisabled) return;
      event.currentTarget.style.boxShadow = `0 0 20px ${hoverGlow}`;
    };
    const handleWrapperLeave = (event) => {
      if (isDisabled) return;
      event.currentTarget.style.boxShadow = `0 0 12px ${glow}`;
    };
    const handleImageEnter = (event) => {
      if (isDisabled) return;
      event.currentTarget.style.transform = "scale(1.05)";
    };
    const handleImageLeave = (event) => {
      if (isDisabled) return;
      event.currentTarget.style.transform = "scale(1)";
    };

    return (
      <div
        className={`action-buttons__wrapper${variant ? ` action-buttons__wrapper--${variant}` : ""}`}
        style={{
          ...baseWrapperStyle,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 12px ${glow}`,
          opacity: isDisabled ? 0.65 : 1,
          pointerEvents: isDisabled ? "none" : "auto",
        }}
        onMouseEnter={handleWrapperEnter}
        onMouseLeave={handleWrapperLeave}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={isDisabled}
          aria-disabled={isDisabled || undefined}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isDisabled ? "not-allowed" : "pointer",
            borderRadius: 10,
            width: 100,
            height: 100,
            overflow: "hidden",
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              imageRendering: "pixelated",
              transition: "transform .15s ease",
            }}
            onMouseEnter={handleImageEnter}
            onMouseLeave={handleImageLeave}
          />
        </button>
      </div>
    );
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginTop: 30,
    }}>
      <div style={{
        display: "flex",
        gap: 10,
        justifyContent: "center",
        flexWrap: "wrap",
      }}>
        {buttonWrapper("/images/mint.png", "Mint Ticket", runOnce(onMint, actionDisabled), {
          isDisabled: actionDisabled,
          variant: "mint",
          borderColor: "#26f7d1",
          glow: "rgba(38, 247, 209, 0.55)",
        })}
        {buttonWrapper("/images/claim.png", "Claim Rewards", runOnce(onClaim, actionDisabled), {
          isDisabled: actionDisabled,
          variant: "mint",
          borderColor: "#26f7d1",
          glow: "rgba(38, 247, 209, 0.55)",
        })}
      </div>
      <div style={{
        display: "flex",
        gap: 10,
        marginTop: 10,
        justifyContent: "center",
        flexWrap: "wrap",
      }}>
        {buttonWrapper("/images/redeem-button.png", "Redeem Ticket", runOnce(onRedeem, redeemDisabled), {
          isDisabled: redeemDisabled,
          variant: "mint",
          borderColor: "#26f7d1",
          glow: "rgba(38, 247, 209, 0.55)",
        })}
        {buttonWrapper("/images/icons/info.png", "Project Info", () => setInfoOpen(true), {
          borderColor: "#ffe800",
          glow: "rgba(255, 232, 0, 0.6)",
        })}
      </div>

      {(performing || errorText) && (
        <div style={{
          marginTop: 10,
          textAlign: "center",
          fontSize: 12,
          color: "#ffd54f",
          maxWidth: 320,
        }}>
          {performing && <div>Processing transaction...</div>}
          {errorText && (
            <div role="alert" style={{ color: "#ff7b7b" }}>
              Last error: {errorText}
            </div>
          )}
        </div>
      )}

      {infoOpen && (
        <React.Suspense fallback={null}>
          <ProjectInfoModal
            open
            onClose={() => setInfoOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
}
