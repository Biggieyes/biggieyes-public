import * as React from "react";
import { FUTURE_COLLECTIONS } from "./COLLECTIONBlocksGrid.constants";

/**
 * FutureCollectionsModal - Displays upcoming COLLECTIONs preview
 * @component
 */
const FutureCollectionsModal = React.memo(
  ({ isOpen, onClose, futureStats }) => {
    if (!isOpen) return null;

    const handleOverlayClick = () => onClose();
    const handleModalClick = (e) => e.stopPropagation();

    const displayedCOLLECTIONs = Array.isArray(FUTURE_COLLECTIONS)
      ? FUTURE_COLLECTIONS
      : [];
    const safeStats = futureStats || {
      totalCOLLECTIONs: displayedCOLLECTIONs.length,
      totalItems: 0,
      avgMintPrice: 0,
      highProgress: 0,
    };

    return (
      <div
        className="collection-grid__future-overlay"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="future-modal-title"
      >
        <div
          className="collection-grid__future-modal biggi-token-surface"
          onClick={handleModalClick}
        >
          <header
            className="rewards-grid__header biggi-header panel-header panel-header--collection"
            style={{ marginBottom: 20 }}
          >
            <div className="rewards-grid__headline">
              <h2 id="future-modal-title" className="rewards-grid__title">
                Future COLLECTIONs
              </h2>
              <p className="rewards-grid__subtitle">
                Preview upcoming collection drops being prepared for
                Distributor integration. Track planned rarity tiers, reward
                hooks, and launch readiness before public rollout.
              </p>
            </div>
            <div className="rewards-grid__header-actions">
              <button
                type="button"
                onClick={onClose}
                className="collection-grid__close-btn"
                aria-label="Close future COLLECTIONs modal"
              >
                Close
              </button>
            </div>
          </header>

          <div className="collection-grid__stat-cards">
            {[
              {
                label: "COLLECTIONs",
                value:
                  safeStats.totalCOLLECTIONs ?? displayedCOLLECTIONs.length,
              },
              {
                label: "Total Items",
                value: (safeStats.totalItems ?? 0).toLocaleString(),
              },
              {
                label: "Avg Mint",
                value: `${(safeStats.avgMintPrice ?? 0).toFixed(2)} ETH`,
              },
              { label: "Launch-ready", value: safeStats.highProgress ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="collection-grid__stat-card">
                <div className="muted">{stat.label}</div>
                <div className="collection-grid__stat-value-large">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="collection-grid__future-grid">
            {displayedCOLLECTIONs.length ? (
              displayedCOLLECTIONs.map((COLLECTION) => (
                <article
                  key={COLLECTION.id}
                  className="collection-grid__future-card"
                >
                  <div className="biggi-card__glow" aria-hidden />
                  <div className="collection-grid__future-card-heading">
                    <h3>{COLLECTION.name}</h3>
                    <p>{COLLECTION.description}</p>
                  </div>
                  <div className="collection-grid__future-card-info">
                    <div>
                      <span className="muted">Status</span>
                      <strong>{COLLECTION.status}</strong>
                    </div>
                  </div>
                  <div className="collection-grid__progress">
                    <div
                      className="collection-grid__progress-bar"
                      style={{ width: `${COLLECTION.progress}%` }}
                      role="progressbar"
                      aria-valuenow={COLLECTION.progress}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                  <div className="collection-grid__cards-list">
                    <span className="collection-grid__card-small">
                      Items: {COLLECTION.items}
                    </span>
                    <span className="collection-grid__card-small">
                      Mint: {COLLECTION.mintPrice}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="collection-grid__future-empty muted">
                No upcoming COLLECTIONs are configured yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.futureStats === nextProps.futureStats
    );
  },
);

FutureCollectionsModal.displayName = "FutureCollectionsModal";

export default FutureCollectionsModal;



