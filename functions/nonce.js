// Generates a one-time nonce for a wallet address.
import crypto from "crypto";
import { ethers } from "ethers";
import { captureException, initSentry } from "./_sentry.js";
import {
  buildCorsHeaders,
  getSupabaseAdmin,
  hasSupabaseConfig,
  isNonceSchemaError,
  jsonResponse,
  unavailableResponse,
} from "./lib/chatUtils.js";

const TTL_MS = 2 * 60 * 1000;
const corsHeaders = buildCorsHeaders("GET,POST,OPTIONS");

initSentry();

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

const normalizeAddress = (rawAddress) => {
  if (typeof ethers.getAddress === "function") {
    return ethers.getAddress(rawAddress);
  }
  if (ethers.utils && typeof ethers.utils.getAddress === "function") {
    return ethers.utils.getAddress(rawAddress);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) throw new Error("invalid");
  return rawAddress;
};

export async function handleRequest({ method, query, body }) {
  if (method === "OPTIONS") return jsonResponse(corsHeaders, 200, { ok: true });
  if (method !== "GET" && method !== "POST") {
    return jsonResponse(corsHeaders, 405, {
      ok: false,
      error: "Method not allowed",
    });
  }
  if (!hasSupabaseConfig()) {
    return unavailableResponse(
      corsHeaders,
      "Live chat server configuration is incomplete.",
    );
  }

  const rawAddress = String(
    (method === "GET" ? query?.address : body?.address) || "",
  ).trim();

  let normalized;
  try {
    normalized = normalizeAddress(rawAddress).toLowerCase();
  } catch {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Invalid address",
    });
  }

  const supabase = getSupabaseAdmin();

  try {
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    const { error } = await supabase
      .from("nonces")
      .delete()
      .lt("created_at", cutoff);
    if (error) captureException(error, { stage: "nonce_cleanup" });
  } catch (error) {
    captureException(error, { stage: "nonce_cleanup" });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  try {
    const { error } = await supabase.from("nonces").upsert(
      {
        nonce,
        address: normalized,
        used: false,
        created_at: new Date().toISOString(),
      },
      { onConflict: "address", ignoreDuplicates: false },
    );

    if (error) {
      captureException(error, { stage: "nonce_upsert" });
      if (isNonceSchemaError(error)) {
        // Compatibility path for an older schema without UNIQUE(address).
        // The repair migration restores atomic upserts for concurrent requests.
        const { error: deleteError } = await supabase
          .from("nonces")
          .delete()
          .eq("address", normalized);
        if (deleteError) {
          captureException(deleteError, { stage: "nonce_legacy_delete" });
          return unavailableResponse(corsHeaders);
        }

        const { error: insertError } = await supabase.from("nonces").insert({
          nonce,
          address: normalized,
          used: false,
          created_at: new Date().toISOString(),
        });
        if (insertError) {
          captureException(insertError, { stage: "nonce_legacy_insert" });
          return unavailableResponse(corsHeaders);
        }

        return jsonResponse(corsHeaders, 200, {
          nonce,
          expiresInMs: TTL_MS,
        });
      }
      return unavailableResponse(corsHeaders);
    }
  } catch (error) {
    captureException(error, { stage: "nonce_upsert" });
    return unavailableResponse(corsHeaders);
  }

  return jsonResponse(corsHeaders, 200, { nonce, expiresInMs: TTL_MS });
}

const vercelHandler = async (req, res) => {
  const result = await handleRequest({
    method: req?.method,
    query: req?.query || {},
    body: parseBody(req),
  });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([key, value]) =>
    res.setHeader(key, value),
  );
  res.end(result.body);
};

export default vercelHandler;

export const handler = async (event) => {
  const result = await handleRequest({
    method: event?.httpMethod,
    query: event?.queryStringParameters || {},
    body: parseBody(event),
  });
  return {
    statusCode: result.status,
    headers: result.headers,
    body: result.body,
  };
};
