import { Buffer } from "buffer";
import processShim from "../shims/process-shim.js";

if (typeof globalThis !== "undefined") {
  if (!globalThis.process) globalThis.process = processShim;
  if (!globalThis.global) globalThis.global = globalThis;
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
}
