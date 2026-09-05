import { createClient } from "@supabase/supabase-js";
import { buildApiHeaders } from "./httpSecurity.js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
).trim();
let supabaseAdmin = null;

export const hasSupabaseConfig = () =>
  Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

export const getSupabaseAdmin = () => {
  if (!hasSupabaseConfig()) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
};

export const buildCorsHeaders = (methods) => buildApiHeaders({ methods });

export const jsonResponse = (corsHeaders, status, body) => ({
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders },
  body: JSON.stringify(body),
});

export const parseDatabaseError = (error) => {
  if (!error) return "";
  if (typeof error === "string") return error;
  return String(
    error.message || error.details || error.hint || error.error || "",
  );
};

export const isMissingTableError = (error) =>
  error?.code === "PGRST205" ||
  /could not find the table|relation .* does not exist/i.test(
    parseDatabaseError(error),
  );

export const isNonceSchemaError = (error) =>
  error?.code === "42P10" ||
  /no unique or exclusion constraint.*on conflict/i.test(
    parseDatabaseError(error),
  );

export const unavailableResponse = (corsHeaders, message) =>
  jsonResponse(corsHeaders, 503, {
    ok: false,
    error: message || "Live chat database is unavailable.",
  });
