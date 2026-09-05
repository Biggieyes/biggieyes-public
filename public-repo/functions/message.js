// api/message.js
// Validates signed payload and writes a chat message using Supabase service role key.
//
// Improvements:
// - parseBody for various runtimes
// - robust address normalization via getAddress (ethers v5/v6 safe)
// - verifyMessage fallback handling
// - ALLOWED_ORIGIN env var for CORS
// - basic profanity + rate-limit checks (configurable)

import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { buildApiHeaders } from "./lib/httpSecurity.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TTL_MS = 2 * 60 * 1000;
const MAX_LEN = 280;
const RATE_LIMIT_SHORT_MS = 5000;
const RATE_LIMIT_LONG_MS = 60000;
const RATE_LIMIT_SHORT_COUNT = 1;
const RATE_LIMIT_LONG_COUNT = 10;
// Replace with your real list / moderation service in production
const BAD_WORDS = ["spam", "scam", "phish"];

const corsHeaders = buildApiHeaders({ methods: "POST,OPTIONS" });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const jsonResponse = (status, body) => ({
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders },
  body: JSON.stringify(body),
});

const parseBody = (reqOrEvent) => {
  if (!reqOrEvent) return {};
  // For Vercel/Express style "req" where body may be object
  if (reqOrEvent.body && typeof reqOrEvent.body === "object") return reqOrEvent.body;
  // For Netlify event where body is a string
  if (typeof reqOrEvent.body === "string") {
    try {
      return JSON.parse(reqOrEvent.body);
    } catch {
      return {};
    }
  }
  // For generic event.body (string)
  if (typeof reqOrEvent === "string") {
    try {
      return JSON.parse(reqOrEvent);
    } catch {
      return {};
    }
  }
  return {};
};

const hasProfanity = (value) => {
  const text = String(value || "").toLowerCase();
  return BAD_WORDS.some((word) => text.includes(word));
};

async function normalizeAddress(raw) {
  if (!raw) throw new Error("empty");
  // try ethers.getAddress (v6) or ethers.utils.getAddress (v5)
  try {
    if (typeof ethers.getAddress === "function") return ethers.getAddress(raw);
    if (ethers.utils && typeof ethers.utils.getAddress === "function") return ethers.utils.getAddress(raw);
    // fallback simple regex validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) throw new Error("invalid");
    return raw.toLowerCase();
  } catch {
    throw new Error("invalid address");
  }
}

function verifySignedMessage(payload, signature) {
  // ethers v6: ethers.verifyMessage, v5: ethers.utils.verifyMessage
  if (typeof ethers.verifyMessage === "function") return ethers.verifyMessage(payload, signature);
  if (ethers.utils && typeof ethers.utils.verifyMessage === "function")
    return ethers.utils.verifyMessage(payload, signature);
  // Last resort - throw
  throw new Error("verifyMessage not available");
}

