import * as React from "react";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import {
  FUTURE_COLLECTION_STAGES,
  getFutureCollectionStats,
} from "../../rewards/COLLECTION/CollectionBlocksGrid.constants";

const THEME = {
  bgStart: "#07070a",
  bgEnd: "#0f1014",
  gold: "#FFE800",
  cyan: "#5ddcff",
  pink: "#ff8fd8",
  dim: "#cfd2db",
  surface: "rgba(255,255,255,0.03)",
  glass: "rgba(255,255,255,0.04)",
  border: "rgba(255,232,0,0.16)",
  softBorder: "rgba(255,255,255,0.06)",
};

const styles = {
  page: {
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#f6f7fb",
    background: `radial-gradient(900px 400px at 10% 0%, rgba(93,220,255,0.04), transparent), linear-gradient(180deg, ${THEME.bgStart}, ${THEME.bgEnd})`,
    minHeight: "calc(100vh - 90px)",
    padding: 20,
    boxSizing: "border-box",
  },
  container: {
    margin: "0 auto",
    maxWidth: 1240,
    display: "grid",
    gap: 18,
  },
  headerCard: {
    borderRadius: 18,
    padding: 24,
    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.18))",
    border: `1px solid ${THEME.border}`,
    boxShadow:
      "0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255,232,0,0.03) inset",
    display: "grid",
    gap: 18,
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  titleBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,232,0,0.08)",
    border: "1px solid rgba(255,232,0,0.2)",
    color: THEME.gold,
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: {
    margin: "10px 0 8px",
    fontSize: 24,
    fontWeight: 900,
    color: THEME.gold,
    letterSpacing: "0.03em",
  },
  subtitle: {
    margin: 0,
    maxWidth: 760,
    color: THEME.dim,
    fontSize: 14,
    lineHeight: 1.6,
  },
  tokenomicsPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(93,220,255,0.12), rgba(255,232,0,0.08))",
    border: "1px solid rgba(93,220,255,0.22)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  tokenomicsBanner: {
    borderRadius: 16,
    padding: 18,
    background:
      "linear-gradient(135deg, rgba(93,220,255,0.08), rgba(255,232,0,0.06) 55%, rgba(255,255,255,0.02))",
    border: "1px solid rgba(93,220,255,0.16)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.36)",
    display: "grid",
    gap: 14,
  },
  tokenomicsBannerTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  tokenomicsBannerTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: "#ffffff",
  },
  tokenomicsBannerText: {
    margin: "6px 0 0",
    color: THEME.dim,
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 840,
  },
  tokenomicsTagRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  tokenomicsTag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${THEME.softBorder}`,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gap: 12,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(0,0,0,0.22))",
    border: `1px solid ${THEME.softBorder}`,
    boxShadow: "0 14px 32px rgba(0,0,0,0.45)",
    minHeight: 102,
    display: "grid",
    gap: 8,
    alignContent: "start",
    position: "relative",
    overflow: "hidden",
  },
  summaryCardGlow: {
    position: "absolute",
    inset: "0 auto auto 0",
    width: "100%",
    height: 3,
    background:
      "linear-gradient(90deg, rgba(93,220,255,0.8), rgba(255,232,0,0.8), rgba(255,143,216,0.75))",
  },
  summaryLabel: {
    fontSize: 12,
    color: THEME.dim,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 900,
    color: THEME.gold,
    lineHeight: 1.1,
  },
  summaryHint: {
    fontSize: 13,
    color: THEME.dim,
    lineHeight: 1.5,
  },
  roadmapGrid: {
    display: "grid",
    gap: 18,
  },
  stageCard: {
    borderRadius: 18,
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(0,0,0,0.2))",
    border: `1px solid ${THEME.border}`,
    boxShadow: "0 16px 36px rgba(0,0,0,0.52)",
    display: "grid",
    gap: 16,
  },
  stageTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  stageMeta: {
    display: "grid",
    gap: 8,
  },
  stageTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: "#ffffff",
  },
  stageDescription: {
    margin: 0,
    color: THEME.dim,
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  stageBadgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  stageNumber: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    border: "1px solid rgba(255,232,0,0.2)",
    background: "rgba(255,232,0,0.1)",
    color: THEME.gold,
  },
  stageBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    border: `1px solid ${THEME.softBorder}`,
    background: THEME.glass,
    color: THEME.dim,
  },
  collectionGrid: {
    display: "grid",
    gap: 14,
  },
  collectionCard: {
    borderRadius: 14,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(0,0,0,0.18))",
    border: `1px solid ${THEME.softBorder}`,
    display: "grid",
    gap: 10,
    minHeight: 156,
    alignContent: "start",
    boxShadow: "0 12px 26px rgba(0,0,0,0.28)",
  },
  collectionImageFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    overflow: "hidden",
    background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.22))",
    border: `1px solid ${THEME.softBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  },
  collectionImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  collectionPlaceholder: {
    padding: 18,
    textAlign: "center",
    color: THEME.dim,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  collectionType: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    width: "fit-content",
  },
  collectionName: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#ffffff",
  },
  collectionDescription: {
    margin: 0,
    color: THEME.dim,
    fontSize: 13,
    lineHeight: 1.5,
  },
  collectionStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  statMini: {
    borderRadius: 10,
    padding: 10,
    background: "rgba(255,255,255,0.025)",
    border: `1px solid ${THEME.softBorder}`,
    display: "grid",
    gap: 4,
  },
  statMiniLabel: {
    fontSize: 11,
    color: THEME.dim,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statMiniValue: {
    fontSize: 15,
    fontWeight: 800,
    color: THEME.gold,
  },
  noteGrid: {
    display: "grid",
    gap: 18,
  },
  noteCard: {
    borderRadius: 16,
    padding: 18,
    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.16))",
    border: `1px solid ${THEME.softBorder}`,
    boxShadow: "0 12px 28px rgba(0,0,0,0.4)",
    display: "grid",
    gap: 12,
  },
  noteTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: THEME.cyan,
  },
  noteList: {
    margin: 0,
    paddingLeft: 18,
    color: THEME.dim,
    display: "grid",
    gap: 8,
    fontSize: 14,
    lineHeight: 1.6,
  },
};

