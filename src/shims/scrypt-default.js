// Provide a default export for scrypt-js
import * as ScryptModule from "scrypt-js";

const Scrypt =
  ScryptModule && ScryptModule.default ? ScryptModule.default : ScryptModule;
export default Scrypt;
export * from "scrypt-js";
