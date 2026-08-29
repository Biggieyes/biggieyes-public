export const PINATA_UPLOAD_SIGNATURE_TTL_MS = 5 * 60 * 1000;

export function buildPinataUploadMessage({ operation, timestamp, bodyHash }) {
  return [
    "BIGGI Pinata upload",
    `Operation: ${String(operation || "")}`,
    `Timestamp: ${String(timestamp || "")}`,
    `Body SHA-256: ${String(bodyHash || "")}`,
  ].join("\n");
}
