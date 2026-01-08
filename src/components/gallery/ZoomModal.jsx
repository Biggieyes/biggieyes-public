// src/components/gallery/ZoomModal.jsx
import * as React from "react";
import Modal from "../common/Modal";

export default function ZoomModal({
  open = false,
  onClose,
  src = "/images/Biggi.png",
  alt = "NFT zoom",
  className = "nft-modal-img-zoom",
  style = {},
}) {
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
        }}
      >
        <img
          src={src}
          alt={alt}
          className={className}
          loading="React.lazy"
          decoding="async"
          onError={(e) => (e.currentTarget.src = "/images/Biggi.png")}
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
      </div>
    </Modal>
  );
}

