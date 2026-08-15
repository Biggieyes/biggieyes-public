import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { captureException, initSentry } from "../_sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const COMMUNITY_OWNER_ADDRESS = (
  process.env.COMMUNITY_OWNER_ADDRESS ||
  process.env.CHAT_OWNER_ADDRESS ||
  ""
).toLowerCase();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SIGNATURE_TTL_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

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

const parseBody = (reqOrEvent) => {
  if (!reqOrEvent) return {};
  if (reqOrEvent.body && typeof reqOrEvent.body === "object") return reqOrEvent.body;
  if (typeof reqOrEvent.body === "string") {
    try {
      return JSON.parse(reqOrEvent.body);
    } catch {
      return {};
    }
  }
  return {};
};

const parseErrorMessage = (err) => {
  if (!err) return "";
  if (typeof err === "string") return err;
  return String(err.message || err.details || err.hint || err.error || "");
};

const isMissingTableError = (err) =>
  err?.code === "PGRST205" ||
  /Could not find the table/i.test(parseErrorMessage(err));

function normalizeAddress(raw) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("Invalid address");
  if (typeof ethers.getAddress === "function") return ethers.getAddress(value);
  if (ethers.utils && typeof ethers.utils.getAddress === "function") {
    return ethers.utils.getAddress(value);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error("Invalid address");
  return value;
}

function verifySignedMessage(message, signature) {
  if (typeof ethers.verifyMessage === "function") {
    return ethers.verifyMessage(message, signature);
  }
  if (ethers.utils && typeof ethers.utils.verifyMessage === "function") {
    return ethers.utils.verifyMessage(message, signature);
  }
  throw new Error("verifyMessage not available");
}

async function resolveOwnerAddress() {
  if (COMMUNITY_OWNER_ADDRESS) return COMMUNITY_OWNER_ADDRESS;
  const { data } = await supabase
    .from("chat_config")
    .select("owner_address")
    .eq("id", 1)
    .maybeSingle();
  return String(data?.owner_address || "").toLowerCase();
}

function normalizeOptionId(value, fallbackIndex) {
  const raw = String(value || "").trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || `option-${fallbackIndex + 1}`;
}

function parseDateValue(value, fieldName) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${fieldName} is required`);
  const asNumber = Number(raw);
  const date =
    Number.isFinite(asNumber) && raw !== ""
      ? new Date(raw.length >= 13 ? asNumber : asNumber * 1000)
      : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }
  return date.toISOString();
}

function normalizePollInput(input) {
  const title = String(input?.title || "").trim().slice(0, 120);
  const description = String(input?.description || "").trim().slice(0, 1200);
  const startsAt = parseDateValue(input?.startsAt, "Poll start");
  const endsAt = parseDateValue(input?.endsAt, "Poll end");
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("Poll end must be later than poll start");
  }

  const rawOptions = Array.isArray(input?.options) ? input.options : [];
  const options = rawOptions
    .map((item, index) => {
      const label =
        typeof item === "string"
          ? item.trim()
          : String(item?.label || "").trim();
      if (!label) return null;
      return {
        id: normalizeOptionId(item?.id || label, index),
        label: label.slice(0, 120),
      };
    })
    .filter(Boolean);

  if (options.length < 2) {
    throw new Error("At least two vote options are required");
  }

  const duplicateLabels = new Set();
  for (const option of options) {
    const key = option.label.toLowerCase();
    if (duplicateLabels.has(key)) {
      throw new Error("Vote options must be unique");
    }
    duplicateLabels.add(key);
  }

  const linkedEventIdRaw = String(input?.linkedEventId ?? "").trim();
  const linkedEventId =
    linkedEventIdRaw === ""
      ? null
      : (() => {
          const next = Number(linkedEventIdRaw);
          if (!Number.isInteger(next) || next < 0) {
            throw new Error("Linked event ID is invalid");
          }
          return next;
        })();

  const idRaw = String(input?.id || "").trim();
  const safeId = idRaw.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 64);

  return {
    id: safeId || `poll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    options,
    linkedEventId,
    startsAt,
    endsAt,
  };
}

function parseAdminPayload(payload) {
  const raw = String(payload || "").trim();
  if (!raw) throw new Error("Admin payload is missing");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Admin payload is invalid");
  }
  const action = String(parsed?.action || "").trim();
  const timestamp = Number(parsed?.timestamp);
  if (!action || !Number.isFinite(timestamp)) {
    throw new Error("Admin payload is incomplete");
  }
  const now = Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_TTL_MS || timestamp > now + MAX_FUTURE_SKEW_MS) {
    throw new Error("Admin signature expired");
  }
  return parsed;
}

