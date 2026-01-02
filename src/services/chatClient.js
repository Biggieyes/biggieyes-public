// src/services/chatClient.js
// Reuse the shared Supabase client to avoid multiple GoTrueClient instances.
import { supabase, supabaseReady } from "../supabaseClient";

export { supabase, supabaseReady };