const getCollectionAccent = (type) => {
  if (type === "VRF") {
    return {
      background: "rgba(255,143,216,0.1)",
      borderColor: "rgba(255,143,216,0.24)",
      color: THEME.pink,
    };
  }
  if (type === "Public") {
    return {
      background: "rgba(93,220,255,0.1)",
      borderColor: "rgba(93,220,255,0.24)",
      color: THEME.cyan,
    };
  }
  return {
    background: "rgba(255,232,0,0.1)",
    borderColor: "rgba(255,232,0,0.24)",
    color: THEME.gold,
  };
};

const getImageFrameStyle = (type) => {
  if (type === "VRF") {
    return {
      background:
        "linear-gradient(135deg, rgba(125, 218, 255, 0.18), rgba(8,16,34,0.4))",
      border: "1px solid rgba(125, 218, 255, 0.55)",
      boxShadow:
        "0 10px 24px rgba(0,0,0,0.35), 0 0 18px rgba(125, 218, 255, 0.22)",
    };
  }

  return {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.22))",
    border: `1px solid ${THEME.softBorder}`,
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  };
};

function SummaryCard({ label, value, hint, compact = false }) {
  return (
    <div
      style={{
        ...styles.summaryCard,
        padding: compact ? 14 : styles.summaryCard.padding,
        minHeight: compact ? 0 : styles.summaryCard.minHeight,
      }}
    >
      <div style={styles.summaryCardGlow} aria-hidden />
      <div style={styles.summaryLabel}>{label}</div>
      <div
        style={{
          ...styles.summaryValue,
          fontSize: compact ? 20 : styles.summaryValue.fontSize,
        }}
      >
        {value}
      </div>
      <div style={styles.summaryHint}>{hint}</div>
    </div>
  );
}

