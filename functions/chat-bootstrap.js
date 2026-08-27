// Loads live-chat rules and recent messages through the server-side client.
import { captureException, initSentry } from "./_sentry.js";
import {
  buildCorsHeaders,
  getSupabaseAdmin,
  hasSupabaseConfig,
  isMissingTableError,
  jsonResponse,
  unavailableResponse,
} from "./lib/chatUtils.js";

const corsHeaders = buildCorsHeaders("GET,OPTIONS");

initSentry();

export async function handleRequest({ method }) {
  if (method === "OPTIONS") return jsonResponse(corsHeaders, 200, { ok: true });
  if (method !== "GET") {
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

  const supabase = getSupabaseAdmin();
  let rulesRes;
  let messagesRes;

  try {
    [rulesRes, messagesRes] = await Promise.all([
      supabase.from("rules").select("text").eq("id", 1).maybeSingle(),
      supabase
        .from("messages")
        .select(
          "id,author_address,author_name,content,created_at,edited_at,deleted",
        )
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
  } catch (error) {
    captureException(error, { stage: "chat_bootstrap_fetch" });
    return unavailableResponse(corsHeaders);
  }

  if (isMissingTableError(messagesRes?.error)) {
    return unavailableResponse(
      corsHeaders,
      "Live chat database schema is missing.",
    );
  }
  if (messagesRes?.error) {
    captureException(messagesRes.error, { stage: "chat_bootstrap_messages" });
    return unavailableResponse(corsHeaders);
  }

  const missingRulesTable = isMissingTableError(rulesRes?.error);
  if (rulesRes?.error && !missingRulesTable) {
    captureException(rulesRes.error, { stage: "chat_bootstrap_rules" });
  }

  return jsonResponse(corsHeaders, 200, {
    ok: true,
    rulesText: rulesRes?.data?.text ? String(rulesRes.data.text) : "",
    messages: Array.isArray(messagesRes?.data) ? messagesRes.data : [],
  });
}

const vercelHandler = async (req, res) => {
  const result = await handleRequest({ method: req?.method });
  res.statusCode = result.status;
  Object.entries(result.headers).forEach(([key, value]) =>
    res.setHeader(key, value),
  );
  res.end(result.body);
};

export default vercelHandler;

export const handler = async (event) => {
  const result = await handleRequest({ method: event?.httpMethod });
  return {
    statusCode: result.status,
    headers: result.headers,
    body: result.body,
  };
};
