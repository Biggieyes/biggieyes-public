// api/admin/editMessage.js
// Owner-only moderation actions (edit or soft-delete).
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { captureException, initSentry } from "../_sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CHAT_OWNER_ADDRESS = (process.env.CHAT_OWNER_ADDRESS || "").toLowerCase();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  Vary: "Origin",
};

initSentry();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const jsonResponse = (status, body) => ({
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders },
  body: JSON.stringify(body),
});

const parseBody = (req) => {
  if (!req) return {};
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
};

async function resolveOwnerAddress() {
  if (CHAT_OWNER_ADDRESS) return CHAT_OWNER_ADDRESS;
  const { data } = await supabase.from("chat_config").select("owner_address").eq("id", 1).maybeSingle();
  return String(data?.owner_address || "").toLowerCase();
}

async function handleRequest({ method, body }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }
  if (method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const address = String(body?.address || "").trim();
  const signature = String(body?.signature || "").trim();
  const action = String(body?.action || "").trim();
  const messageId = Number(body?.messageId);
  const newContent = String(body?.newContent || "").trim();

  if (!ethers.utils.isAddress(address)) {
    return jsonResponse(400, { ok: false, error: "Invalid address" });
  }
  if (!signature || !action || !Number.isFinite(messageId)) {
    return jsonResponse(400, { ok: false, error: "Invalid payload" });
  }

  const owner = await resolveOwnerAddress();
  if (!owner || owner !== address.toLowerCase()) {
    return jsonResponse(403, { ok: false, error: "Owner only" });
  }

  const payload = `${action}|${messageId}|${newContent || ""}`;
  const recovered = ethers.utils.verifyMessage(payload, signature);
  if (recovered.toLowerCase() !== owner) {
    return jsonResponse(401, { ok: false, error: "Signature mismatch" });
  }

  if (action === "edit" && !newContent) {
    return jsonResponse(400, { ok: false, error: "Missing newContent" });
  }

  const update = action === "soft-delete"
    ? { deleted: true, edited_at: new Date().toISOString() }
    : { content: newContent, edited_at: new Date().toISOString(), deleted: false };

  const { error } = await supabase
    .from("messages")
    .update(update)
    .eq("id", messageId);

  if (error) {
    captureException(error, { stage: "message_update" });
    return jsonResponse(500, { ok: false, error: "Update failed" });
  }

  const { error: logError } = await supabase.from("moderation_log").insert({
    action,
    message_id: messageId,
    by_address: owner,
  });
  if (logError) {
    captureException(logError, { stage: "moderation_log" });
  }

  return jsonResponse(200, { ok: true });
}

export default async function handler(req, res) {
  const body = parseBody(req);
  const result = await handleRequest({ method: req?.method, body });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
}
