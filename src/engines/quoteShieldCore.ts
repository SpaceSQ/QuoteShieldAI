/**
 * Quote Shield AI local price fallback.
 * Prices from the 30-metro ZIP matrix and the 15 trade blueprints.
 * This function does not call fetch, OpenAI, xAI, or Supabase.
 *
 * Fair equipment = wholesale BOM × 1.35 × metro material index.
 * Fair labor = crew × hours × calibrated invoice hourly (burdened mid × 1.25).
 * Fair total = (equipment + labor + permit) × [0.92, 1.12].
 *
 * Golden demo `verified_fair_range_usd` is a narrative fixture. Irvine HVAC
 * publishes $11,800–$14,400. When that published range differs from the
 * calibrated band, `band_note` says so and the demo dollars are not copied
 * into `fair_price_low_usd` / `fair_price_high_usd`.
 */

import { activeVertical, tradeLabel } from "../config/vertical.config";
import { formatUsd, scoreRisk } from "../engine/auditEngine";
import {
  type Blueprint,
  type BlueprintTierName,
  type GoldenDemoMatch,
  type HourlyBand,
  type KnowledgeTrade,
  BURDENED_TO_INVOICE_HOURLY,
  defaultBlueprintForTrade,
  lookupBlueprintById,
  normalizeToRange,
  normalizeTradeKey,
  resolvePricingLocation,
  selectBestGoldenDemo,
  toAppTradeId,
} from "../knowledge/knowledgeAdapter";
import type { LineItemBreakdown, RedFlag, TradeId } from "../types/audit";

/** HANDOFF fair_pricing_formulas.Fair_Equipment. */
export const FAIR_EQUIPMENT_MARKUP = 1.35;
/** HANDOFF fair_pricing_formulas.Fair_Total_Range. */
export const FAIR_TOTAL_LOW_FACTOR = 0.92;
export const FAIR_TOTAL_HIGH_FACTOR = 1.12;

/**
 * HANDOFF does not name a tier. `better` is the mid specification.
 * `best` is the flagship tier and is not the default.
 */
export const DEFAULT_BLUEPRINT_TIER: BlueprintTierName = "better";

export interface KnowledgeLocalAuditRequest {
  zipCode: string;
  tradeCategory: string;
  contractorTotalUsd?: number;
  tier?: BlueprintTierName;
  blueprintId?: string;
  visibleClauses?: string[];
}

export interface KnowledgeLocalAudit {
  contractor_total_usd: number;
  fair_price_low_usd: number;
  fair_price_high_usd: number;
  estimated_savings_usd: number;
  savings_low_usd: number;
  savings_high_usd: number;
  gap_above_ceiling_usd: number;
  gap_above_floor_usd: number;
  risk_score: number;
  red_flags: RedFlag[];
  missing_protections: string[];
  line_items_breakdown: LineItemBreakdown[];
  negotiation_script_email: string;
  negotiation_script_sms: string;
  benchmark_id: string;
  metro_name: string;
  band_note: string;
  inference_tier: 0;
  model: null;
  zip_code: string;
  trade_category: TradeId;
  tier: BlueprintTierName;
  metro_id: string;
  pricing_source: "zip_matrix" | "national_baseline";
  permit_evidence_level: string;
  material_multiplier: number;
  permit_multiplier: number;
  equipment_low_usd: number;
  equipment_high_usd: number;
  labor_low_usd: number;
  labor_high_usd: number;
  permit_low_usd: number;
  permit_high_usd: number;
  invoice_hourly_usd: HourlyBand;
  golden_demo_case_id: string;
  golden_demo_match: GoldenDemoMatch;
  demo_published_fair_low_usd: number;
  demo_published_fair_high_usd: number;
  demo_published_range_differs: boolean;
}

