// Verifies a wallet signature and stores one live-chat message.
import { ethers } from "ethers";
import { captureException, initSentry } from "./_sentry.js";
import {
  buildCorsHeaders,
  getSupabaseAdmin,
  hasSupabaseConfig,
  isMissingTableError,
  jsonResponse,
  unavailableResponse,
} from "./lib/chatUtils.js";

const NONCE_TTL_MS = 2 * 60 * 1000;
const SIGNATURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_LEN = 280;
const RATE_LIMIT_SHORT_MS = 5000;
const RATE_LIMIT_LONG_MS = 60000;
const RATE_LIMIT_SHORT_COUNT = 1;
const RATE_LIMIT_LONG_COUNT = 10;
const BAD_WORDS = ["spam", "scam", "phish"];
const corsHeaders = buildCorsHeaders("POST,OPTIONS");

initSentry();

const parseBody = (reqOrEvent) => {
  if (!reqOrEvent) return {};
  if (reqOrEvent.body && typeof reqOrEvent.body === "object") {
    return reqOrEvent.body;
  }
  if (typeof reqOrEvent.body === "string") {
    try {
      return JSON.parse(reqOrEvent.body);
    } catch {
      return {};
    }
  }
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

const verifySignedMessage = (payload, signature) => {
  if (typeof ethers.verifyMessage === "function") {
    return ethers.verifyMessage(payload, signature);
  }
  if (ethers.utils && typeof ethers.utils.verifyMessage === "function") {
    return ethers.utils.verifyMessage(payload, signature);
  }
  throw new Error("verifyMessage unavailable");
};

const databaseFailure = (error, stage, schemaMessage = "") => {
  captureException(error, { stage });
  if (schemaMessage && isMissingTableError(error)) {
    return unavailableResponse(corsHeaders, schemaMessage);
  }
  return unavailableResponse(corsHeaders);
};

export async function handleRequest({ method, body }) {
  if (method === "OPTIONS") return jsonResponse(corsHeaders, 200, { ok: true });
  if (method !== "POST") {
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

  const rawAddress = String(body?.address || "").trim();
  const content = String(body?.content || "").trim();
  const signature = String(body?.signature || "").trim();
  const nonce = String(body?.nonce || "").trim();
  const timestamp = Number(body?.timestamp);
  const name = String(body?.name || "").trim().slice(0, 24) || null;

  if (!rawAddress) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Missing address",
    });
  }
  if (!content || content.length > MAX_LEN) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Invalid content length",
    });
  }
  if (!signature || !nonce || !Number.isFinite(timestamp)) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Invalid payload",
    });
  }
  if (Math.abs(Date.now() - timestamp) > SIGNATURE_CLOCK_SKEW_MS) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Expired message timestamp",
    });
  }
  if (hasProfanity(content)) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Content blocked",
    });
  }

  let address;
  try {
    address = normalizeAddress(rawAddress).toLowerCase();
  } catch {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Invalid address",
    });
  }

  const supabase = getSupabaseAdmin();
  let nonceResult;
  try {
    nonceResult = await supabase
      .from("nonces")
      .select("nonce,address,created_at,used")
      .eq("nonce", nonce)
      .maybeSingle();
  } catch (error) {
    return databaseFailure(error, "nonce_lookup");
  }

  if (nonceResult?.error) {
    return databaseFailure(
      nonceResult.error,
      "nonce_lookup",
      "Live chat database schema is missing.",
    );
  }

  const nonceRow = nonceResult?.data;
  if (!nonceRow) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Nonce not found",
    });
  }
  if (nonceRow.used) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Nonce already used",
    });
  }
  if (String(nonceRow.address || "").toLowerCase() !== address) {
    return jsonResponse(corsHeaders, 401, {
      ok: false,
      error: "Nonce address mismatch",
    });
  }

  const createdAt = new Date(nonceRow.created_at).getTime();
  const nonceAge = Date.now() - createdAt;
  if (
    !Number.isFinite(createdAt) ||
    nonceAge < -30_000 ||
    nonceAge > NONCE_TTL_MS
  ) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Nonce expired",
    });
  }

  const payload = `${nonce}|${content}|${timestamp}`;
  let recovered;
  try {
    recovered = verifySignedMessage(payload, signature);
  } catch {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Invalid signature",
    });
  }
  if (String(recovered || "").toLowerCase() !== address) {
    return jsonResponse(corsHeaders, 401, {
      ok: false,
      error: "Signature mismatch",
    });
  }

  try {
    const now = Date.now();
    const [shortCheck, longCheck] = await Promise.all([
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("author_address", address)
        .gte(
          "created_at",
          new Date(now - RATE_LIMIT_SHORT_MS).toISOString(),
        ),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("author_address", address)
        .gte(
          "created_at",
          new Date(now - RATE_LIMIT_LONG_MS).toISOString(),
        ),
    ]);

    if (shortCheck?.error || longCheck?.error) {
      return databaseFailure(
        shortCheck?.error || longCheck?.error,
        "message_rate_limit",
        "Live chat database schema is missing.",
      );
    }
    if (Number(shortCheck?.count || 0) >= RATE_LIMIT_SHORT_COUNT) {
      return jsonResponse(corsHeaders, 429, {
        ok: false,
        error: "Rate limited (slow down)",
      });
    }
    if (Number(longCheck?.count || 0) >= RATE_LIMIT_LONG_COUNT) {
      return jsonResponse(corsHeaders, 429, {
        ok: false,
        error: "Rate limited (minute cap)",
      });
    }
  } catch (error) {
    return databaseFailure(error, "message_rate_limit");
  }

  let nonceUpdate;
  try {
    nonceUpdate = await supabase
      .from("nonces")
      .update({ used: true })
      .eq("nonce", nonce)
      .eq("used", false)
      .select("nonce")
      .maybeSingle();
  } catch (error) {
    return databaseFailure(error, "nonce_update");
  }

  if (nonceUpdate?.error) {
    return databaseFailure(nonceUpdate.error, "nonce_update");
  }
  if (!nonceUpdate?.data) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Nonce already used",
    });
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        author_address: address,
        author_name: name,
        content,
      })
      .select("id")
      .single();

    if (error || !data) {
      return databaseFailure(
        error || new Error("Message insert failed"),
        "message_insert",
        "Live chat database schema is missing.",
      );
    }
    return jsonResponse(corsHeaders, 200, { ok: true, id: data.id });
  } catch (error) {
    return databaseFailure(error, "message_insert");
  }
}

const vercelHandler = async (req, res) => {
  const result = await handleRequest({
    method: req?.method,
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
    body: parseBody(event),
  });
  return {
    statusCode: result.status,
    headers: result.headers,
    body: result.body,
  };
};
