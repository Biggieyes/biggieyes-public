// src/components/gallery/ZoomModal.jsx
import * as React from "react";
import Modal from "../common/Modal";

export default function ZoomModal({
  open = false,
  onClose,
  src = "/images/Biggi.png",
  alt = "NFT zoom",
  anchorRect = null,
  className = "nft-modal-img-zoom",
  style = {},
}) {
  const [viewport, setViewport] = React.useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const popupPosition = React.useMemo(() => {
    const safeW = Math.max(320, Number(viewport.width) || 0);
    const safeH = Math.max(320, Number(viewport.height) || 0);
    const isMobile = safeW <= 760;
    const margin = 10;

    const desiredWidth = Math.min(isMobile ? safeW * 0.72 : safeW * 0.36, 460);
    const desiredHeight = Math.min(isMobile ? safeH * 0.38 : safeH * 0.44, 440);

    const centered = {
      left: `${safeW / 2}px`,
      top: `${safeH / 2}px`,
      transform: "translate(-50%, -50%)",
      maxWidth: `${Math.max(180, Math.round(desiredWidth))}px`,
      maxHeight: `${Math.max(140, Math.round(desiredHeight))}px`,
    };

    if (!anchorRect || !Number.isFinite(Number(anchorRect?.left))) return centered;

    const top = Number(anchorRect.top) || 0;
    const bottom =
      Number(anchorRect.bottom) ||
      top + (Number(anchorRect.height) || 0);
    const centerX =
      (Number(anchorRect.left) || 0) + (Number(anchorRect.width) || 0) / 2;

    const spaceAbove = Math.max(0, top - margin);
    const spaceBelow = Math.max(0, safeH - bottom - margin);
    const placeAbove = spaceAbove >= 120 || spaceAbove >= spaceBelow;
    const availableHeight = placeAbove ? spaceAbove : spaceBelow;

    const maxHeight = Math.max(
      Math.min(availableHeight, desiredHeight),
      Math.min(96, availableHeight),
    );
    const maxWidth = Math.max(
      160,
      Math.min(desiredWidth, safeW - margin * 2),
    );

    const halfWidth = maxWidth / 2;
    const leftBound = margin + halfWidth;
    const rightBound = safeW - margin - halfWidth;
    const clampedX =
      leftBound > rightBound
        ? safeW / 2
        : Math.min(rightBound, Math.max(leftBound, centerX));

    const topPx = placeAbove ? top - 8 : bottom + 8;

    return {
      left: `${Math.round(clampedX)}px`,
      top: `${Math.round(topPx)}px`,
      transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      maxWidth: `${Math.round(maxWidth)}px`,
      maxHeight: `${Math.max(96, Math.round(maxHeight))}px`,
    };
  }, [anchorRect, viewport]);

  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && open) onClose?.();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      alignTop={false}
      preventScroll
      closeOnEsc
      windowClassName="zoom-modal-window"
      overlayClassName="zoom-modal-overlay"
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "fixed",
            left: popupPosition.left,
            top: popupPosition.top,
            transform: popupPosition.transform,
            padding: 8,
            pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
            onError={(e) => (e.currentTarget.src = "/images/Biggi.png")}
            style={{
              maxWidth: popupPosition.maxWidth,
              maxHeight: popupPosition.maxHeight,
              objectFit: "contain",
              borderRadius: 16,
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
              transition: "transform 0.2s ease",
              ...style,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </Modal>
  );
}

