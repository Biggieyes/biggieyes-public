// src/supabaseClient.js
// Supabase client for Moderator Center (read-only on the frontend).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_MOD_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  "";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_MOD_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "biggi_mod_center",
  },
});