function CollectionCard({ collection, compact = false }) {
  const accent = getCollectionAccent(collection.type);
  const imageFrameStyle = getImageFrameStyle(collection.type);

  return (
    <article
      style={{
        ...styles.collectionCard,
        padding: compact ? 14 : styles.collectionCard.padding,
        minHeight: compact ? 0 : styles.collectionCard.minHeight,
      }}
    >
      <div
        style={{
          ...styles.collectionType,
          background: accent.background,
          border: `1px solid ${accent.borderColor}`,
          color: accent.color,
        }}
      >
        {collection.type}
      </div>
      <div style={{ ...styles.collectionImageFrame, ...imageFrameStyle }}>
        {collection.imageSrc ? (
          <img
            src={collection.imageSrc}
            alt={collection.imageAlt}
            style={styles.collectionImage}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={styles.collectionPlaceholder}>
            {collection.placeholderLabel || "Image coming soon"}
          </div>
        )}
      </div>
      <h4
        style={{
          ...styles.collectionName,
          fontSize: compact ? 16 : styles.collectionName.fontSize,
        }}
      >
        {collection.name}
      </h4>
      <p
        style={{
          ...styles.collectionDescription,
          fontSize: compact ? 12 : styles.collectionDescription.fontSize,
        }}
      >
        {collection.description}
      </p>
      <div
        style={{
          ...styles.collectionStats,
          gap: compact ? 8 : styles.collectionStats.gap,
        }}
      >
        <div style={styles.statMini}>
          <div style={styles.statMiniLabel}>Supply</div>
          <div style={styles.statMiniValue}>
            {Number(collection.supply || 0).toLocaleString()} NFTs
          </div>
        </div>
        <div style={styles.statMini}>
          <div style={styles.statMiniLabel}>Status</div>
          <div style={styles.statMiniValue}>{collection.status}</div>
        </div>
      </div>
      {collection.featuredNote ? (
        <div
          style={{
            ...styles.statMini,
            gridColumn: "1 / -1",
            borderColor: "rgba(255,232,0,0.24)",
          }}
        >
          <div style={styles.statMiniLabel}>Highlight</div>
          <div style={styles.statMiniValue}>{collection.featuredNote}</div>
        </div>
      ) : null}
    </article>
  );
}

function StageCard({ stage, stageIndex, compact = false }) {
  const stageCollections = Array.isArray(stage.collections)
    ? stage.collections
    : [];
  const stageLabel = `Pair ${String(stageIndex + 1).padStart(2, "0")}`;

  return (
    <section
      style={{
        ...styles.stageCard,
        padding: compact ? 16 : styles.stageCard.padding,
        gap: compact ? 14 : styles.stageCard.gap,
        borderColor: THEME.border,
        gridColumn: "auto",
      }}
    >
      <div
        style={{
          ...styles.stageTop,
          flexDirection: compact ? "column" : styles.stageTop.flexDirection,
          gap: compact ? 10 : styles.stageTop.gap,
        }}
      >
        <div style={styles.stageMeta}>
          <div style={styles.stageBadgeRow}>
            <span style={styles.stageNumber}>{stageLabel}</span>
            <span style={styles.stageBadge}>{stage.chapterLabel}</span>
            <span style={styles.stageBadge}>{stage.status}</span>
          </div>
          <h3
            style={{
              ...styles.stageTitle,
              fontSize: compact ? 18 : styles.stageTitle.fontSize,
            }}
          >
            {stage.title}
          </h3>
          <p
            style={{
              ...styles.stageDescription,
              maxWidth: compact ? "100%" : styles.stageDescription.maxWidth,
              fontSize: compact ? 13 : styles.stageDescription.fontSize,
            }}
          >
            {stage.description}
          </p>
        </div>
      </div>

      <div
        style={{
          ...styles.collectionGrid,
          gridTemplateColumns: compact
            ? "repeat(auto-fit, minmax(152px, 1fr))"
            : `repeat(${Math.min(stageCollections.length || 1, 2)}, minmax(0, 1fr))`,
        }}
      >
        {stageCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              compact={compact}
            />
          ))}
      </div>
    </section>
  );
}

