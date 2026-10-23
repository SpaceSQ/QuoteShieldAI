/**
 * Golden-demo sample reports. Opening one does not upload a photo or call a model.
 */

import { goldenDemoCatalog, normalizeToRange, normalizeTradeKey, parseZip5, toAppTradeId } from "../knowledge/knowledgeAdapter";
import type { ClientAudit, FullAuditJson, RedFlag } from "../types/audit";

export function buildSampleClientAudit(caseId: string, userId: string | null): ClientAudit {
  const sample = goldenDemoCatalog.cases.find((item) => item.case_id === caseId);
  if (!sample) throw new Error(`Unknown sample case ${caseId}`);
  const trade = normalizeTradeKey(sample.trade_category);
  if (!trade) throw new Error(`Unknown sample trade ${sample.trade_category}`);
  const fair = normalizeToRange(sample.verified_fair_range_usd);
  const zip = parseZip5(sample.location_zip) ?? "";
  const flags: RedFlag[] = sample.line_by_line_xray
    .filter((line) => line.overcharge_usd > 0)
    .map((line) => ({
      title: line.item,
      severity: line.overcharge_usd >= 1000 ? "HIGH" : "MEDIUM",
      quoted_amount_usd: typeof line.quoted_usd === "number" ? line.quoted_usd : 0,
      fair_benchmark_usd: line.fair_installed_equipment_usd,
      potential_overcharge_usd: line.overcharge_usd,
      insider_explanation: line.evidence_badge,
      what_to_ask: sample.winning_counter_offer_script,
    }));
  const lines = sample.line_by_line_xray.map((line) => ({
    description: line.item,
    quoted_usd: typeof line.quoted_usd === "number" ? line.quoted_usd : 0,
    fair_low_usd: line.fair_installed_equipment_usd,
    fair_high_usd: line.fair_installed_equipment_usd,
    note: line.evidence_badge,
  }));
  const full: FullAuditJson = {
    contractor_total_usd: sample.contractor_quoted_total_usd,
    fair_price_low_usd: fair.low,
    fair_price_high_usd: fair.high,
    estimated_savings_usd: sample.verified_savings_achieved_usd,
    savings_low_usd: sample.verified_savings_achieved_usd,
    savings_high_usd: sample.verified_savings_achieved_usd,
    gap_above_ceiling_usd: Math.max(0, sample.contractor_quoted_total_usd - fair.high),
    gap_above_floor_usd: Math.max(0, sample.contractor_quoted_total_usd - fair.low),
    risk_score: sample.risk_score,
    red_flags: flags,
    missing_protections: [],
    line_items_breakdown: lines,
    negotiation_script_email: sample.winning_counter_offer_script,
    negotiation_script_sms: sample.winning_counter_offer_script,
    benchmark_id: sample.case_id,
    metro_name: sample.location_zip,
    band_note: "Sample fair band published with this case.",
    inference_tier: 0,
    model: null,
  };
  return {
    id: `sample-${sample.case_id}`,
    user_id: userId ?? "local-sample",
    zip_code: zip,
    trade_category: toAppTradeId(trade),
    metro_name: sample.location_zip,
    contractor_total_usd: sample.contractor_quoted_total_usd,
    estimated_savings_usd: sample.verified_savings_achieved_usd,
    savings_low_usd: sample.verified_savings_achieved_usd,
    savings_high_usd: sample.verified_savings_achieved_usd,
    risk_score: sample.risk_score,
    red_flag_count: flags.length,
    teaser_red_flag_titles: flags.map((flag) => flag.title),
    is_unlocked: true,
    created_at: "2026-10-23T00:00:00.000Z",
    demo: false,
    red_flags: flags,
    fair_price_low_usd: fair.low,
    fair_price_high_usd: fair.high,
    gap_above_ceiling_usd: full.gap_above_ceiling_usd,
    gap_above_floor_usd: full.gap_above_floor_usd,
    missing_protections: [],
    line_items_breakdown: lines,
    negotiation_script_email: sample.winning_counter_offer_script,
    negotiation_script_sms: sample.winning_counter_offer_script,
    band_note: full.band_note,
    full_audit_json: full,
  };
}
