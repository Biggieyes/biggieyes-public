import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { captureException, initSentry } from "./_sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SIGNATURE_TTL_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

function parseOptions(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  return list
    .map((item, index) => {
      if (typeof item === "string") {
        const label = item.trim();
        if (!label) return null;
        return { id: `option-${index + 1}`, label };
      }
      const id = String(item?.id || `option-${index + 1}`).trim();
      const label = String(item?.label || "").trim();
      if (!id || !label) return null;
      return { id, label };
    })
    .filter(Boolean);
}

function resolvePollStatus(poll, nowMs = Date.now()) {
  const closedAtMs = poll?.closedAt ? new Date(poll.closedAt).getTime() : NaN;
  if (Number.isFinite(closedAtMs)) return "Closed";

  const startsAtMs = poll?.startsAt ? new Date(poll.startsAt).getTime() : NaN;
  if (Number.isFinite(startsAtMs) && nowMs < startsAtMs) return "Upcoming";

  const endsAtMs = poll?.endsAt ? new Date(poll.endsAt).getTime() : NaN;
  if (Number.isFinite(endsAtMs) && nowMs > endsAtMs) return "Closed";

  return "Live";
}

function normalizePollRow(row, votes = [], walletAddress = "") {
  const options = parseOptions(row?.options);
  const counts = new Map();
  let myVoteOptionId = "";

  for (const vote of votes) {
    const optionId = String(vote?.option_id || "").trim();
    if (!optionId) continue;
    counts.set(optionId, (counts.get(optionId) || 0) + 1);
    if (
      walletAddress &&
      String(vote?.voter_address || "").trim().toLowerCase() ===
        walletAddress.toLowerCase()
    ) {
      myVoteOptionId = optionId;
    }
  }

  const optionsWithVotes = options.map((option) => ({
    ...option,
    votes: Number(counts.get(option.id) || 0),
  }));
  const totalVotes = optionsWithVotes.reduce(
    (sum, option) => sum + Number(option.votes || 0),
    0,
  );

  const poll = {
    id: String(row?.id || "").trim(),
    title: String(row?.title || "").trim(),
    description: String(row?.description || "").trim(),
    linkedEventId:
      row?.linked_event_id == null || row?.linked_event_id === ""
        ? null
        : Number(row.linked_event_id),
    startsAt: row?.starts_at || null,
    endsAt: row?.ends_at || null,
    closedAt: row?.closed_at || null,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    options: optionsWithVotes,
    totalVotes,
    myVoteOptionId,
  };

  poll.status = resolvePollStatus(poll);
  return poll;
}

async function loadPolls({ walletAddress = "", includeAll = false } = {}) {
  const limit = includeAll ? 50 : 24;
  const pollRes = await supabase
    .from("community_polls")
    .select(
      "id,title,description,options,linked_event_id,starts_at,ends_at,closed_at,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isMissingTableError(pollRes?.error)) {
    throw new Error(
      "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
    );
  }
  if (pollRes?.error) {
    throw new Error(parseErrorMessage(pollRes.error) || "Failed to load polls");
  }

  const rows = Array.isArray(pollRes?.data) ? pollRes.data : [];
  const ids = rows.map((row) => String(row?.id || "").trim()).filter(Boolean);
  const voteRes = ids.length
    ? await supabase
        .from("community_poll_votes")
        .select("poll_id,option_id,voter_address")
        .in("poll_id", ids)
    : { data: [], error: null };

  if (isMissingTableError(voteRes?.error)) {
    throw new Error(
      "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
    );
  }
  if (voteRes?.error) {
    throw new Error(parseErrorMessage(voteRes.error) || "Failed to load votes");
  }

  const groupedVotes = new Map();
  for (const vote of Array.isArray(voteRes?.data) ? voteRes.data : []) {
    const pollId = String(vote?.poll_id || "").trim();
    if (!pollId) continue;
    const list = groupedVotes.get(pollId) || [];
    list.push(vote);
    groupedVotes.set(pollId, list);
  }

  return rows.map((row) =>
    normalizePollRow(row, groupedVotes.get(String(row?.id || "").trim()) || [], walletAddress),
  );
}

