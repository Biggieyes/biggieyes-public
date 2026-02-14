// Re-export canonical metadata cache helpers from utils.
import {
  mergeAttrs,
  getCachedPriceAttrs,
  setCachedPriceAttrs,
} from "../utils/metadata";

export { mergeAttrs, getCachedPriceAttrs, setCachedPriceAttrs };

// Default export for legacy compatibility
export default {
  mergeAttrs,
  getCachedPriceAttrs,
  setCachedPriceAttrs,
};