export default function ExpansionPanel({ compact = false } = {}) {
  const [infoOpen, setInfoOpen] = React.useState(false);
  const roadmapStages = Array.isArray(FUTURE_COLLECTION_STAGES)
    ? FUTURE_COLLECTION_STAGES
    : [];
  const roadmapStats = React.useMemo(
    () => getFutureCollectionStats(roadmapStages),
    [roadmapStages],
  );
  const pairStages = roadmapStages.filter((stage) => stage.kind === "pair");
  const infoItems = React.useMemo(
    () => [
      {
        label: "One Tokenomics",
        description: [
          "All roadmap collections plug into the same BIGGI tokenomics loop.",
          "That means reward logic, reserve flow, liquidity support, buyback behavior, and treasury accounting stay aligned across the full collection roadmap.",
        ],
      },
      {
        label: "VRF + Public Pairs",
        description: [
          "Each pair combines one VRF collection and one Public collection.",
          "The pair structure expands the ecosystem without splitting the underlying tokenomics into separate systems.",
        ],
      },
      {
        label: "Mainnet Scope",
        description: [
          "The four upcoming chapter pairs are deployed on Polygon mainnet but remain inactive.",
          "Metadata, chapter activation, and the final launch gate determine when each pair becomes available.",
        ],
      },
    ],
    [],
  );

  return (
    <section
      style={{
        ...styles.page,
        minHeight: compact ? "auto" : styles.page.minHeight,
        padding: compact ? 0 : styles.page.padding,
      }}
    >
      <div
        style={{
          ...styles.container,
          gap: compact ? 14 : styles.container.gap,
          maxWidth: compact ? "100%" : styles.container.maxWidth,
        }}
      >
        <header
          style={{
            ...styles.headerCard,
            borderRadius: compact ? 16 : styles.headerCard.borderRadius,
            padding: compact ? 16 : styles.headerCard.padding,
            gap: compact ? 14 : styles.headerCard.gap,
          }}
        >
          <div
            style={{
              ...styles.headerTop,
              flexDirection: compact ? "column" : styles.headerTop.flexDirection,
              alignItems: compact ? "stretch" : styles.headerTop.alignItems,
              gap: compact ? 12 : styles.headerTop.gap,
            }}
          >
            <div>
              <div style={styles.titleBadge}>Expansion Roadmap</div>
              <h2
                style={{
                  ...styles.title,
                  fontSize: compact ? 22 : styles.title.fontSize,
                  lineHeight: compact ? 1.15 : undefined,
                }}
              >
                Deployed VRF + Public chapter pairs
              </h2>
              <p
                style={{
                  ...styles.subtitle,
                  maxWidth: compact ? "100%" : styles.subtitle.maxWidth,
                  fontSize: compact ? 13 : styles.subtitle.fontSize,
                }}
              >
                Universe, Mutant, Apocalipse, and Super Hero are four deployed
                chapter pairs that follow the Original chapter. Each chapter
                has its own VRF and Public collection, with a maximum supply of
                550 NFTs per contract. They remain inactive until their launch
                requirements are complete.
              </p>
            </div>
            <div
              style={{
                ...styles.headerActions,
                justifyContent: compact ? "space-between" : styles.headerActions.justifyContent,
                width: compact ? "100%" : undefined,
              }}
            >
              <div
                style={{
                  ...styles.tokenomicsPill,
                  padding: compact ? "8px 12px" : styles.tokenomicsPill.padding,
                }}
              >
                One shared BIGGI tokenomics
              </div>
              <PanelInfoButton
                onClick={() => setInfoOpen(true)}
                ariaLabel="Expansion panel info"
              />
            </div>
          </div>

          <section
            style={{
              ...styles.tokenomicsBanner,
              padding: compact ? 14 : styles.tokenomicsBanner.padding,
              gap: compact ? 12 : styles.tokenomicsBanner.gap,
            }}
          >
            <div
              style={{
                ...styles.tokenomicsBannerTop,
                flexDirection: compact ? "column" : styles.tokenomicsBannerTop.flexDirection,
                gap: compact ? 10 : styles.tokenomicsBannerTop.gap,
              }}
            >
              <div>
                <h3
                  style={{
                    ...styles.tokenomicsBannerTitle,
                    fontSize: compact ? 15 : styles.tokenomicsBannerTitle.fontSize,
                  }}
                >
                  Every roadmap collection feeds one ecosystem economy
                </h3>
                <p
                  style={{
                    ...styles.tokenomicsBannerText,
                    fontSize: compact ? 13 : styles.tokenomicsBannerText.fontSize,
                  }}
                >
                  Universe, Mutant, Apocalipse, and Super Hero are not isolated
                  branches. They use one central TicketHub and the same BIGGI
                  reserve, liquidity, rewards, and treasury framework.
                </p>
              </div>
            </div>
            <div style={styles.tokenomicsTagRow}>
              <span style={styles.tokenomicsTag}>Shared reserve logic</span>
              <span style={styles.tokenomicsTag}>Shared liquidity path</span>
              <span style={styles.tokenomicsTag}>Shared reward economy</span>
              <span style={styles.tokenomicsTag}>Deployed / inactive</span>
            </div>
          </section>

          <div
            style={{
              ...styles.summaryGrid,
              gridTemplateColumns: compact
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(4, minmax(0, 1fr))",
            }}
          >
            <SummaryCard
              label="Pairs"
              value={roadmapStats.totalPairs}
              hint="Four upcoming VRF + Public chapter pairs are deployed on Polygon."
              compact={compact}
            />
            <SummaryCard
              label="Collection Contracts"
              value={roadmapStats.pairCollections}
              hint="Each chapter contains one VRF collection and one Public collection."
              compact={compact}
            />
            <SummaryCard
              label="Supply Per Pair"
              value={`${roadmapStats.pairSupply} NFTs`}
              hint="Each pair contains 550 VRF NFTs and 100 Public NFTs, ten per block."
              compact={compact}
            />
            <SummaryCard
              label="Marketing Tickets"
              value="50 / chapter"
              hint="Already minted, transferable, and not redeemable while the chapter is inactive."
              compact={compact}
            />
          </div>
        </header>
        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="Expansion Panel"
          items={infoItems}
        />

        <div
          style={{
            ...styles.roadmapGrid,
            gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))",
          }}
        >
          {pairStages.map((stage, stageIndex) => (
            <StageCard
              key={stage.id}
              stage={stage}
              stageIndex={stageIndex}
              compact={compact}
            />
          ))}
        </div>

        <div
          style={{
            ...styles.noteGrid,
            gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: compact ? 14 : styles.noteGrid.gap,
          }}
        >
          <section
            style={{
              ...styles.noteCard,
              padding: compact ? 16 : styles.noteCard.padding,
            }}
          >
            <h3 style={styles.noteTitle}>How the roadmap is structured</h3>
            <ul style={styles.noteList}>
              <li>Chapters 2 to 5 open sequentially after the Original chapter.</li>
              <li>Each chapter contains two deployed contracts: one VRF and one Public collection.</li>
              <li>Each of those eight collection contracts has a 550 NFT maximum supply.</li>
              <li>Additional series and chapters can be registered; Super Hero is not a hard protocol limit.</li>
            </ul>
          </section>

          <section
            style={{
              ...styles.noteCard,
              padding: compact ? 16 : styles.noteCard.padding,
            }}
          >
            <h3 style={styles.noteTitle}>One tokenomics across every collection</h3>
            <ul style={styles.noteList}>
              <li>All roadmap collections connect to the same BIGGI tokenomics instead of spinning up separate economies.</li>
              <li>That keeps reserve behavior, liquidity growth, reward distribution, and treasury routing under one system.</li>
              <li>The roadmap expands collection variety while keeping the economic base consistent.</li>
              <li>Use the `i` button for the short system explanation at any time.</li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
