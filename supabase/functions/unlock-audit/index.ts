/**
 * Quote Shield AI — mark an audit unlocked.
 *
 * Production must verify the RevenueCat entitlement server-side. This function
 * calls the RevenueCat REST API with REVENUECAT_SECRET_API_KEY and checks
 * entitlements.pro_audit. A client-supplied isPro flag is never accepted.
 *
 * The app user id must equal the Supabase user id (Purchases.logIn(userId)).
 *
 * Local App Review / simulator bypass: set ALLOW_DEV_UNLOCK=true and send
 * { "devUnlock": true, "auditId": "..." }. Never enable ALLOW_DEV_UNLOCK in production.
 */
import { withSupabase } from "npm:@supabase/server@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callerIsPro, userIdFromContext } from "../_shared/auth.ts";
import type { BuiltAudit } from "../../../src/engine/auditEngine.ts";

interface UnlockBody {
  auditId?: string;
  devUnlock?: boolean;
  revenueCatAppUserId?: string;
  userId?: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: ["user", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED", code: "METHOD_NOT_ALLOWED", message: "POST only." }, 405);
    }
    let body: UnlockBody;
    try {
      body = (await req.json()) as UnlockBody;
    } catch {
      return json({ error: "BAD_JSON", code: "BAD_JSON", message: "Expected a JSON body." }, 400);
    }
    if (!body.auditId) {
      return json({ error: "AUDIT_REQUIRED", code: "AUDIT_REQUIRED", message: "Missing audit id." }, 400);
    }

    const userId = userIdFromContext(ctx, body.userId);
    if (!userId) {
      return json({ error: "AUTH_REQUIRED", code: "AUTH_REQUIRED", message: "Sign in before unlocking." }, 401);
    }
    const allowed = await callerIsPro(userId, body);
    if (!allowed) {
      return json(
        {
          error: "ENTITLEMENT_REQUIRED",
          code: "ENTITLEMENT_REQUIRED",
          message:
            "Production must verify RevenueCat server-side (entitlement pro_audit). For a local review build, set ALLOW_DEV_UNLOCK=true and send devUnlock.",
        },
        403,
      );
    }

    const admin = ctx.supabaseAdmin as SupabaseClient | undefined;
    if (!admin) {
      return json({ error: "SERVER_MISCONFIGURED", code: "SERVER_MISCONFIGURED", message: "Supabase admin client is unavailable." }, 500);
    }

    const { data, error } = await admin
      .from("quote_audits")
      .update({ is_unlocked: true })
      .eq("id", body.auditId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("unlock failed", error.message.slice(0, 160));
      return json({ error: "UNLOCK_FAILED", code: "UNLOCK_FAILED", message: "The audit could not be unlocked." }, 500);
    }
    if (!data) {
      return json({ error: "NOT_FOUND", code: "NOT_FOUND", message: "That audit is not on this account." }, 404);
    }

    const full = data.full_audit_json as BuiltAudit;
    return json({
      id: data.id,
      user_id: data.user_id,
      zip_code: data.zip_code,
      trade_category: data.trade_category,
      metro_name: full.metro_name,
      contractor_total_usd: Number(data.contractor_total_usd),
      fair_price_low_usd: Number(data.fair_price_low_usd),
      fair_price_high_usd: Number(data.fair_price_high_usd),
      estimated_savings_usd: Number(data.estimated_savings_usd),
      savings_low_usd: Number(data.savings_low_usd),
      savings_high_usd: Number(data.savings_high_usd),
      gap_above_ceiling_usd: full.gap_above_ceiling_usd,
      gap_above_floor_usd: full.gap_above_floor_usd,
      risk_score: Number(data.risk_score),
      red_flag_count: Number(data.red_flag_count),
      teaser_red_flag_titles: data.teaser_red_flag_titles,
      is_unlocked: true,
      created_at: data.created_at,
      red_flags: full.red_flags,
      missing_protections: full.missing_protections,
      line_items_breakdown: full.line_items_breakdown,
      negotiation_script_email: full.negotiation_script_email,
      negotiation_script_sms: full.negotiation_script_sms,
      band_note: full.band_note,
      full_audit_json: full,
    });
  }),
};
