import {
  authorizePinataUpload,
  buildPinataGatewayUrl,
  buildPinataHeaders,
  corsHeaders,
  createRateLimiter,
  getRequestClientId,
  jsonResponse,
  parseJsonBody,
  pinataRequest,
} from "./_pinataUtils.js";

const allowRequest = createRateLimiter({ capacity: 10, refillMs: 60_000 });

export async function handler(event) {
  const method = event?.httpMethod || event?.method || "GET";
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed" });
  const authorization = authorizePinataUpload(event, "pinJson");
  if (!authorization.ok) {
    return jsonResponse(authorization.statusCode, {
      success: false,
      error: authorization.error,
    });
  }
  const clientId = authorization.address || getRequestClientId(event);
  if (!(await allowRequest(clientId))) {
    return jsonResponse(429, { success: false, error: "Rate limit exceeded" });
  }

  const body = parseJsonBody(event);
  const metadata = body?.metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return jsonResponse(400, { success: false, error: "Invalid metadata" });
  }

  let pinataHeaders;
  try {
    pinataHeaders = buildPinataHeaders();
  } catch (err) {
    return jsonResponse(500, { success: false, error: err?.message || "Missing Pinata credentials" });
  }

  try {
    const res = await pinataRequest("https://api.pinata.cloud/pinning/pinJSONToIPFS", metadata, pinataHeaders);
    const cid = res?.data?.IpfsHash || "";
    if (!cid) throw new Error("Pinata response missing CID");
    console.info("pinJson success", { cid });
    return jsonResponse(200, {
      success: true,
      cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: buildPinataGatewayUrl(cid),
      raw: res?.data || {},
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.error || err?.response?.data || err?.message || "Pinata error";
    console.error("pinJson error", { error: details });
    return jsonResponse(status >= 400 && status < 600 ? status : 500, { success: false, error: String(details) });
  }
}
