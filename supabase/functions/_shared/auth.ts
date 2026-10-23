const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (serviceRole && !Deno.env.get("SUPABASE_SECRET_KEY")) {
  try {
    Deno.env.set("SUPABASE_SECRET_KEY", serviceRole);
  } catch {
    // Some hosted isolates lock env writes. serviceClient() still reads the legacy name.
  }
}

const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
if (anonKey && !Deno.env.get("SUPABASE_PUBLISHABLE_KEY")) {
  try {
    Deno.env.set("SUPABASE_PUBLISHABLE_KEY", anonKey);
  } catch {
    // See above.
  }
}

export function userIdFromContext(
  ctx: { authMode?: string; userClaims?: { id?: string; sub?: string } | null },
  bodyUserId: unknown,
): string | null {
  if (ctx.authMode === "user") {
    return ctx.userClaims?.id ?? ctx.userClaims?.sub ?? null;
  }
  if (ctx.authMode === "secret" && typeof bodyUserId === "string" && bodyUserId.length > 0) {
    return bodyUserId;
  }
  return null;
}

/** Production must verify RevenueCat. Returns null when the secret is not configured. */
export async function hasProEntitlement(appUserId: string): Promise<boolean | null> {
  const secret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  if (!secret) return null;
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } },
  );
  if (!response.ok) return false;
  const body = await response.json();
  const entitlement = body?.subscriber?.entitlements?.pro_audit;
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true;
  return new Date(entitlement.expires_date).getTime() > Date.now();
}

export async function callerIsPro(userId: string, body: { devUnlock?: boolean; revenueCatAppUserId?: string }): Promise<boolean> {
  if (Deno.env.get("ALLOW_DEV_UNLOCK") === "true" && body.devUnlock === true) return true;
  if (!body.revenueCatAppUserId || body.revenueCatAppUserId !== userId) return false;
  return (await hasProEntitlement(body.revenueCatAppUserId)) === true;
}
