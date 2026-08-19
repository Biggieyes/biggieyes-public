import * as React from "react";
import ModalPortal from "../../shared/components/ModalPortal.jsx";

/**
 * Minimal Modal wrapper (compat) used by legacy ZoomModal and other components.
 * Keeps the API simple: open/onClose/children.
 */
export default function Modal({ open, onClose, children }) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
        onClick={() => onClose?.()}
      >
        <div
          style={{ maxWidth: "95vw", maxHeight: "95vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