async function handleRequest({ method, body }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }
  if (method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const address = normalizeAddress(body?.address).toLowerCase();
    const payload = String(body?.payload || "").trim();
    const signature = String(body?.signature || "").trim();
    if (!payload || !signature) {
      return jsonResponse(400, { ok: false, error: "Invalid admin payload" });
    }

    const owner = await resolveOwnerAddress();
    if (!owner || owner !== address) {
      return jsonResponse(403, { ok: false, error: "Owner only" });
    }

    const recovered = normalizeAddress(
      verifySignedMessage(`community-admin|${payload}`, signature),
    ).toLowerCase();
    if (recovered !== address) {
      return jsonResponse(401, { ok: false, error: "Signature mismatch" });
    }

    const parsed = parseAdminPayload(payload);
    if (parsed.action === "upsert") {
      const poll = normalizePollInput(parsed?.poll || {});
      const existingRes = await supabase
        .from("community_polls")
        .select("id,created_at,created_by_address,closed_at")
        .eq("id", poll.id)
        .maybeSingle();

      if (isMissingTableError(existingRes?.error)) {
        return jsonResponse(500, {
          ok: false,
          error:
            "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
        });
      }
      if (existingRes?.error) {
        return jsonResponse(500, {
          ok: false,
          error: parseErrorMessage(existingRes.error) || "Failed to load poll",
        });
      }

      const existing = existingRes?.data || null;
      const nowIso = new Date().toISOString();
      const upsertRes = await supabase
        .from("community_polls")
        .upsert(
          {
            id: poll.id,
            title: poll.title,
            description: poll.description || null,
            options: poll.options,
            linked_event_id: poll.linkedEventId,
            starts_at: poll.startsAt,
            ends_at: poll.endsAt,
            closed_at: existing?.closed_at || null,
            created_at: existing?.created_at || nowIso,
            created_by_address: existing?.created_by_address || owner,
            updated_at: nowIso,
            updated_by_address: owner,
          },
          { onConflict: "id" },
        )
        .select(
          "id,title,description,options,linked_event_id,starts_at,ends_at,closed_at,created_at,updated_at",
        )
        .single();

      if (isMissingTableError(upsertRes?.error)) {
        return jsonResponse(500, {
          ok: false,
          error:
            "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
        });
      }
      if (upsertRes?.error || !upsertRes?.data) {
        captureException(upsertRes?.error || new Error("Poll upsert failed"), {
          stage: "community_poll_upsert",
        });
        return jsonResponse(500, {
          ok: false,
          error: parseErrorMessage(upsertRes?.error) || "Failed to save poll",
        });
      }

      return jsonResponse(200, { ok: true, poll: upsertRes.data });
    }

    if (parsed.action === "close") {
      const pollId = String(parsed?.pollId || "").trim();
      if (!pollId) {
        return jsonResponse(400, { ok: false, error: "Poll ID is required" });
      }

      const closeRes = await supabase
        .from("community_polls")
        .update({
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by_address: owner,
        })
        .eq("id", pollId)
        .select(
          "id,title,description,options,linked_event_id,starts_at,ends_at,closed_at,created_at,updated_at",
        )
        .maybeSingle();

      if (isMissingTableError(closeRes?.error)) {
        return jsonResponse(500, {
          ok: false,
          error:
            "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
        });
      }
      if (closeRes?.error) {
        return jsonResponse(500, {
          ok: false,
          error: parseErrorMessage(closeRes.error) || "Failed to close poll",
        });
      }
      if (!closeRes?.data) {
        return jsonResponse(404, { ok: false, error: "Poll not found" });
      }

      return jsonResponse(200, { ok: true, poll: closeRes.data });
    }

    return jsonResponse(400, { ok: false, error: "Unsupported admin action" });
  } catch (error) {
    captureException(error, { stage: "community_admin_request" });
    return jsonResponse(400, {
      ok: false,
      error: parseErrorMessage(error) || "Community poll update failed",
    });
  }
}

const vercelHandler = async (req, res) => {
  const body = parseBody(req);
  const result = await handleRequest({ method: req?.method, body });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
};

export default vercelHandler;

export const handler = async (event) => {
  const body = parseBody(event);
  const result = await handleRequest({ method: event?.httpMethod, body });
  return { statusCode: result.status, headers: result.headers, body: result.body };
};
