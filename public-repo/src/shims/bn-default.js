// Provide a default export for bn.js to satisfy ESM imports.
import * as BNModule from "bn.js";

const BN = BNModule && BNModule.default ? BNModule.default : BNModule;
export default BN;
export * from "bn.js";

