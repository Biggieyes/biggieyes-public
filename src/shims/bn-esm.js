// ESM wrapper for bn.js (CommonJS)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const BN = require("bn.js");
export { BN };
export default BN;
