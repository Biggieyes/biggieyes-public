// src/components/LoadingOverlay.jsx
import * as React from "react";
import * as PropTypes from "prop-types";
import "./LoadingOverlay.css";

/**
 * Vylepšená LoadingOverlay — backward compatible:
 * - pokud open === false -> nic nerenderuje
 * - podporuje onClose (Escape)
 * - lepší ARIA / accessibility
 * - safe clamping percent 0..100
 */
export default function LoadingOverlay({
  open = true,
  percent = 0,
  message = "Loading data...",
  title = "BiggiEyes",
  showPercent = true,
  onClose = null,
}) {
  const progressRef = React.useRef(null);

  // bezpečné ošetření percent (číslo, 0..100)
  const p = Number.isFinite(percent) ? Math.floor(percent) : 0;
  const clamped = Math.min(100, Math.max(0, p));

  React.useEffect(() => {
    // animace šířky přímo na elementu (pokud existuje)
    if (progressRef.current) {
      progressRef.current.style.width = `${clamped}%`;
    }
  }, [clamped]);

  // zavření přes Escape (pokud onClose existuje)
  React.useEffect(() => {
    if (typeof onClose !== "function") return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="loading-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="loading-card" role="document">
        <h1>{title}</h1>

        <div className="progress-wrap" aria-hidden="true">
          <div
            className="progress-bar"
            ref={progressRef}
            style={{ width: `${clamped}%` }}
          />
        </div>

        {showPercent && (
          <div className="percent" aria-live="polite">
            {clamped}%
          </div>
        )}

        <div className="msg">{message}</div>
      </div>
    </div>
  );
}

LoadingOverlay.propTypes = {
  open: PropTypes.bool,
  percent: PropTypes.number,
  message: PropTypes.string,
  title: PropTypes.string,
  showPercent: PropTypes.bool,
  onClose: PropTypes.func,
};