export function runKnowledgeBackedLocalAudit(request: KnowledgeLocalAuditRequest): KnowledgeLocalAudit {
  const trade = normalizeTradeKey(request.tradeCategory);
  if (!trade) throw new Error(`Unknown trade category: ${request.tradeCategory}`);

  const blueprint = chooseBlueprint(trade, request.blueprintId);
  const tierName = request.tier ?? DEFAULT_BLUEPRINT_TIER;
  const tier = blueprint.design_tiers[tierName];
  const location = resolvePricingLocation(request.zipCode, trade);
  const invoice = location.invoice_hourly;
  const allocation = blueprint.standard_labor_allocation;
  const wholesale = normalizeToRange([tier.wholesale_bom_low_usd, tier.wholesale_bom_high_usd]);
  const permitBase = normalizeToRange(allocation.typical_permit_and_inspection_usd);

  // Wholesale BOM and installed_fair_national_* are national catalog figures.
  // HANDOFF prices equipment as wholesale × 1.35. BATCH1 (linked from HANDOFF)
  // defines material_multiplier_vs_national against national_baseline 1.0, so
  // the metro material index scales that national equipment price. Labor uses
  // the metro invoice hourly and is not scaled again. overall_install_cost_index
  // is not applied on top of those two adjustments.
  const equipmentLow = roundUsd(wholesale.low * FAIR_EQUIPMENT_MARKUP * location.material_multiplier);
  const equipmentHigh = roundUsd(wholesale.high * FAIR_EQUIPMENT_MARKUP * location.material_multiplier);

  // Hour range × the central invoice rate (burdened mid × 1.25). Low/high
  // invoice rates stay on invoice_hourly_usd. Stacking percentile wages on
  // the hour range and then on [0.92, 1.12] would triple-count spread.
  const laborLow = roundUsd(allocation.crew_size * allocation.hours_low * invoice.mid);
  const laborHigh = roundUsd(allocation.crew_size * allocation.hours_high * invoice.mid);
  const permitLow = roundUsd(permitBase.low * location.permit_multiplier);
  const permitHigh = roundUsd(permitBase.high * location.permit_multiplier);

  let fairLow = roundUsd((equipmentLow + laborLow + permitLow) * FAIR_TOTAL_LOW_FACTOR);
  let fairHigh = roundUsd((equipmentHigh + laborHigh + permitHigh) * FAIR_TOTAL_HIGH_FACTOR);
  if (fairLow > fairHigh) {
    const swap = fairLow;
    fairLow = fairHigh;
    fairHigh = swap;
  }

  const contractor = positiveUsd(request.contractorTotalUsd);
  const aboveCeiling = contractor > fairHigh;
  const redFlags = aboveCeiling ? flagsFromTraps(blueprint) : [];
  const missing = missingClauses(blueprint.mandatory_contract_clauses, request.visibleClauses);
  const savings = aboveCeiling ? roundUsd(contractor - fairHigh) : 0;
  const savingsLow = savings > 0 ? roundUsd(savings * 0.75) : 0;
  const savingsHigh = savings > 0 ? Math.max(savings, roundUsd(savings * 1.1)) : 0;
  const gapAboveFloor = contractor > 0 ? roundUsd(Math.max(0, contractor - fairLow)) : 0;
  const highCount = redFlags.filter((flag) => flag.severity === "HIGH").length;
  const mediumCount = redFlags.filter((flag) => flag.severity === "MEDIUM").length;
  const demo = selectBestGoldenDemo(request.zipCode, trade);
  const published = normalizeToRange(demo.case.verified_fair_range_usd);
  const publishedDiffers = Math.round(published.low) !== fairLow || Math.round(published.high) !== fairHigh;
  const appTrade = toAppTradeId(trade);
  const label = tradeLabel(appTrade);
  const zipCode = location.zip5 ?? request.zipCode.trim();
  const scripts = negotiationCopy({
    tradeLabel: label,
    zip: zipCode,
    metro: location.metro_name,
    contractor,
    itemName: blueprint.project_title,
    fairLow,
    fairHigh,
    savingsLow,
    savingsHigh,
    savings,
    questions: redFlags.map((flag) => flag.what_to_ask),
    missing,
  });

  return {
    contractor_total_usd: contractor,
    fair_price_low_usd: fairLow,
    fair_price_high_usd: fairHigh,
    estimated_savings_usd: savings,
    savings_low_usd: savingsLow,
    savings_high_usd: savingsHigh,
    gap_above_ceiling_usd: savings,
    gap_above_floor_usd: gapAboveFloor,
    risk_score: scoreRisk(highCount, mediumCount, contractor, fairHigh),
    red_flags: redFlags,
    missing_protections: missing,
    line_items_breakdown: lineItems({
      title: blueprint.project_title,
      contractor,
      fairLow,
      fairHigh,
      equipmentLow,
      equipmentHigh,
      laborLow,
      laborHigh,
      permitLow,
      permitHigh,
      evidence: location.permit_evidence_level,
    }),
    negotiation_script_email: scripts.email,
    negotiation_script_sms: scripts.sms,
    benchmark_id: blueprint.blueprint_id,
    metro_name: location.metro_name,
    band_note: bandNote({
      fairLow,
      fairHigh,
      blueprintId: blueprint.blueprint_id,
      tier: tierName,
      metroName: location.metro_name,
      equipmentLow,
      equipmentHigh,
      material: location.material_multiplier,
      laborLow,
      laborHigh,
      crew: allocation.crew_size,
      hoursLow: allocation.hours_low,
      hoursHigh: allocation.hours_high,
      invoiceMid: invoice.mid,
      burdenedMid: location.burdened_hourly.mid,
      permitLow,
      permitHigh,
      permitMultiplier: location.permit_multiplier,
      evidence: location.permit_evidence_level,
      caseId: demo.case.case_id,
      publishedLow: published.low,
      publishedHigh: published.high,
      publishedDiffers,
    }),
    inference_tier: 0,
    model: null,
    zip_code: zipCode,
    trade_category: appTrade,
    tier: tierName,
    metro_id: location.metro_id,
    pricing_source: location.source,
    permit_evidence_level: location.permit_evidence_level,
    material_multiplier: location.material_multiplier,
    permit_multiplier: location.permit_multiplier,
    equipment_low_usd: equipmentLow,
    equipment_high_usd: equipmentHigh,
    labor_low_usd: laborLow,
    labor_high_usd: laborHigh,
    permit_low_usd: permitLow,
    permit_high_usd: permitHigh,
    invoice_hourly_usd: invoice,
    golden_demo_case_id: demo.case.case_id,
    golden_demo_match: demo.match,
    demo_published_fair_low_usd: published.low,
    demo_published_fair_high_usd: published.high,
    demo_published_range_differs: publishedDiffers,
  };
}

