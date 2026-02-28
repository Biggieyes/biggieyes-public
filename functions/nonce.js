// api/nonce.js
// Generates a one-time nonce for a wallet address (valid for TTL_MS).
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import crypto from "crypto";
import { captureException, initSentry } from "./_sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TTL_MS = 2 * 60 * 1000;

// Replace '*' on production with your front-end origin, e.g. process.env.ALLOWED_ORIGIN
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
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

async function handleRequest({ method, query, body }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }
  if (method !== "GET" && method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const rawAddress = String(
    (method === "GET" ? query?.address : body?.address) || ""
  ).trim();

  // Validate and normalize address robustly across ethers versions
  let normalized;
  try {
    // ethers.getAddress exists in v5/v6 (v5: ethers.utils.getAddress, v6: ethers.getAddress)
    if (typeof ethers.getAddress === "function") {
      normalized = ethers.getAddress(rawAddress);
    } else if (ethers.utils && typeof ethers.utils.getAddress === "function") {
      normalized = ethers.utils.getAddress(rawAddress);
    } else {
      // fallback basic regex (not ideal, but prevents crash)
      if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) throw new Error("invalid");
      normalized = rawAddress;
    }
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid address" });
  }

  // cleanup old nonces (best effort)
  try {
    const now = Date.now();
    const cutoff = new Date(now - TTL_MS).toISOString();
    await supabase.from("nonces").delete().lt("created_at", cutoff);
  } catch {
    // continue — not fatal
  }

  // generate nonce and upsert (replace any unused nonce for this address)
  const nonce = crypto.randomBytes(16).toString("hex");
  try {
    // upsert: pokud existuje nepoužitý nonce pro adresu, nahradí ho novým
    const { error } = await supabase
      .from("nonces")
      .upsert({
        nonce,
        address: normalized.toLowerCase(),
        used: false,
        created_at: new Date().toISOString(),
      }, { onConflict: ["address"], ignoreDuplicates: false });
    if (error) {
      console.error("nonce upsert error:", error);
      captureException(error, { stage: "nonce_upsert" });
      return jsonResponse(500, { ok: false, error: "Nonce upsert failed" });
    }
  } catch (e) {
    console.error("nonce upsert unexpected:", e);
    captureException(e, { stage: "nonce_upsert" });
    return jsonResponse(500, { ok: false, error: "Nonce upsert failed" });
  }

  // Bezpečná odpověď — nikdy nevracej žádné tajné klíče
  return jsonResponse(200, { nonce, expiresInMs: TTL_MS });
}

/* VERCEL (default export) */
const vercelHandler = async (req, res) => {
  const query = req?.query || {};
  const body = parseBody(req);
  const result = await handleRequest({ method: req?.method, query, body });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
};

export default vercelHandler;

/* NETLIFY / AWS LAMBDA style export */
export const handler = async (event) => {
  const query = event?.queryStringParameters || {};
  const body = parseBody(event);
  const result = await handleRequest({ method: event?.httpMethod, query, body });
  return { statusCode: result.status, headers: result.headers, body: result.body };
};
