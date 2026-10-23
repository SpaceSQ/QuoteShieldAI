/**
 * Quote Shield AI — audit a contractor quote.
 * CORS preflight is handled by withSupabase (current Supabase Edge Functions).
 * Callers are anonymous Supabase users (a real user JWT). The service role writes the row.
 * is_unlocked is always stored false here. Insider numbers are removed from the HTTP
 * body unless RevenueCat pro_audit is verified, or ALLOW_DEV_UNLOCK is on for local review.
 * The client must not call OpenAI or xAI. This function is the only model entry point.
 *
 * Demo requests and cache hits do not consume the daily quota and do not call a model.
 * Before the one strong vision call, this function calls check_and_consume_ai_quota.
 * Paid status is callerIsPro (RevenueCat entitlement pro_audit, or ALLOW_DEV_UNLOCK).
 * A client-supplied isPaid flag is ignored. If RevenueCat cannot be verified, the
 * user is unpaid: the quota RPC is called with p_is_paid false and no model is called.
 * API keys and image base64 are never logged.
 */
import { withSupabase } from "npm:@supabase/server@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callerIsPro, userIdFromContext } from "../_shared/auth.ts";
import { BudgetCheckError, TokenBudgetExceededError } from "../_shared/inference/budget.ts";
import { AuditRouteError, routeAudit, type QuotaRpcResult } from "../_shared/inference/router.ts";
import { ProviderCallError } from "../_shared/inference/provider.ts";
import { DAILY_CLOUD_AUDIT_LIMIT, QuotaCheckError, QuotaExceededError } from "../_shared/quotaDecision.ts";
import { stripForClient } from "../../../src/engine/auditEngine.ts";

