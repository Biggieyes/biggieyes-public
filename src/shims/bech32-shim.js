// Shim for bech32 to provide default export for ESM compatibility
import * as bech32Module from "bech32";

const bech32 = bech32Module.bech32 || bech32Module;

export { bech32 };
export default bech32;
