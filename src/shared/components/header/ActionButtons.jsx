import * as React from "react";
import "./InfoButton.css";

// Lazy-load modal (keeps initial bundle smaller)
const ProjectInfoModal = React.lazy(() =>
  import("../../../ACTIONBUTTONS/INFO/ProjectInfoModal.jsx"),
);

const BUTTON_IMAGE_SOURCES = {
  mint: {
    src: "/images/mint.optimized.lossless.webp",
    fallbackSrc: "/images/mint.fallback.png",
  },
  claim: {
    src: "/images/claim.optimized.lossless.webp",
    fallbackSrc: "/images/claim.fallback.png",
  },
  redeem: {
    src: "/images/redeem-button.optimized.lossless.webp",
    fallbackSrc: "/images/redeem-button.fallback.png",
  },
  info: {
    src: "/images/icons/info.optimized.lossless.webp",
    fallbackSrc: "/images/icons/info.fallback.png",
  },
};

export default function ActionButtons({
  onMint,
  onRedeem,
  onClaim,
  isRedeeming,
  VRFPending,
  performing = false,
  performingLabel = "",
  actionError = null,
  isMobile = false,
  infoGateActive = false,
  onInfoGateComplete,
  onInfoButtonRect,
  forceInfoOpenTick = 0,
  mintDisabledReason = "",
}) {
  const lockRef = React.useRef(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const infoButtonRef = React.useRef(null);

  const gateActive = Boolean(infoGateActive);
  const redeemDisabled = Boolean(isRedeeming || VRFPending || performing || gateActive);
  const actionDisabled = Boolean(performing || gateActive);
  const mintDisabled = Boolean(actionDisabled || mintDisabledReason);

  React.useEffect(() => {
    if (forceInfoOpenTick > 0) setInfoOpen(true);
  }, [forceInfoOpenTick]);

  const reportInfoRect = React.useCallback(() => {
    if (!onInfoButtonRect || !infoButtonRef.current) return;
    const rect = infoButtonRef.current.getBoundingClientRect();
    onInfoButtonRect({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
  }, [onInfoButtonRect]);

  React.useLayoutEffect(() => {
    if (!gateActive) return;
    reportInfoRect();
  }, [gateActive, isMobile, reportInfoRect]);

  React.useEffect(() => {
    if (!gateActive) return;
    const handler = () => reportInfoRect();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [gateActive, reportInfoRect]);

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
    try {
      handler?.();
    } finally {
      setTimeout(() => {
        lockRef.current = false;
      }, 800);
    }
  };

  const baseWrapperStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 14,
    backgroundColor: "#000",
    backgroundImage: "none",
    transition: "border-color .18s ease, box-shadow .18s ease, transform .12s ease",
    flex: "0 0 auto",
    margin: 5,
    position: "relative",
    overflow: "visible",
  };

  const buttonWrapper = (image, alt, onClick, options = {}) => {
    const {
      isDisabled = false,
      borderColor = "#1abc9c",
      glow = "rgba(26, 188, 156, 0.6)",
      variant,
      wrapperClassName,
      wrapperStyle,
      wrapperRef,
      disabledReason = "",
    } = options;
    const resolvedImage =
      typeof image === "string" ? { src: image, fallbackSrc: "" } : image;

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
        className={`action-buttons__wrapper${variant ? ` action-buttons__wrapper--${variant}` : ""}${
          wrapperClassName ? ` ${wrapperClassName}` : ""
        }`}
        ref={wrapperRef}
        style={{
          ...baseWrapperStyle,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 12px ${glow}`,
          ...wrapperStyle,
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
          aria-label={isDisabled && disabledReason ? `${alt}: ${disabledReason}` : alt}
          aria-disabled={isDisabled || undefined}
          title={isDisabled && disabledReason ? `${alt}: ${disabledReason}` : alt}
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
            src={resolvedImage.src}
            alt={alt}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            width="100"
            height="100"
            onError={(event) => {
              if (!resolvedImage.fallbackSrc) return;
              if (event.currentTarget.dataset.fallbackApplied === "1") return;
              event.currentTarget.dataset.fallbackApplied = "1";
              event.currentTarget.src = resolvedImage.fallbackSrc;
            }}
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

  const stackAlign = isMobile ? "center" : "flex-start";
  const stackWidth = isMobile ? "100%" : "auto";
  const rowJustify = isMobile ? "center" : "space-between";
  const rowWidth = isMobile ? "100%" : 240;
  const rowMaxWidth = isMobile ? 320 : 240;
  const headingAlign = isMobile ? "center" : "flex-start";
  const headingTextAlign = isMobile ? "center" : "left";

  return (
    <div
      className="action-buttons-stack"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: stackAlign,
        width: stackWidth,
        marginTop: 30,
      }}
    >
      <div
        className="action-buttons-heading"
        style={{
          alignItems: headingAlign,
          textAlign: headingTextAlign,
        }}
      >
        <div className="action-buttons-heading__title">
          BiggiEyes — On-Chain NFT Economy Protocol
        </div>
        <div className="action-buttons-heading__subtitle">
          Mint NFTs, gain rarity, and watch the ecosystem create value for BIGGI
          holders.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: rowJustify,
          flexWrap: "nowrap",
          width: rowWidth,
          maxWidth: rowMaxWidth,
        }}
      >
        {buttonWrapper(
          BUTTON_IMAGE_SOURCES.mint,
          "Mint Ticket",
          runOnce(onMint, mintDisabled),
          {
            isDisabled: mintDisabled,
            disabledReason: mintDisabledReason,
            variant: "mint",
            borderColor: "#26f7d1",
            glow: "rgba(38, 247, 209, 0.55)",
          },
        )}
        {buttonWrapper(
          BUTTON_IMAGE_SOURCES.claim,
          "Claim REWARDS",
          runOnce(onClaim, actionDisabled),
          {
            isDisabled: actionDisabled,
            variant: "mint",
            borderColor: "#26f7d1",
            glow: "rgba(38, 247, 209, 0.55)",
          },
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          justifyContent: rowJustify,
          flexWrap: "nowrap",
          width: rowWidth,
          maxWidth: rowMaxWidth,
        }}
      >
        {buttonWrapper(
          BUTTON_IMAGE_SOURCES.redeem,
          "Redeem Ticket",
          runOnce(onRedeem, redeemDisabled),
          {
            isDisabled: redeemDisabled,
            variant: "mint",
            borderColor: "#26f7d1",
            glow: "rgba(38, 247, 209, 0.55)",
          },
        )}
        {buttonWrapper(
          BUTTON_IMAGE_SOURCES.info,
          "Project Info",
          () => setInfoOpen(true),
          {
            borderColor: "#ffe800",
            glow: gateActive ? "rgba(255, 232, 0, 0.95)" : "rgba(255, 232, 0, 0.6)",
            wrapperClassName: gateActive ? "info-gate-target" : undefined,
            wrapperRef: infoButtonRef,
          },
        )}
      </div>

      {(mintDisabledReason || performing || errorText) && (
        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 12,
            color: "#ffd54f",
            maxWidth: 320,
          }}
        >
          {mintDisabledReason && !performing && (
            <div>Mint: {mintDisabledReason}</div>
          )}
          {performing && (
            <div>{performingLabel || "Processing transaction..."}</div>
          )}
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
            onClose={() => {
              setInfoOpen(false);
              if (gateActive) onInfoGateComplete?.();
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
}
