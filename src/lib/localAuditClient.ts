/**
 * On-device Quote Shield AI benchmark used when a cloud audit cannot run.
 * Demo and sample reports do not call this.
 */

import { runKnowledgeBackedLocalAudit } from "../engines/quoteShieldCore";
import type { ClientAudit, FullAuditJson } from "../types/audit";

export type LocalFallbackReason = "unpaid" | "quota";

export function localFallbackReason(
  error: { code: string; message: string; remaining: number | null },
  isPro: boolean,
): LocalFallbackReason | null {
  if (error.code === "LOCAL_DEMO") return "unpaid";
  if (error.code !== "QUOTA_EXCEEDED") return null;
  if (/3 cloud audits|per utc day/i.test(error.message)) return "quota";
  if (isPro && error.remaining === 0) return "quota";
  return "unpaid";
}

export function buildLocalClientAudit(input: {
  zipCode: string;
  tradeCategory: string;
  userId: string | null;
  contractorTotalUsd?: number;
}): ClientAudit {
  const audit = runKnowledgeBackedLocalAudit({
    zipCode: input.zipCode,
    tradeCategory: input.tradeCategory,
    contractorTotalUsd: input.contractorTotalUsd,
  });
  const full: FullAuditJson = {
    contractor_total_usd: audit.contractor_total_usd,
    fair_price_low_usd: audit.fair_price_low_usd,
    fair_price_high_usd: audit.fair_price_high_usd,
    estimated_savings_usd: audit.estimated_savings_usd,
    savings_low_usd: audit.savings_low_usd,
    savings_high_usd: audit.savings_high_usd,
    gap_above_ceiling_usd: audit.gap_above_ceiling_usd,
    gap_above_floor_usd: audit.gap_above_floor_usd,
    risk_score: audit.risk_score,
    red_flags: audit.red_flags,
    missing_protections: audit.missing_protections,
    line_items_breakdown: audit.line_items_breakdown,
    negotiation_script_email: audit.negotiation_script_email,
    negotiation_script_sms: audit.negotiation_script_sms,
    benchmark_id: audit.benchmark_id,
    metro_name: audit.metro_name,
    band_note: audit.band_note,
    inference_tier: 0,
    model: null,
  };
  return {
    id: `local-${audit.zip_code}-${audit.trade_category}-${Date.now()}`,
    user_id: input.userId ?? "local",
    zip_code: audit.zip_code,
    trade_category: audit.trade_category,
    metro_name: audit.metro_name,
    contractor_total_usd: audit.contractor_total_usd,
    estimated_savings_usd: audit.estimated_savings_usd,
    savings_low_usd: audit.savings_low_usd,
    savings_high_usd: audit.savings_high_usd,
    risk_score: audit.risk_score,
    red_flag_count: audit.red_flags.length,
    teaser_red_flag_titles: audit.red_flags.map((flag) => flag.title),
    is_unlocked: false,
    created_at: new Date().toISOString(),
    demo: false,
    red_flags: audit.red_flags,
    fair_price_low_usd: audit.fair_price_low_usd,
    fair_price_high_usd: audit.fair_price_high_usd,
    gap_above_ceiling_usd: audit.gap_above_ceiling_usd,
    gap_above_floor_usd: audit.gap_above_floor_usd,
    missing_protections: audit.missing_protections,
    line_items_breakdown: audit.line_items_breakdown,
    negotiation_script_email: audit.negotiation_script_email,
    negotiation_script_sms: audit.negotiation_script_sms,
    band_note: audit.band_note,
    full_audit_json: full,
  };
}
