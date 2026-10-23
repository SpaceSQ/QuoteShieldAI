import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BuiltAudit } from "../../../../src/engine/auditEngine.ts";

export function decodeBase64(input: string): Uint8Array {
  const cleaned = input.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!cleaned) throw new Error("IMAGE_REQUIRED");
  if (cleaned.length > 8_000_000) throw new Error("PAYLOAD_TOO_LARGE");
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new Error("IMAGE_ENCODING");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function cacheKey(bytes: Uint8Array, zip: string, trade: string): Promise<string> {
  const suffix = new TextEncoder().encode(`|${zip}|${trade}`);
  const merged = new Uint8Array(bytes.length + suffix.length);
  merged.set(bytes, 0);
  merged.set(suffix, bytes.length);
  const digest = await crypto.subtle.digest("SHA-256", merged);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readCache(db: SupabaseClient, key: string): Promise<BuiltAudit | null> {
  const { data, error } = await db
    .from("inference_cache")
    .select("full_audit_json")
    .eq("cache_key", key)
    .maybeSingle();
  if (error || !data?.full_audit_json) return null;
  return data.full_audit_json as BuiltAudit;
}

export async function writeCache(
  db: SupabaseClient,
  key: string,
  zip: string,
  trade: string,
  audit: BuiltAudit,
): Promise<void> {
  const { error } = await db.from("inference_cache").upsert({
    cache_key: key,
    zip_code: zip,
    trade_category: trade,
    full_audit_json: audit,
  });
  if (error) console.error("cache write failed", error.message.slice(0, 160));
}
