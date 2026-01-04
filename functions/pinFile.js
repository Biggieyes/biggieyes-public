import Busboy from "busboy";
import FormData from "form-data";
import {
  buildPinataHeaders,
  corsHeaders,
  createRateLimiter,
  jsonResponse,
  parseJsonBody,
  pinataRequest,
} from "./_pinataUtils.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/json",
]);

const allowRequest = createRateLimiter({ capacity: 10, refillMs: 60_000 });

const getHeader = (headers, key) => {
  if (!headers) return "";
  const matchKey = Object.keys(headers).find((k) => k.toLowerCase() === key);
  return matchKey ? headers[matchKey] : "";
};

const parseDataUrl = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
};

const decodeBase64 = (base64) => {
  try {
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
};

const parseMultipart = (event) => {
  return new Promise((resolve, reject) => {
    const contentType = getHeader(event.headers, "content-type");
    if (!contentType) return reject(new Error("Missing content-type"));
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "", "utf8");
    const bb = Busboy({ headers: { "content-type": contentType } });

    const fields = {};
    let fileBuffer = null;
    let fileName = "";
    let fileMime = "";
    let size = 0;
    let tooLarge = false;

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("file", (name, file, infoOrFilename, encoding, mimetype) => {
      let filename = "";
      let mimeType = "";
      if (typeof infoOrFilename === "object" && infoOrFilename) {
        filename = infoOrFilename.filename || "";
        mimeType = infoOrFilename.mimeType || "";
      } else {
        filename = infoOrFilename || "";
        mimeType = mimetype || "";
      }
      fileName = filename;
      fileMime = mimeType;
      const chunks = [];
      file.on("data", (data) => {
        size += data.length;
        if (size > MAX_BYTES) {
          tooLarge = true;
          file.resume();
          return;
        }
        chunks.push(data);
      });
      file.on("end", () => {
        if (!tooLarge) fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("finish", () => {
      if (tooLarge) return reject(new Error("File too large"));
      resolve({ fields, fileBuffer, fileName, fileMime });
    });
    bb.on("error", reject);
    bb.end(body);
  });
};

const toPinataForm = (buffer, { name, mime, metadata }) => {
  const form = new FormData();
  const filename = name || "upload";
  form.append("file", buffer, { filename, contentType: mime || "application/octet-stream" });
  if (metadata && typeof metadata === "object") {
    form.append("pinataMetadata", JSON.stringify(metadata));
  }
  return form;
};

const backupToNftStorage = async (buffer, { name, mime }) => {
  const key = process.env.NFT_STORAGE_KEY || "";
  if (!key) return null;
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": mime || "application/octet-stream",
  };
  if (name) headers["X-Upload-Name"] = name;
  const res = await pinataRequest("https://api.nft.storage/upload", buffer, headers);
  return res?.data?.value?.cid || null;
};

export async function handler(event) {
  const method = event?.httpMethod || event?.method || "GET";
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed" });
  if (!allowRequest()) return jsonResponse(429, { success: false, error: "Rate limit exceeded" });

  let buffer = null;
  let name = "";
  let mime = "";
  let metadata = null;

  try {
    const contentType = getHeader(event.headers, "content-type");
    if (contentType && contentType.includes("multipart/form-data")) {
      const parsed = await parseMultipart(event);
      buffer = parsed.fileBuffer;
      name = parsed.fileName || "";
      mime = parsed.fileMime || "";
      metadata = parsed.fields?.metadata ? JSON.parse(parsed.fields.metadata) : null;
    } else {
      const body = parseJsonBody(event);
      name = String(body?.name || "").trim();
      metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : null;
      const dataUrl = parseDataUrl(body?.contentBase64 || "");
      const rawBase64 = dataUrl ? dataUrl.base64 : body?.contentBase64;
      mime = dataUrl?.mime || metadata?.mime || metadata?.contentType || body?.contentType || "";
      buffer = decodeBase64(rawBase64 || "");
    }
  } catch (err) {
    return jsonResponse(400, { success: false, error: err?.message || "Invalid request" });
  }

  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    return jsonResponse(400, { success: false, error: "Missing file content" });
  }
  if (!mime || !ALLOWED_MIME.has(mime)) {
    return jsonResponse(400, { success: false, error: "Unsupported file type" });
  }
  if (buffer.length > MAX_BYTES) {
    return jsonResponse(400, { success: false, error: "File too large" });
  }

  let pinataHeaders;
  try {
    pinataHeaders = buildPinataHeaders();
  } catch (err) {
    return jsonResponse(500, { success: false, error: err?.message || "Missing Pinata credentials" });
  }

  try {
    const form = toPinataForm(buffer, { name, mime, metadata });
    const headers = { ...form.getHeaders(), ...pinataHeaders };
    const res = await pinataRequest("https://api.pinata.cloud/pinning/pinFileToIPFS", form, headers);
    const cid = res?.data?.IpfsHash || "";
    if (!cid) throw new Error("Pinata response missing CID");

    let backupCid = null;
    try {
      backupCid = await backupToNftStorage(buffer, { name, mime });
    } catch (backupErr) {
      console.error("pinFile backup failed:", backupErr?.message || backupErr);
    }

    console.info("pinFile success", { name, size: buffer.length, cid });
    return jsonResponse(200, {
      success: true,
      cid,
      ipfsUrl: `ipfs://${cid}`,
      raw: res?.data || {},
      backupCid: backupCid || undefined,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.error || err?.response?.data || err?.message || "Pinata error";
    console.error("pinFile error", { error: details });
    return jsonResponse(status >= 400 && status < 600 ? status : 500, { success: false, error: String(details) });
  }
}
