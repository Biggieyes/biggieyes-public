import * as React from "react";
import {
  FUTURE_COLLECTION_STAGES,
  getFutureCollectionStats,
} from "./COLLECTIONBlocksGrid.constants";

const FutureCollectionsModal = React.memo(
  ({ isOpen, onClose, futureStats }) => {
    if (!isOpen) return null;

    const roadmapStages = Array.isArray(FUTURE_COLLECTION_STAGES)
      ? FUTURE_COLLECTION_STAGES
      : [];
    const safeStats = futureStats || getFutureCollectionStats(roadmapStages);
    const getImageFrameStyle = (type) => {
      if (type === "VRF") {
        return {
          background:
            "linear-gradient(135deg, rgba(125, 218, 255, 0.18), rgba(8,16,34,0.4))",
          border: "1px solid rgba(125, 218, 255, 0.55)",
          boxShadow: "0 0 18px rgba(125, 218, 255, 0.18)",
        };
      }

      return {
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.24))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "none",
      };
    };

    return (
      <div
        className="collection-grid__future-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="future-modal-title"
      >
        <div
          className="collection-grid__future-modal biggi-token-surface"
          onClick={(event) => event.stopPropagation()}
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
                Four VRF + Public roadmap pairs lead into one final collection.
                All visible entries are already prepared for mainnet. Each
                non-final collection is set to 550 NFTs, and the closing final
                collection is set to 1100 NFTs.
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
              { label: "Pairs", value: safeStats.totalPairs ?? 0 },
              {
                label: "Collections",
                value: safeStats.totalCollections ?? 0,
              },
              {
                label: "Pair Supply",
                value: `${(safeStats.pairSupply ?? 0).toLocaleString()} NFTs`,
              },
              {
                label: "Final Supply",
                value: `${(safeStats.finalSupply ?? 0).toLocaleString()} NFTs`,
              },
            ].map((stat) => (
              <div key={stat.label} className="collection-grid__stat-card">
                <div className="muted">{stat.label}</div>
                <div className="collection-grid__stat-value-large">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div
            className="collection-grid__future-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))",
              gap: 18,
            }}
          >
            {roadmapStages.length ? (
              roadmapStages.map((stage) => {
                const stageCollections = Array.isArray(stage.collections)
                  ? stage.collections
                  : [];
                const isFinalStage = stage.kind === "final";

                return (
                  <article
                    key={stage.id}
                    className="collection-grid__future-card"
                    style={{
                      padding: 22,
                      display: "grid",
                      gap: 18,
                      gridColumn: isFinalStage ? "1 / -1" : undefined,
                      borderColor: isFinalStage
                        ? "rgba(255, 232, 0, 0.35)"
                        : undefined,
                    }}
                  >
                    <div className="biggi-card__glow" aria-hidden />
                    <div className="collection-grid__future-card-heading">
                      <h3>
                        {stage.title}{" "}
                        <span className="muted">
                          {stage.chapterLabel}
                        </span>
                      </h3>
                      <p>{stage.description}</p>
                    </div>

                    <div className="collection-grid__future-card-info">
                      <div>
                        <span className="muted">Stage status</span>
                        <strong>{stage.status}</strong>
                      </div>
                      <div>
                        <span className="muted">Collections</span>
                        <strong>{stageCollections.length}</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${Math.min(
                          stageCollections.length || 1,
                          2,
                        )}, minmax(0, 1fr))`,
                        gap: 14,
                      }}
                    >
                      {stageCollections.map((collection) => (
                        <div
                          key={collection.id}
                          className="collection-grid__card-small"
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 16,
                            minHeight: 124,
                            alignContent: "start",
                            textAlign: "left",
                          }}
                        >
                          <span className="muted">{collection.type}</span>
                          <div
                            style={{
                              ...getImageFrameStyle(collection.type),
                              width: "100%",
                              aspectRatio: "1 / 1",
                              borderRadius: 12,
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {collection.imageSrc ? (
                              <img
                                src={collection.imageSrc}
                                alt={collection.imageAlt}
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                                onError={(event) => {
                                  const fallbackSrc = collection.imageFallbackSrc;
                                  if (!fallbackSrc) return;
                                  if (event.currentTarget.dataset.fallbackApplied === "1") {
                                    return;
                                  }
                                  event.currentTarget.dataset.fallbackApplied = "1";
                                  event.currentTarget.src = fallbackSrc;
                                }}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  padding: 16,
                                  textAlign: "center",
                                  fontWeight: 700,
                                  lineHeight: 1.5,
                                }}
                              >
                                {collection.placeholderLabel || "Image coming soon"}
                              </div>
                            )}
                          </div>
                          <strong>{collection.name}</strong>
                          <span>{collection.description}</span>
                          <span className="muted">
                            Supply: {Number(collection.supply || 0).toLocaleString()} NFTs
                          </span>
                          {collection.featuredNote ? (
                            <span className="muted">{collection.featuredNote}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="collection-grid__future-empty muted">
                No upcoming COLLECTION roadmap is configured yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.futureStats === nextProps.futureStats,
);

FutureCollectionsModal.displayName = "FutureCollectionsModal";

export default FutureCollectionsModal;
