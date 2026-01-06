// Provide a default export for bech32
import * as Bech32Module from "bech32";

const Bech32 =
  Bech32Module && Bech32Module.default ? Bech32Module.default : Bech32Module;
export default Bech32;
export * from "bech32";
