/**
 * COLLECTIONBlocksGrid Constants
 * Centralizované hodnoty pro COLLECTIONBlocksGrid komponentu
 */

// Responsive breakpoints
export const MOBILE_BREAKPOINT = 700;
export const TABLET_BREAKPOINT = 1024;

// Grid configuration
export const MAX_BLOCKS = 10;
export const THUMB_SIZE = 140;
export const PREVIEW_SIZE = 100;

// Spacing & Layout
export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
};

// Button padding
export const BUTTON_PADDING = {
  small: "10px 18px",
  medium: "12px 24px",
  large: "14px 28px",
};

// Modal configuration
export const MODAL_CONFIG = {
  zIndex: 9999,
  backdropBlur: "blur(12px)",
  borderRadius: "20px",
  maxHeight: "80vh",
};

// Fallback values
export const FALLBACK_VALUE = "--";
export const FALLBACK_PRICE = "--";
export const FALLBACK_COUNT = "--";

// COLLECTION tabs
export const COLLECTION_TABS = {
  COLLECTION_1: "COLLECTION1",
  COLLECTION_2: "COLLECTION2",
  EXPANSION: "expansion",
  FUTURE: "future",
};

// Info panel configuration
export const INFO_CONCEPTS = [
  {
    concept: "Blocks",
    explanation:
      "Each block groups NFTs by eye colour. Tap a card to open the full preview.",
  },
  {
    concept: "Base vs live price",
    explanation:
      "Base and live prices are read from the active chapter contract. Live price can rise with VRF mints and matching background usage.",
  },
  {
    concept: "Minted",
    explanation: "Live on-chain minted count per block.",
  },
  {
    concept: "Rows per block",
    explanation: "Different blocks use different preview grid rows.",
  },
  {
    concept: "Previews",
    explanation: "Images are loaded from /images/blocks/<BLOCK>/.",
  },
];

// Error messages
export const ERROR_MESSAGES = {
  NO_CONTRACTS: "Contracts not available",
  PRICE_FETCH_FAILED: "Failed to fetch live prices",
  MINTED_FETCH_FAILED: "Failed to fetch minted counts",
  IMAGE_LOAD_FAILED: "Failed to load image",
};

// COLLECTION statuses
export const COLLECTION_STATUSES = {
  LIVE: "Live",
  PAUSED: "Paused",
  NETWORK: "Polygon mainnet",
};

const VRF_COLLECTION_SUPPLY = 550;
const PUBLIC_COLLECTION_SUPPLY = 100;
const DEFAULT_PAIR_SUPPLY = VRF_COLLECTION_SUPPLY + PUBLIC_COLLECTION_SUPPLY;

const roadmapImage = (name) => ({
  imageSrc: `/images/expansion-roadmap/${name}.optimized.jpg`,
  imageFallbackSrc: `/images/expansion-roadmap/${name}.png`,
});

const createRoadmapCollection = ({
  id,
  name,
  type,
  supply,
  status,
  description,
  imageSrc = "",
  imageFallbackSrc = "",
  imageAlt = "",
  placeholderLabel = "Image coming soon",
  featuredNote = "",
}) => ({
  id,
  name,
  type,
  supply,
  status,
  description,
  imageSrc,
  imageFallbackSrc,
  imageAlt: imageAlt || `${name} preview`,
  placeholderLabel,
  featuredNote,
  items: supply,
  mintPrice: "TBA",
  progress: 0,
});

const ROADMAP_CHAPTERS = [
  { chapterId: 2, slug: "universe", title: "Universe" },
  { chapterId: 3, slug: "mutant", title: "Mutant" },
  { chapterId: 4, slug: "apocalipse", title: "Apocalipse" },
  { chapterId: 5, slug: "super-hero", title: "Super Hero" },
];

export const FUTURE_COLLECTION_STAGES = ROADMAP_CHAPTERS.map(
  ({ chapterId, slug, title }) => ({
    id: `vrf-public-${slug}`,
    chapterId,
    kind: "pair",
    title,
    chapterKey: "vrfPublic",
    chapterLabel: "VRF + Public",
    status: "Inactive",
    description: `${title} opens after the preceding chapter is complete.`,
    collections: [
      createRoadmapCollection({
        id: `${slug}-vrf`,
        name: title,
        type: "VRF",
        supply: VRF_COLLECTION_SUPPLY,
        status: "Inactive",
        description: `${title} VRF collection.`,
        ...roadmapImage(slug),
      }),
      createRoadmapCollection({
        id: `${slug}-public`,
        name: `${title} Public`,
        type: "Public",
        supply: PUBLIC_COLLECTION_SUPPLY,
        status: "Inactive",
        description: `Public companion for ${title}.`,
        ...roadmapImage(`${slug}-public`),
      }),
    ],
  }),
);

export const FUTURE_COLLECTIONS = FUTURE_COLLECTION_STAGES.flatMap((stage) =>
  (Array.isArray(stage.collections) ? stage.collections : []).map(
    (collection) => ({
      ...collection,
      stageId: stage.id,
      stageKind: stage.kind,
      stageTitle: stage.title,
      stageStatus: stage.status,
      stageDescription: stage.description,
      chapterKey: stage.chapterKey,
      chapterLabel: stage.chapterLabel,
    }),
  ),
);

export const getFutureCollectionStats = (stages = FUTURE_COLLECTION_STAGES) => {
  const safeStages = Array.isArray(stages) ? stages : [];
  const collections = safeStages.flatMap((stage) =>
    Array.isArray(stage.collections) ? stage.collections : [],
  );
  const pairStages = safeStages.filter((stage) => stage.kind === "pair");
  const pairCollections = pairStages.flatMap((stage) =>
    Array.isArray(stage.collections) ? stage.collections : [],
  );
  return {
    totalStages: safeStages.length,
    totalPairs: pairStages.length,
    totalCollections: collections.length,
    totalItems: collections.reduce(
      (sum, collection) => sum + Number(collection.supply || 0),
      0,
    ),
    pairCollections: pairCollections.length,
    finalCollections: 0,
    pairSupply: DEFAULT_PAIR_SUPPLY,
    finalSupply: 0,
  };
};
