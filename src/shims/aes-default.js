// Provide a default export for aes-js
import * as AesModule from "aes-js";

const AES = AesModule && AesModule.default ? AesModule.default : AesModule;
export default AES;
export * from "aes-js";
