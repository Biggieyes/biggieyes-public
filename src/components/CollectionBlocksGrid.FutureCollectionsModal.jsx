import * as React from "react";
import { FUTURE_COLLECTIONS } from './CollectionBlocksGrid.constants';

/**
 * FutureCollectionsModal - Displays upcoming collections preview
 * @component
 */
const FutureCollectionsModal = React.memo(({ 
  isOpen,
  onClose,
  futureStats,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => onClose();
  const handleModalClick = (e) => e.stopPropagation();

  const placeholderCollections = [
    {
      id: "placeholder-1",
      name: "Upcoming Collection A",
      description: "Placeholder — details coming soon.",
      status: "Planning",
      items: "TBD",
      mintPrice: "TBD",
      progress: 20,
    },
    {
      id: "placeholder-2",
      name: "Upcoming Collection B",
      description: "Placeholder — integration in progress.",
      status: "In review",
      items: "TBD",
      mintPrice: "TBD",
      progress: 40,
    },
    {
      id: "placeholder-3",
      name: "Upcoming Collection C",
      description: "Placeholder — contracts preparing.",
      status: "Contracts",
      items: "TBD",
      mintPrice: "TBD",
      progress: 60,
    },
  ];

  const displayedCollections = FUTURE_COLLECTIONS && FUTURE_COLLECTIONS.length ? FUTURE_COLLECTIONS : placeholderCollections;
  const safeStats = futureStats || { totalCollections: displayedCollections.length, totalItems: 0, avgMintPrice: 0, highProgress: 0 };

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
        <header className="rewards-grid__header biggi-header" style={{ marginBottom: 20 }}>
          <div className="rewards-grid__headline">
            <h2 id="future-modal-title" className="rewards-grid__title">Future Collections</h2>
            <p className="rewards-grid__subtitle">Preview upcoming drops preparing integration with the Distributor.</p>
          </div>
          <div className="rewards-grid__header-actions">
            <button
              type="button"
              onClick={onClose}
              className="collection-grid__close-btn"
              aria-label="Close future collections modal"
            >
              Close
            </button>
          </div>
        </header>

        <div className="collection-grid__stat-cards">
            {[
            { label: "Collections", value: safeStats.totalCollections ?? displayedCollections.length },
            { label: "Total Items", value: (safeStats.totalItems ?? 0).toLocaleString() },
            { label: "Avg Mint", value: `${(safeStats.avgMintPrice ?? 0).toFixed(2)} ETH` },
            { label: "Launch-ready", value: safeStats.highProgress ?? 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="collection-grid__stat-card"
            >
              <div className="muted">{stat.label}</div>
              <div className="collection-grid__stat-value-large">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="collection-grid__future-grid">
          {displayedCollections.map((collection) => (
            <article
              key={collection.id}
              className="collection-grid__future-card"
            >
              <div className="biggi-card__glow" aria-hidden />
              <div className="collection-grid__future-card-heading">
                <h3>{collection.name}</h3>
                <p>{collection.description}</p>
              </div>
              <div className="collection-grid__future-card-info">
                <div>
                  <span className="muted">Status</span>
                  <strong>{collection.status}</strong>
                </div>
              </div>
              <div className="collection-grid__progress">
                <div
                  className="collection-grid__progress-bar"
                  style={{ width: `${collection.progress}%` }}
                  role="progressbar"
                  aria-valuenow={collection.progress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <div className="collection-grid__cards-list">
                <span className="collection-grid__card-small">Items: {collection.items}</span>
                <span className="collection-grid__card-small">Mint: {collection.mintPrice}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.futureStats === nextProps.futureStats
  );
});

FutureCollectionsModal.displayName = 'FutureCollectionsModal';

export default FutureCollectionsModal;
