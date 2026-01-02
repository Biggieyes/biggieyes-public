// ESM wrapper for hash.js (CommonJS)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const hash = require("hash.js");
export { hash };
export default hash;
