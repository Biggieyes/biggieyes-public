// Re-export hash.js - use namespace import (no default export)
import * as hashjs from "/node_modules/hash.js/lib/hash.js";

export { hashjs as hash };
export default hashjs;

