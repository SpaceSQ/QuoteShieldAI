import { activeVertical } from "../config/vertical.config";
import { buildDemoAudit } from "../engine/auditEngine";
import type { ClientAudit, FullAuditJson } from "../types/audit";

/**
 * Fair band for the built-in Los Angeles demo (Quote Shield AI).
 *
 * Benchmark hvac_heatpump_3ton:
 *   wholesale equipment $2,800 – $4,600
 *   labor 12.0 – 20.0 hours
 *   reasonable markup 35%
 * ZIP 90210 uses prefix 900 (Los Angeles Metro):
 *   material_multiplier 1.10
 *   licensed hourly rate $125 – $185
 *   labor_multiplier 1.35 is NOT applied again, because the hourly rate is already regional.
 *
 * equipment_low  = round(2800 * 110 * 135 / 10000) = 4158
 * equipment_high = round(4600 * 110 * 135 / 10000) = 6831
 * labor_low      = round(12 * 125) = 1500
 * labor_high     = round(20 * 185) = 3700
 * fair_low       = 4158 + 1500 = 5658
 * fair_high      = 6831 + 3700 = 10531
 *
 * Quote lines on the $16,800 demo:
 *   3-ton heat pump equipment $8,050 − fair equipment high $6,831 = $1,219
 *   lump-sum labor $5,450 − fair labor high $3,700 = $1,750
 *   refrigerant recovery billed $800 − included $0 = $800
 *   accessories $2,500 (thermostat, pad, line set, whip) sit outside the core band
 * Flagged overcharge = 1219 + 1750 + 800 = $3,769
 * which sits inside the $2,850 – $4,200 opening negotiation range.
 * The full gap above the fair ceiling is 16800 − 10531 = $6,269
 * and is shown with the fair-price table after unlock.
 */
export const DEMO_ZIP = "90210";
export const DEMO_TRADE = "hvac" as const;
export const DEMO_CONTRACTOR_TOTAL = 16800;
export const DEMO_AUDIT_ID = "demo-90210-hvac";

const hvac = activeVertical.trades.find((trade) => trade.id === DEMO_TRADE);

export const demoFullJson: FullAuditJson = buildDemoAudit({
  copy: activeVertical.negotiation,
  tradeLabel: hvac?.label ?? "HVAC",
});

export function demoClientAudit(): ClientAudit {
  const full = demoFullJson;
  return {
    id: DEMO_AUDIT_ID,
    user_id: "local-demo",
    zip_code: DEMO_ZIP,
    trade_category: DEMO_TRADE,
    metro_name: full.metro_name,
    contractor_total_usd: full.contractor_total_usd,
    estimated_savings_usd: full.estimated_savings_usd,
    savings_low_usd: full.savings_low_usd,
    savings_high_usd: full.savings_high_usd,
    risk_score: full.risk_score,
    red_flag_count: full.red_flags.length,
    teaser_red_flag_titles: full.red_flags.map((flag) => flag.title),
    is_unlocked: false,
    created_at: "2026-01-15T00:00:00.000Z",
    demo: true,
    red_flags: full.red_flags,
    fair_price_low_usd: full.fair_price_low_usd,
    fair_price_high_usd: full.fair_price_high_usd,
    gap_above_ceiling_usd: full.gap_above_ceiling_usd,
    gap_above_floor_usd: full.gap_above_floor_usd,
    missing_protections: full.missing_protections,
    line_items_breakdown: full.line_items_breakdown,
    negotiation_script_email: full.negotiation_script_email,
    negotiation_script_sms: full.negotiation_script_sms,
    band_note: full.band_note,
    full_audit_json: full,
  };
}