async function handleRequest({ method, body }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }
  if (method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  // Parse + sanitize
  const rawAddress = String(body?.address || "").trim();
  const content = String(body?.content || "").trim();
  const signature = String(body?.signature || "").trim();
  const nonce = String(body?.nonce || "").trim();
  const timestamp = Number(body?.timestamp);
  const name = String(body?.name || "").trim().slice(0, 24) || null;

  // Basic checks
  if (!rawAddress) return jsonResponse(400, { ok: false, error: "Missing address" });
  if (!content || content.length > MAX_LEN) return jsonResponse(400, { ok: false, error: "Invalid content length" });
  if (!signature || !nonce || !Number.isFinite(timestamp)) return jsonResponse(400, { ok: false, error: "Invalid payload" });
  if (hasProfanity(content)) return jsonResponse(400, { ok: false, error: "Content blocked" });

  // Normalize address (throws if invalid)
  let address;
  try {
    address = await normalizeAddress(rawAddress);
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid address" });
  }

  // Check nonce exists & matches address
  const { data: nonceRow, error: nonceErr } = await supabase
    .from("nonces")
    .select("nonce,address,created_at,used")
    .eq("nonce", nonce)
    .maybeSingle();

  if (nonceErr) {
    console.error("nonce lookup error", nonceErr);
    return jsonResponse(500, { ok: false, error: "DB error" });
  }
  if (!nonceRow) return jsonResponse(400, { ok: false, error: "Nonce not found" });
  if (nonceRow.used) return jsonResponse(400, { ok: false, error: "Nonce already used" });
  if (String(nonceRow.address || "").toLowerCase() !== address.toLowerCase()) {
    return jsonResponse(401, { ok: false, error: "Nonce address mismatch" });
  }

  const createdAt = new Date(nonceRow.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > TTL_MS) {
    return jsonResponse(400, { ok: false, error: "Nonce expired" });
  }

  // Verify signature
  const payload = `${nonce}|${content}|${timestamp}`;
  let recovered;
  try {
    recovered = verifySignedMessage(payload, signature);
  } catch (e) {
    console.error("verify error", e);
    return jsonResponse(400, { ok: false, error: "Invalid signature (verify error)" });
  }
  if (!recovered || String(recovered).toLowerCase() !== address.toLowerCase()) {
    return jsonResponse(401, { ok: false, error: "Signature mismatch" });
  }

  // Rate limit checks (short + long)
  try {
    const now = Date.now();
    const cutoffShort = new Date(now - RATE_LIMIT_SHORT_MS).toISOString();
    const cutoffLong = new Date(now - RATE_LIMIT_LONG_MS).toISOString();

    const shortCheck = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("author_address", address.toLowerCase())
      .gte("created_at", cutoffShort);

    const longCheck = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("author_address", address.toLowerCase())
      .gte("created_at", cutoffLong);

    const shortCount = Number(shortCheck?.count || 0);
    const longCount = Number(longCheck?.count || 0);

    if (shortCount >= RATE_LIMIT_SHORT_COUNT) {
      return jsonResponse(429, { ok: false, error: "Rate limited (slow down)" });
    }
    if (longCount >= RATE_LIMIT_LONG_COUNT) {
      return jsonResponse(429, { ok: false, error: "Rate limited (minute cap)" });
    }
  } catch (e) {
    console.error("rate limit check error", e);
    // continue — don't block on rate-limit DB errors (optional)
  }

  // Mark nonce used (atomic-ish)
  try {
    const { data: updatedNonce, error: updErr } = await supabase
      .from("nonces")
      .update({ used: true })
      .eq("nonce", nonce)
      .eq("used", false)
      .select("nonce")
      .maybeSingle();

    if (updErr) {
      console.error("nonce update error", updErr);
      return jsonResponse(500, { ok: false, error: "DB error" });
    }
    if (!updatedNonce) {
      return jsonResponse(400, { ok: false, error: "Nonce already used" });
    }
  } catch (e) {
    console.error("nonce update unexpected", e);
    return jsonResponse(500, { ok: false, error: "DB error" });
  }

  // Insert message
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        author_address: address.toLowerCase(),
        author_name: name,
        content,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("message insert error", error);
      return jsonResponse(500, { ok: false, error: "Message insert failed" });
    }

    return jsonResponse(200, { ok: true, id: data.id });
  } catch (e) {
    console.error("message insert unexpected", e);
    return jsonResponse(500, { ok: false, error: "DB error" });
  }
}

/* VERCEL default export handler */
const vercelHandler = async (req, res) => {
  const body = parseBody(req);
  const result = await handleRequest({ method: req?.method, body });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
};

export default vercelHandler;

/* NETLIFY / AWS LAMBDA style export */
export const handler = async (event) => {
  const body = event?.body ? JSON.parse(event.body) : {};
  const result = await handleRequest({ method: event?.httpMethod, body });
  return { statusCode: result.status, headers: result.headers, body: result.body };
};
