// Shim default export for js-sha3 to satisfy ethers ESM build.
// Keep it minimal to avoid bundler warnings from the original UMD file.
import { keccak_256 as nobleKeccak256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const keccak_256 = (data) => bytesToHex(nobleKeccak256(data));
const keccak256 = keccak_256;

export { keccak_256, keccak256 };

export default {
  keccak_256,
  keccak256,
};

