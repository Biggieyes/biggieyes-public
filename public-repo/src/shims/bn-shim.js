// bn.js ESM wrapper - provides default export
// This wrapper is used as alias replacement for "bn.js" during build
// to provide the default export that @ethersproject expects

import * as bnLib from "bn.js/lib/bn.js";

// bn.js uses module.exports = BN, so in ESM it becomes the namespace
const BN = bnLib.default ?? bnLib;

export default BN;
export { BN };

