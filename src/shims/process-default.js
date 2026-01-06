// Minimal browser-friendly process shim with a default export for CJS interop.
const proc = {
  env: typeof process !== "undefined" && process.env ? process.env : {},
  argv: [],
};

export default proc;
export const env = proc.env;
export const argv = proc.argv;
