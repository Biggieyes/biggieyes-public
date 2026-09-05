import * as React from "react";
import {
  FUTURE_COLLECTION_STAGES,
  getFutureCollectionStats,
} from "./COLLECTIONBlocksGrid.constants";

const stageStatus = (stage, chapters) => {
  const snapshot = chapters.find(
    (chapter) => Number(chapter.chapterId) === Number(stage.chapterId),
  );
  if (snapshot?.active === true) return "Available now";
  if (snapshot?.configured === true && snapshot?.chapterExists === true) {
    return "Deployed / inactive";
  }
  return "Configuration pending";
};

const FutureCollectionsModal = React.memo(
  ({ isOpen, onClose, futureStats, chapterSeries }) => {
    if (!isOpen) return null;

    const roadmapStages = Array.isArray(FUTURE_COLLECTION_STAGES)
      ? FUTURE_COLLECTION_STAGES
      : [];
    const chapters = Array.isArray(chapterSeries?.chapters)
      ? chapterSeries.chapters
      : [];
    const safeStats = futureStats || getFutureCollectionStats(roadmapStages);

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
          <header className="collection-grid__future-header">
            <div>
              <h2 id="future-modal-title">Upcoming chapters</h2>
              <p>Universe, Mutant, Apocalipse, then Super Hero.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="collection-grid__close-btn"
              aria-label="Close upcoming chapters"
            >
              X
            </button>
          </header>

          <div className="collection-grid__stat-cards">
            <div className="collection-grid__stat-card">
              <span className="muted">Upcoming chapters</span>
              <strong className="collection-grid__stat-value-large">
                {safeStats.totalPairs ?? 0}
              </strong>
            </div>
            <div className="collection-grid__stat-card">
              <span className="muted">Collection contracts</span>
              <strong className="collection-grid__stat-value-large">
                {safeStats.totalCollections ?? 0}
              </strong>
            </div>
            <div className="collection-grid__stat-card">
              <span className="muted">NFTs per collection</span>
              <strong className="collection-grid__stat-value-large">
                {Number(safeStats.pairSupply ?? 0).toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="collection-grid__future-grid">
            {roadmapStages.map((stage) => (
              <article key={stage.id} className="collection-grid__future-card">
                <div className="collection-grid__future-card-heading">
                  <div>
                    <span className="collection-series__eyebrow">
                      Chapter {stage.chapterId}
                    </span>
                    <h3>{stage.title}</h3>
                  </div>
                  <span className="collection-series__pill collection-series__pill--dim">
                    {stageStatus(stage, chapters)}
                  </span>
                </div>
                <p>{stage.description}</p>

                <div className="collection-grid__future-pair">
                  {stage.collections.map((collection) => (
                    <figure key={collection.id}>
                      <img
                        src={collection.imageSrc || collection.imageFallbackSrc}
                        alt={collection.imageAlt}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          const fallback = collection.imageFallbackSrc;
                          if (!fallback || event.currentTarget.dataset.fallback)
                            return;
                          event.currentTarget.dataset.fallback = "1";
                          event.currentTarget.src = fallback;
                        }}
                      />
                      <figcaption>
                        <strong>{collection.name}</strong>
                        <span>{collection.type}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

FutureCollectionsModal.displayName = "FutureCollectionsModal";

export default FutureCollectionsModal;