function validateVotePayload(payload) {
  const raw = String(payload || "").trim();
  if (!raw) throw new Error("Vote payload is missing");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Vote payload is invalid");
  }
  const pollId = String(parsed?.pollId || "").trim();
  const optionId = String(parsed?.optionId || "").trim();
  const timestamp = Number(parsed?.timestamp);
  if (!pollId || !optionId || !Number.isFinite(timestamp)) {
    throw new Error("Vote payload is incomplete");
  }
  const now = Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_TTL_MS || timestamp > now + MAX_FUTURE_SKEW_MS) {
    throw new Error("Vote signature expired");
  }
  return { pollId, optionId, timestamp };
}

async function handleRequest({ method, query, body }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }

  if (method === "GET") {
    try {
      const rawAddress = String(query?.address || "").trim();
      const walletAddress = rawAddress ? normalizeAddress(rawAddress).toLowerCase() : "";
      const includeAll = String(query?.includeAll || "").trim() === "1";
      const polls = await loadPolls({ walletAddress, includeAll });
      return jsonResponse(200, { ok: true, polls });
    } catch (error) {
      const message = parseErrorMessage(error) || "Failed to load community voting";
      return jsonResponse(500, { ok: false, error: message });
    }
  }

  if (method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const address = normalizeAddress(body?.address).toLowerCase();
    const payload = String(body?.payload || "").trim();
    const signature = String(body?.signature || "").trim();
    if (!payload || !signature) {
      return jsonResponse(400, { ok: false, error: "Invalid vote payload" });
    }

    const recovered = normalizeAddress(
      verifySignedMessage(`community-vote|${payload}`, signature),
    ).toLowerCase();
    if (recovered !== address) {
      return jsonResponse(401, { ok: false, error: "Signature mismatch" });
    }

    const { pollId, optionId } = validateVotePayload(payload);
    const pollRes = await supabase
      .from("community_polls")
      .select("id,title,description,options,linked_event_id,starts_at,ends_at,closed_at,created_at,updated_at")
      .eq("id", pollId)
      .maybeSingle();

    if (isMissingTableError(pollRes?.error)) {
      return jsonResponse(500, {
        ok: false,
        error:
          "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
      });
    }
    if (pollRes?.error) {
      return jsonResponse(500, {
        ok: false,
        error: parseErrorMessage(pollRes.error) || "Failed to load poll",
      });
    }
    if (!pollRes?.data) {
      return jsonResponse(404, { ok: false, error: "Poll not found" });
    }

    const poll = normalizePollRow(pollRes.data, [], address);
    if (resolvePollStatus(poll) !== "Live") {
      return jsonResponse(400, { ok: false, error: "Poll is not open for voting" });
    }
    if (!poll.options.some((option) => option.id === optionId)) {
      return jsonResponse(400, { ok: false, error: "Selected option is invalid" });
    }

    const insertRes = await supabase.from("community_poll_votes").insert({
      poll_id: pollId,
      option_id: optionId,
      voter_address: address,
    });

    if (insertRes?.error) {
      if (String(insertRes.error.code || "") === "23505") {
        return jsonResponse(409, { ok: false, error: "This wallet already voted on the poll" });
      }
      if (isMissingTableError(insertRes.error)) {
        return jsonResponse(500, {
          ok: false,
          error:
            "Community voting tables are missing in Supabase. Run sql/migration_community_voting.sql.",
        });
      }
      captureException(insertRes.error, { stage: "community_vote_insert" });
      return jsonResponse(500, {
        ok: false,
        error: parseErrorMessage(insertRes.error) || "Vote insert failed",
      });
    }

    return jsonResponse(200, { ok: true, pollId, optionId });
  } catch (error) {
    captureException(error, { stage: "community_vote_request" });
    return jsonResponse(400, {
      ok: false,
      error: parseErrorMessage(error) || "Vote failed",
    });
  }
}

const vercelHandler = async (req, res) => {
  const query = req?.query || {};
  const body = parseBody(req);
  const result = await handleRequest({ method: req?.method, query, body });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
};

export default vercelHandler;

export const handler = async (event) => {
  const query = event?.queryStringParameters || {};
  const body = parseBody(event);
  const result = await handleRequest({ method: event?.httpMethod, query, body });
  return { statusCode: result.status, headers: result.headers, body: result.body };
};
