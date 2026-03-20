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
      "Base price is the 1-10 POL start. Live price is on-chain and can rise with VRF mints and matching background usage.",
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
  NETWORK: "Polygon Amoy",
};

const DEFAULT_PAIR_SUPPLY = 550;
const DEFAULT_FINAL_SUPPLY = 1100;

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

export const FUTURE_COLLECTION_STAGES = [
  {
    id: "vrfpluspublic-universe",
    kind: "pair",
    title: "Universe",
    chapterKey: "vrfplusPublic",
    chapterLabel: "VRF + Public",
    status: "Mainnet Ready",
    description:
      "The first mainnet-ready roadmap pair starts with Universe as the VRF release and Universe Public as the public companion.",
    collections: [
      createRoadmapCollection({
        id: "universe-vrf",
        name: "Universe",
        type: "VRF",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "VRF-led Universe collection prepared for mainnet in the first roadmap pair.",
        ...roadmapImage("universe"),
      }),
      createRoadmapCollection({
        id: "universe-public",
        name: "Universe Public",
        type: "Public",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "Public companion for the Universe roadmap pair, prepared for mainnet.",
        ...roadmapImage("universe-public"),
      }),
    ],
  },
  {
    id: "vrfpluspublic-mutant",
    kind: "pair",
    title: "Mutant",
    chapterKey: "vrfplusPublic",
    chapterLabel: "VRF + Public",
    status: "Mainnet Ready",
    description:
      "The second mainnet-ready roadmap pair introduces Mutant and its public companion.",
    collections: [
      createRoadmapCollection({
        id: "mutant-vrf",
        name: "Mutant",
        type: "VRF",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "VRF-led Mutant collection prepared for mainnet in the second roadmap pair.",
        ...roadmapImage("mutant"),
      }),
      createRoadmapCollection({
        id: "mutant-public",
        name: "Mutant Public",
        type: "Public",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "Public companion for the Mutant roadmap pair, prepared for mainnet.",
        ...roadmapImage("mutant-public"),
      }),
    ],
  },
  {
    id: "vrfpluspublic-apocalipse",
    kind: "pair",
    title: "Apocalipse",
    chapterKey: "vrfplusPublic",
    chapterLabel: "VRF + Public",
    status: "Mainnet Ready",
    description:
      "The third mainnet-ready roadmap pair keeps the same VRF + Public structure for Apocalipse.",
    collections: [
      createRoadmapCollection({
        id: "apocalipse-vrf",
        name: "Apocalipse",
        type: "VRF",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "VRF-led Apocalipse collection prepared for mainnet in the third roadmap pair.",
        ...roadmapImage("apocalipse"),
      }),
      createRoadmapCollection({
        id: "apocalipse-public",
        name: "Apocalipse Public",
        type: "Public",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "Public companion for the Apocalipse roadmap pair, prepared for mainnet.",
        ...roadmapImage("apocalipse-public"),
      }),
    ],
  },
  {
    id: "vrfpluspublic-super-hero",
    kind: "pair",
    title: "Super Hero",
    chapterKey: "vrfplusPublic",
    chapterLabel: "VRF + Public",
    status: "Mainnet Ready",
    description:
      "The fourth mainnet-ready roadmap pair completes the VRF + Public chapter with Super Hero.",
    collections: [
      createRoadmapCollection({
        id: "super-hero-vrf",
        name: "Super Hero",
        type: "VRF",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "VRF-led Super Hero collection prepared for mainnet in the fourth roadmap pair.",
        ...roadmapImage("super-hero"),
      }),
      createRoadmapCollection({
        id: "super-hero-public",
        name: "Super Hero Public",
        type: "Public",
        supply: DEFAULT_PAIR_SUPPLY,
        status: "Mainnet Ready",
        description:
          "Public companion for the Super Hero roadmap pair, prepared for mainnet.",
        ...roadmapImage("super-hero-public"),
      }),
    ],
  },
  {
    id: "final-collection-stage",
    kind: "final",
    title: "MULTIVERSE",
    chapterKey: "final",
    chapterLabel: "Final Stage",
    status: "Mainnet Ready",
    description:
      "MULTIVERSE closes the roadmap after all four VRF + Public pairs are complete and is already prepared for the mainnet release.",
    collections: [
      createRoadmapCollection({
        id: "final-collection",
        name: "MULTIVERSE",
        type: "Final",
        supply: DEFAULT_FINAL_SUPPLY,
        status: "Mainnet Ready",
        description:
          "Final roadmap collection prepared for mainnet with 1100 NFTs and the main prize spotlight.",
        ...roadmapImage("multiverse"),
        featuredNote: "Main prize: $500k",
      }),
    ],
  },
];

export const FUTURE_COLLECTIONS = FUTURE_COLLECTION_STAGES.flatMap((stage) =>
  (Array.isArray(stage.collections) ? stage.collections : []).map((collection) => ({
    ...collection,
    stageId: stage.id,
    stageKind: stage.kind,
    stageTitle: stage.title,
    stageStatus: stage.status,
    stageDescription: stage.description,
    chapterKey: stage.chapterKey,
    chapterLabel: stage.chapterLabel,
  })),
);

export const getFutureCollectionStats = (
  stages = FUTURE_COLLECTION_STAGES,
) => {
  const safeStages = Array.isArray(stages) ? stages : [];
  const collections = safeStages.flatMap((stage) =>
    Array.isArray(stage.collections) ? stage.collections : [],
  );
  const pairStages = safeStages.filter((stage) => stage.kind === "pair");
  const pairCollections = pairStages.flatMap((stage) =>
    Array.isArray(stage.collections) ? stage.collections : [],
  );
  const finalCollections = safeStages
    .filter((stage) => stage.kind === "final")
    .flatMap((stage) => (Array.isArray(stage.collections) ? stage.collections : []));

  return {
    totalStages: safeStages.length,
    totalPairs: pairStages.length,
    totalCollections: collections.length,
    totalItems: collections.reduce(
      (sum, collection) => sum + Number(collection.supply || 0),
      0,
    ),
    pairCollections: pairCollections.length,
    finalCollections: finalCollections.length,
    pairSupply: DEFAULT_PAIR_SUPPLY,
    finalSupply: DEFAULT_FINAL_SUPPLY,
  };
};


