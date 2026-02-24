// src/components/gallery/ZoomModal.jsx
import * as React from "react";
import Modal from "../../../components/common/Modal";

export default function ZoomModal({
  open = false,
  onClose,
  src = "/images/Biggi.png",
  alt = "NFT zoom",
  className = "nft-modal-img-zoom",
  style = {},
}) {
  const [imgSrc, setImgSrc] = React.useState(src || "/images/Biggi.png");
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgFailed, setImgFailed] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  React.useEffect(() => {
    setImgSrc(src || "/images/Biggi.png");
    setImgLoaded(false);
    setImgFailed(false);
  }, [src]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    handleStatus();
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const isIpfsSrc = React.useMemo(() => {
    const raw = String(src || "").toLowerCase();
    return (
      raw.includes("ipfs://") ||
      raw.includes("/ipfs/") ||
      raw.includes("ipns://") ||
      raw.includes("/ipns/") ||
      raw.includes("pinata") ||
      raw.includes("mypinata") ||
      raw.includes("ipfs")
    );
  }, [src]);

  const showFallback =
    isIpfsSrc && (imgFailed || (!imgLoaded && isOffline));

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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
          position: "relative",
        }}
      >
        <img
          src={imgSrc}
          alt={alt}
          className={className}
          loading="React.lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgFailed(true);
            setImgSrc("/images/Biggi.png");
          }}
          style={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 16,
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
            transition: "transform 0.2s ease",
            ...style,
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {showFallback && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 12,
              background: "rgba(6, 10, 20, 0.72)",
              color: "#9adfff",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              pointerEvents: "none",
            }}
          >
            IPFS image offline
          </div>
        )}
      </div>
    </Modal>
  );
}

