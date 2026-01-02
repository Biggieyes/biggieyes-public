// Provide a default export for hash.js
import * as HashModule from "hash.js";

const Hash = HashModule && HashModule.default ? HashModule.default : HashModule;
export default Hash;
export * from "hash.js";