interface AuditBody {
  demo?: boolean;
  zipCode?: string;
  tradeCategory?: string;
  imageBase64?: string;
  mimeType?: string;
  quizAnswers?: Record<string, string>;
  devUnlock?: boolean;
  revenueCatAppUserId?: string;
  userId?: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function routeFailure(error: unknown): Response {
  if (error instanceof QuotaExceededError) {
    return json({ error: error.code, code: error.code, remaining: error.remaining, message: error.message }, error.status);
  }
  if (error instanceof QuotaCheckError) {
    return json({ error: error.code, code: error.code, message: error.message }, error.status);
  }
  if (error instanceof AuditRouteError || error instanceof TokenBudgetExceededError || error instanceof BudgetCheckError) {
    return json({ error: error.code, code: error.code, message: error.message }, error.status);
  }
  if (error instanceof ProviderCallError) {
    const status = error.status === 401 || error.status === 403 ? 401 : 502;
    return json({ error: "PROVIDER_REJECTED", code: "PROVIDER_REJECTED", message: error.message }, status);
  }
  console.error("audit failed", error instanceof Error ? error.name : "error");
  return json({ error: "AUDIT_FAILED", code: "AUDIT_FAILED", message: "The audit could not be completed." }, 500);
}

/**
 * Server-verified Quote Shield AI membership.
 * callerIsPro checks RevenueCat entitlements.pro_audit for this user id, or the
 * local ALLOW_DEV_UNLOCK bypass. A body isPaid flag is not read.
 * A thrown entitlement check means the membership could not be verified.
 */
async function paidMembership(userId: string, body: AuditBody): Promise<boolean> {
  try {
    return await callerIsPro(userId, {
      devUnlock: body.devUnlock,
      revenueCatAppUserId: body.revenueCatAppUserId,
    });
  } catch (error) {
    console.error("entitlement check failed", error instanceof Error ? error.name : "error");
    return false;
  }
}

async function consumeCloudQuota(admin: SupabaseClient, userId: string, isPaid: boolean): Promise<QuotaRpcResult> {
  const { data, error } = await admin.rpc("check_and_consume_ai_quota", {
    p_user: userId,
    p_is_paid: isPaid,
    p_daily_limit: DAILY_CLOUD_AUDIT_LIMIT,
  });
  if (error) {
    console.error("quota rpc failed", error.message.slice(0, 160));
    throw new QuotaCheckError();
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    console.error("quota rpc returned an unreadable row");
    throw new QuotaCheckError();
  }
  const record = row as { allowed?: unknown; remaining?: unknown; used_today?: unknown };
  const remaining = Number(record.remaining ?? 0);
  const usedToday = Number(record.used_today ?? 0);
  if (typeof record.allowed !== "boolean" || !Number.isFinite(remaining) || !Number.isFinite(usedToday)) {
    console.error("quota rpc returned an unreadable row");
    throw new QuotaCheckError();
  }
  return { allowed: record.allowed, remaining, usedToday };
}

export default {
  fetch: withSupabase({ auth: ["user", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED", code: "METHOD_NOT_ALLOWED", message: "POST only." }, 405);
    }
    let body: AuditBody;
    try {
      body = (await req.json()) as AuditBody;
    } catch {
      return json({ error: "BAD_JSON", code: "BAD_JSON", message: "Expected a JSON body." }, 400);
    }

    const userId = userIdFromContext(ctx, body.userId);
    if (!userId) {
      return json({ error: "AUTH_REQUIRED", code: "AUTH_REQUIRED", message: "Sign in anonymously before auditing." }, 401);
    }

    const admin = ctx.supabaseAdmin as SupabaseClient | undefined;
    if (!admin) {
      return json({ error: "SERVER_MISCONFIGURED", code: "SERVER_MISCONFIGURED", message: "Supabase admin client is unavailable." }, 500);
    }

    const demo = body.demo === true;
    const zipCode = String(body.zipCode || (demo ? "90210" : ""));
    const tradeCategory = String(body.tradeCategory || (demo ? "hvac" : ""));
    const isPaid = await paidMembership(userId, body);
    const auditId = crypto.randomUUID();
    try {
      const routed = await routeAudit({
        db: admin,
        userId,
        auditId,
        demo,
        isPaid,
        consumeQuota: () => consumeCloudQuota(admin, userId, isPaid),
        zipCode,
        tradeCategory,
        imageBase64: body.imageBase64,
        mimeType: body.mimeType,
        quizAnswers: body.quizAnswers,
      });

      if (!routed.audit.contractor_total_usd || !Number.isFinite(routed.audit.fair_price_low_usd)) {
        return json({ error: "AUDIT_SCHEMA_INVALID", code: "AUDIT_SCHEMA_INVALID", message: "The audit was missing required prices, so it was not saved." }, 422);
      }

      const { data, error } = await admin
        .from("quote_audits")
        .insert({
          id: auditId,
          user_id: userId,
          zip_code: zipCode,
          trade_category: tradeCategory,
          image_storage_path: null,
          contractor_total_usd: routed.audit.contractor_total_usd,
          fair_price_low_usd: routed.audit.fair_price_low_usd,
          fair_price_high_usd: routed.audit.fair_price_high_usd,
          estimated_savings_usd: routed.audit.estimated_savings_usd,
          savings_low_usd: routed.audit.savings_low_usd,
          savings_high_usd: routed.audit.savings_high_usd,
          risk_score: routed.audit.risk_score,
          red_flag_count: routed.audit.red_flags.length,
          teaser_red_flag_titles: routed.audit.red_flags.map((flag) => flag.title),
          is_unlocked: false,
          full_audit_json: routed.audit,
        })
        .select("id, created_at")
        .single();

      if (error || !data) {
        console.error("audit insert failed", error?.message?.slice(0, 160) ?? "empty");
        return json({ error: "SAVE_FAILED", code: "SAVE_FAILED", message: "The audit could not be saved." }, 500);
      }

      if (body.imageBase64 && !demo) {
        try {
          const { decodeBase64 } = await import("../_shared/inference/cache.ts");
          const bytes = decodeBase64(body.imageBase64);
          const path = `${userId}/${auditId}.jpg`;
          const upload = await admin.storage.from("quote-images").upload(path, bytes, {
            contentType: body.mimeType || "image/jpeg",
            upsert: false,
          });
          if (!upload.error) {
            await admin.from("quote_audits").update({ image_storage_path: path }).eq("id", auditId).eq("user_id", userId);
          }
        } catch {
          // A missing bucket should not fail the audit. The path stays null.
        }
      }

      const createdAt = data.created_at ?? new Date().toISOString();
      const base = {
        id: data.id as string,
        user_id: userId,
        zip_code: zipCode,
        trade_category: tradeCategory,
        metro_name: routed.audit.metro_name,
        contractor_total_usd: routed.audit.contractor_total_usd,
        estimated_savings_usd: routed.audit.estimated_savings_usd,
        savings_low_usd: routed.audit.savings_low_usd,
        savings_high_usd: routed.audit.savings_high_usd,
        risk_score: routed.audit.risk_score,
        red_flag_count: routed.audit.red_flags.length,
        teaser_red_flag_titles: routed.audit.red_flags.map((flag) => flag.title),
        created_at: createdAt,
        demo,
        red_flags: routed.audit.red_flags,
        full_audit_json: routed.audit,
      };
      if (!isPaid) return json(stripForClient(base));
      return json({
        ...base,
        is_unlocked: false,
        fair_price_low_usd: routed.audit.fair_price_low_usd,
        fair_price_high_usd: routed.audit.fair_price_high_usd,
        gap_above_ceiling_usd: routed.audit.gap_above_ceiling_usd,
        gap_above_floor_usd: routed.audit.gap_above_floor_usd,
        missing_protections: routed.audit.missing_protections,
        line_items_breakdown: routed.audit.line_items_breakdown,
        negotiation_script_email: routed.audit.negotiation_script_email,
        negotiation_script_sms: routed.audit.negotiation_script_sms,
        band_note: routed.audit.band_note,
      });
    } catch (error) {
      return routeFailure(error);
    }
  }),
};