function chooseBlueprint(trade: KnowledgeTrade, blueprintId: string | undefined): Blueprint {
  if (!blueprintId) {
    const found = defaultBlueprintForTrade(trade);
    if (!found) throw new Error(`No blueprint for ${trade}`);
    return found;
  }
  const found = lookupBlueprintById(blueprintId);
  if (!found) throw new Error(`Unknown blueprint ${blueprintId}`);
  if (normalizeTradeKey(found.trade_category) !== trade) {
    throw new Error(`Blueprint ${blueprintId} is not a ${trade} blueprint`);
  }
  return found;
}

function flagsFromTraps(blueprint: Blueprint): RedFlag[] {
  return blueprint.common_contractor_padding_traps.map((trap) => {
    const quoted = roundUsd(trap.typical_contractor_charge_usd);
    const fair = roundUsd(trap.fair_installed_addon_usd);
    const over = Math.max(0, roundUsd(quoted - fair));
    return {
      title: trap.trap_name,
      severity: over > 0 ? "HIGH" : "MEDIUM",
      quoted_amount_usd: quoted,
      fair_benchmark_usd: fair,
      potential_overcharge_usd: over,
      insider_explanation: `${trap.trap_name} is often billed near ${formatUsd(quoted)} against a fair installed add-on of ${formatUsd(fair)} (${trap.evidence_level}). ${trap.source_note}`,
      what_to_ask: `Please remove "${trap.trap_name}" or reprice it near ${formatUsd(fair)} and show the model or quantity.`,
    };
  });
}

function missingClauses(required: readonly string[], visible: string[] | undefined): string[] {
  if (!visible || visible.length === 0) return [...required];
  const haystack = visible.join("\n").toLowerCase();
  return required.filter((clause) => !haystack.includes(clause.toLowerCase()));
}

function lineItems(input: {
  title: string;
  contractor: number;
  fairLow: number;
  fairHigh: number;
  equipmentLow: number;
  equipmentHigh: number;
  laborLow: number;
  laborHigh: number;
  permitLow: number;
  permitHigh: number;
  evidence: string;
}): LineItemBreakdown[] {
  const lines: LineItemBreakdown[] = [];
  if (input.contractor > 0) {
    lines.push({
      description: `${input.title} (contractor total)`,
      quoted_usd: input.contractor,
      fair_low_usd: input.fairLow,
      fair_high_usd: input.fairHigh,
      note: "Contractor total compared with the calibrated fair band.",
    });
  }
  lines.push(
    {
      description: `${input.title} equipment`,
      quoted_usd: 0,
      fair_low_usd: input.equipmentLow,
      fair_high_usd: input.equipmentHigh,
      note: "Wholesale BOM × 1.35 × the metro material multiplier.",
    },
    {
      description: "Install labor",
      quoted_usd: 0,
      fair_low_usd: input.laborLow,
      fair_high_usd: input.laborHigh,
      note: "Crew size × blueprint hours × the calibrated homeowner invoice hourly.",
    },
    {
      description: "Permit and inspection",
      quoted_usd: 0,
      fair_low_usd: input.permitLow,
      fair_high_usd: input.permitHigh,
      note: `Blueprint permit range × the metro permit multiplier (${input.evidence}).`,
    },
  );
  return lines;
}

