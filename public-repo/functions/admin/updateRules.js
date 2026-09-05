// api/admin/updateRules.js
// Owner-only rules update for live chat.
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { buildApiHeaders } from "../lib/httpSecurity.js";
import {
  buildChatRulesMessage,
  isFreshAdminTimestamp,
  MAX_CHAT_RULES_LENGTH,
} from "../../src/shared/utils/adminMessageAuth.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CHAT_OWNER_ADDRESS = (process.env.CHAT_OWNER_ADDRESS || "").toLowerCase();

const corsHeaders = buildApiHeaders({ methods: "POST,OPTIONS" });

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

const isAddressSafe = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    if (typeof ethers.getAddress === "function") {
      ethers.getAddress(raw);
      return true;
    }
    if (ethers.utils && typeof ethers.utils.getAddress === "function") {
      ethers.utils.getAddress(raw);
      return true;
    }
  } catch {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(raw);
};

const verifySignedMessage = (payload, signature) => {
  if (typeof ethers.verifyMessage === "function") {
    return ethers.verifyMessage(payload, signature);
  }
  if (ethers.utils && typeof ethers.utils.verifyMessage === "function") {
    return ethers.utils.verifyMessage(payload, signature);
  }
  throw new Error("verifyMessage not available");
};

async function handleRequest({ method, body }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }
  if (method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const address = String(body?.address || "").trim();
  const signature = String(body?.signature || "").trim();
  const rulesText = String(body?.rulesText || "").trim();
  const timestamp = Number(body?.timestamp);

  if (!isAddressSafe(address)) {
    return jsonResponse(400, { ok: false, error: "Invalid address" });
  }
  if (
    !signature ||
    !rulesText ||
    rulesText.length > MAX_CHAT_RULES_LENGTH ||
    !isFreshAdminTimestamp(timestamp)
  ) {
    return jsonResponse(400, { ok: false, error: "Invalid payload" });
  }

  const owner = await resolveOwnerAddress();
  if (!owner || owner !== address.toLowerCase()) {
    return jsonResponse(403, { ok: false, error: "Owner only" });
  }

  const payload = buildChatRulesMessage({ rulesText, timestamp });
  let recovered = "";
  try {
    recovered = verifySignedMessage(payload, signature);
  } catch {
    return jsonResponse(401, { ok: false, error: "Invalid signature" });
  }
  if (String(recovered || "").toLowerCase() !== owner) {
    return jsonResponse(401, { ok: false, error: "Signature mismatch" });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("rules")
    .upsert({ id: 1, text: rulesText, updated_by_address: owner, updated_at: now }, { onConflict: "id" });

  if (error) {
    return jsonResponse(500, { ok: false, error: "Rules update failed" });
  }

  await supabase.from("moderation_log").insert({
    action: "rules-update",
    message_id: null,
    by_address: owner,
  });

  return jsonResponse(200, { ok: true });
}

export default async function handler(req, res) {
  const body = parseBody(req);
  const result = await handleRequest({ method: req?.method, body });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
}
