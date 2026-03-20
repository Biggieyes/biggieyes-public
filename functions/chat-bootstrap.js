// api/chat-bootstrap.js
// Loads live-chat rules + recent messages using Supabase service role.
import { createClient } from "@supabase/supabase-js";
import { captureException, initSentry } from "./_sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

initSentry();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const jsonResponse = (status, body) => ({
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders },
  body: JSON.stringify(body),
});

const parseErrorMessage = (err) => {
  if (!err) return "";
  if (typeof err === "string") return err;
  return String(err.message || err.details || err.hint || err.error || "");
};

const isMissingTableError = (err) =>
  err?.code === "PGRST205" ||
  /Could not find the table/i.test(parseErrorMessage(err));

async function handleRequest({ method }) {
  if (method === "OPTIONS") return jsonResponse(200, { ok: true });
  if (method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env" });
  }

  const [rulesRes, msgsRes] = await Promise.all([
    supabase.from("rules").select("text").eq("id", 1).maybeSingle(),
    supabase
      .from("messages")
      .select(
        "id,author_address,author_name,content,created_at,edited_at,deleted",
      )
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const missingMessagesTable = isMissingTableError(msgsRes?.error);
  if (missingMessagesTable) {
    return jsonResponse(500, {
      ok: false,
      error: "Live chat tables are missing in Supabase. Run sql/migration_init.sql.",
    });
  }

  if (msgsRes?.error) {
    captureException(msgsRes.error, { stage: "chat_bootstrap_messages" });
    return jsonResponse(500, {
      ok: false,
      error: parseErrorMessage(msgsRes.error) || "Failed to load messages",
    });
  }

  const missingRulesTable = isMissingTableError(rulesRes?.error);
  if (rulesRes?.error && !missingRulesTable) {
    captureException(rulesRes.error, { stage: "chat_bootstrap_rules" });
  }

  const messages = Array.isArray(msgsRes?.data) ? msgsRes.data : [];
  const rulesText = rulesRes?.data?.text ? String(rulesRes.data.text) : "";

  return jsonResponse(200, {
    ok: true,
    rulesText,
    messages,
  });
}

const vercelHandler = async (req, res) => {
  const result = await handleRequest({ method: req?.method });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(result.body);
};

export default vercelHandler;

export const handler = async (event) => {
  const result = await handleRequest({ method: event?.httpMethod });
  return { statusCode: result.status, headers: result.headers, body: result.body };
};