function bandNote(input: {
  fairLow: number;
  fairHigh: number;
  blueprintId: string;
  tier: string;
  metroName: string;
  equipmentLow: number;
  equipmentHigh: number;
  material: number;
  laborLow: number;
  laborHigh: number;
  crew: number;
  hoursLow: number;
  hoursHigh: number;
  invoiceMid: number;
  burdenedMid: number;
  permitLow: number;
  permitHigh: number;
  permitMultiplier: number;
  evidence: string;
  caseId: string;
  publishedLow: number;
  publishedHigh: number;
  publishedDiffers: boolean;
}): string {
  const formula = `Fair band ${formatUsd(input.fairLow)}–${formatUsd(input.fairHigh)} for ${input.blueprintId} (${input.tier}) in ${input.metroName}. Equipment ${formatUsd(input.equipmentLow)}–${formatUsd(input.equipmentHigh)} = wholesale BOM × 1.35 × material ${input.material}. Labor ${formatUsd(input.laborLow)}–${formatUsd(input.laborHigh)} = crew ${input.crew} × ${input.hoursLow}–${input.hoursHigh} h × ${formatRate(input.invoiceMid)} invoice hourly (burdened mid ${formatRate(input.burdenedMid)} × ${BURDENED_TO_INVOICE_HOURLY}). Permit ${formatUsd(input.permitLow)}–${formatUsd(input.permitHigh)} = blueprint permit × permit multiplier ${input.permitMultiplier} (${input.evidence}). Total × [0.92, 1.12].`;
  if (!input.publishedDiffers) return formula;
  return `${formula} Golden demo ${input.caseId} publishes ${formatUsd(input.publishedLow)}–${formatUsd(input.publishedHigh)}. That narrative range is not the price source.`;
}

function negotiationCopy(input: {
  tradeLabel: string;
  zip: string;
  metro: string;
  contractor: number;
  itemName: string;
  fairLow: number;
  fairHigh: number;
  savingsLow: number;
  savingsHigh: number;
  savings: number;
  questions: string[];
  missing: string[];
}): { email: string; sms: string } {
  const questions = input.questions.length
    ? input.questions.map((question) => `- ${question}`).join("\n")
    : "- Please itemize equipment model numbers and labor hours.";
  const missing = input.missing.length
    ? input.missing.map((clause) => `- ${clause}`).join("\n")
    : "- Please confirm permit, warranty, and scope in writing.";
  if (input.contractor > 0 && input.savings > 0) {
    const fields = {
      tradeLabel: input.tradeLabel,
      zip: input.zip,
      metro: input.metro,
      total: formatUsd(input.contractor),
      itemName: input.itemName,
      savingsLow: formatUsd(input.savingsLow),
      savingsHigh: formatUsd(input.savingsHigh),
      questions,
      missing,
      fairLow: formatUsd(input.fairLow),
      fairHigh: formatUsd(input.fairHigh),
      flagged: formatUsd(input.savings),
    };
    return {
      email: activeVertical.negotiation.email(fields),
      sms: activeVertical.negotiation.sms(fields),
    };
  }
  if (input.contractor > 0) {
    return {
      email: [
        `Subject: Please confirm the ${input.tradeLabel} quote for ${input.zip}`,
        "",
        "Hello,",
        "",
        `Thank you for the quote of ${formatUsd(input.contractor)} for our home in ${input.metro} (${input.zip}). Quote Shield AI places a fair installed range for a ${input.itemName} at ${formatUsd(input.fairLow)} to ${formatUsd(input.fairHigh)}.`,
        "",
        "Please send a revised, itemized quote that:",
        questions,
        "",
        "Protections to add in writing:",
        missing,
        "",
        "Thank you",
        "A homeowner, with help from Quote Shield AI",
      ].join("\n"),
      sms: `Hi — thanks for the ${formatUsd(input.contractor)} ${input.tradeLabel} quote for ${input.zip}. Quote Shield AI places a fair range at ${formatUsd(input.fairLow)} to ${formatUsd(input.fairHigh)}. Please split labor hours from equipment and put the missing protections in writing.`,
    };
  }
  return {
    email: [
      `Subject: Please itemize the ${input.tradeLabel} quote for ${input.zip}`,
      "",
      "Hello,",
      "",
      `Quote Shield AI priced a ${input.itemName} in ${input.metro} (${input.zip}) from regional benchmarks. A fair installed range for this scope is ${formatUsd(input.fairLow)} to ${formatUsd(input.fairHigh)}.`,
      "",
      "Please send an itemized quote that:",
      questions,
      "",
      "Protections to add in writing:",
      missing,
      "",
      "Thank you",
      "A homeowner, with help from Quote Shield AI",
    ].join("\n"),
    sms: `Hi — Quote Shield AI puts a fair ${input.tradeLabel} range for ${input.zip} at ${formatUsd(input.fairLow)} to ${formatUsd(input.fairHigh)}. Please split labor hours from equipment and put permit and warranty terms in writing before I compare a total.`,
  };
}

function positiveUsd(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return roundUsd(value);
}

function roundUsd(value: number): number {
  return Math.round(value);
}

function formatRate(value: number): string {
  const cents = Math.round(value * 100) / 100;
  if (Number.isInteger(cents)) return formatUsd(cents);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents);
}
