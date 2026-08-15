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
  NETWORK: "Polygon mainnet",
};

// Future COLLECTIONs configuration
export const FUTURE_COLLECTIONS = [
  // Add future COLLECTIONs here as needed
  // Format: { id, name, description, status, items, mintPrice, progress }
];


