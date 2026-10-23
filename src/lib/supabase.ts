import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

const url = supabaseUrl();
const anonKey = supabaseAnonKey();

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Anonymous sign-in on first launch. Apple sign-in can be enabled later in the
 * Supabase Auth dashboard; the teaser does not require it.
 * When the env vars are missing this stays null and the app runs the local demo.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user) return existing.data.session.user.id;
  const signed = await supabase.auth.signInAnonymously();
  return signed.data.user?.id ?? null;
}
