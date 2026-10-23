/**
 * Quote Shield AI one-shot ground truth.
 *
 * Same calibration as src/knowledge/knowledgeAdapter.ts and src/engines/quoteShieldCore.ts.
 * This file loads the JSON pack with import attributes so the Deno edge function
 * can read it. quoteShieldCore.ts imports those modules without extensions, which
 * Deno will not resolve, and it is not imported here.
 *
 * Homeowner invoice hourly = burdened hourly × 1.25.
 * Do not multiply burden_multiplier_vs_bls_wage or a labor index again.
 * Blueprint tier is `better`. smarthome and smart_home are the same trade.
 * Fair equipment = wholesale BOM × 1.35 × material multiplier.
 * Fair labor = crew × hours × calibrated mid invoice hourly.
 * Permit = blueprint permit range × permit multiplier, keeping evidence_level.
 * Fair total = (equipment + labor + permit) × [0.92, 1.12].
 */
import {
  ABSURD_DRIFT,
  reconcileModelNumbers,
  validateModelAudit,
  type BuiltAudit,
  type FairBand,
  type ReconcileFlagInput,
} from "../../../../src/engine/auditEngine.ts";
import tradeBlueprintCatalog from "../../../../src/knowledge/raw/trade_reference_blueprints_2026.json" with { type: "json" };
import zipCostMatrix from "../../../../src/knowledge/raw/us_zip_cost_matrix_2026.json" with { type: "json" };

/** burdened / (1 - 0.20). Matches knowledgeAdapter BURDENED_TO_INVOICE_HOURLY. */
export const BURDENED_TO_INVOICE_HOURLY = 1 / (1 - 0.2);
export const FAIR_EQUIPMENT_MARKUP = 1.35;
export const FAIR_TOTAL_LOW_FACTOR = 0.92;
export const FAIR_TOTAL_HIGH_FACTOR = 1.12;

export type KnowledgeTrade = "hvac" | "electrical" | "plumbing" | "roofing" | "smart_home";

export interface HourlyBand {
  low: number;
  mid: number;
  high: number;
}

export interface GroundTruthTrap {
  name: string;
  typicalChargeUsd: number;
  fairAddonUsd: number;
  evidenceLevel: string;
}

export interface GroundTruth {
  zipCode: string;
  trade: KnowledgeTrade;
  metroName: string;
  metroId: string;
  blueprintId: string;
  projectTitle: string;
  tier: "better";
  invoiceHourly: HourlyBand;
  burdenedHourly: HourlyBand;
  materialMultiplier: number;
  permitMultiplier: number;
  permitEvidenceLevel: string;
  wholesaleLow: number;
  wholesaleHigh: number;
  crew: number;
  hoursLow: number;
  hoursHigh: number;
  permitBaseLow: number;
  permitBaseHigh: number;
  equipmentLow: number;
  equipmentHigh: number;
  laborLow: number;
  laborHigh: number;
  permitLow: number;
  permitHigh: number;
  fairLow: number;
  fairHigh: number;
  clauses: string[];
  traps: GroundTruthTrap[];
}

interface HourlyJson {
  low: number;
  mid: number;
  high: number;
}

interface ZipMetroJson {
  metro_id: string;
  metro_name: string;
  state: string;
  primary_zip3_prefixes: string[];
  labor: {
    electrician_burdened_hourly_usd: HourlyJson;
    hvac_tech_burdened_hourly_usd: HourlyJson;
    plumber_burdened_hourly_usd: HourlyJson;
    roofer_burdened_hourly_usd: HourlyJson;
    low_voltage_tech_burdened_hourly_usd: HourlyJson;
  };
  cost_indices: {
    material_multiplier_vs_national: number;
    permit_fee_multiplier_vs_national: number;
    national_baseline: number;
  };
  permits: {
    evidence_level: string;
  };
}

interface BlueprintJson {
  blueprint_id: string;
  trade_category: string;
  project_title: string;
  design_tiers: {
    better?: {
      wholesale_bom_low_usd: number;
      wholesale_bom_high_usd: number;
    };
  };
  standard_labor_allocation: {
    crew_size: number;
    hours_low: number;
    hours_high: number;
    typical_permit_and_inspection_usd: [number, number];
  };
  common_contractor_padding_traps: {
    trap_name: string;
    typical_contractor_charge_usd: number;
    fair_installed_addon_usd: number;
    evidence_level: string;
  }[];
  mandatory_contract_clauses: string[];
}

const LABOR_FIELD = {
  hvac: "hvac_tech_burdened_hourly_usd",
  electrical: "electrician_burdened_hourly_usd",
  plumbing: "plumber_burdened_hourly_usd",
  roofing: "roofer_burdened_hourly_usd",
  smart_home: "low_voltage_tech_burdened_hourly_usd",
} as const;

const metros = (zipCostMatrix as { metros: ZipMetroJson[] }).metros;
const blueprints = (tradeBlueprintCatalog as { blueprints: BlueprintJson[] }).blueprints;

export function normalizeTradeKey(tradeCategory: string): KnowledgeTrade | null {
  const compact = tradeCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (compact === "hvac") return "hvac";
  if (compact === "electrical" || compact === "electric") return "electrical";
  if (compact === "plumbing" || compact === "plumber") return "plumbing";
  if (compact === "roofing" || compact === "roof") return "roofing";
  if (compact === "smarthome" || compact === "lowvoltage") return "smart_home";
  return null;
}

export function resolveGroundTruth(zipCode: string, tradeCategory: string): GroundTruth | null {
  const trade = normalizeTradeKey(tradeCategory);
  if (!trade) return null;
  const blueprint = blueprints.find((item) => item.trade_category === trade);
  const tier = blueprint?.design_tiers.better;
  if (!blueprint || !tier) return null;

  const zip5 = parseZip5(zipCode);
  const metro = zip5 ? metros.find((item) => item.primary_zip3_prefixes.includes(zip5.slice(0, 3))) : undefined;
  const burdened = metro ? metro.labor[LABOR_FIELD[trade]] : nationalBurdened(trade);
  const invoice = calibrate(burdened);
  const material = metro ? metro.cost_indices.material_multiplier_vs_national : nationalBaseline();
  const permitMultiplier = metro ? metro.cost_indices.permit_fee_multiplier_vs_national : nationalBaseline();
  const permitBase = ordered(blueprint.standard_labor_allocation.typical_permit_and_inspection_usd[0], blueprint.standard_labor_allocation.typical_permit_and_inspection_usd[1]);
  const wholesale = ordered(tier.wholesale_bom_low_usd, tier.wholesale_bom_high_usd);
  const crew = blueprint.standard_labor_allocation.crew_size;
  const hoursLow = blueprint.standard_labor_allocation.hours_low;
  const hoursHigh = blueprint.standard_labor_allocation.hours_high;

  const equipmentLow = roundUsd(wholesale.low * FAIR_EQUIPMENT_MARKUP * material);
  const equipmentHigh = roundUsd(wholesale.high * FAIR_EQUIPMENT_MARKUP * material);
  const laborLow = roundUsd(crew * hoursLow * invoice.mid);
  const laborHigh = roundUsd(crew * hoursHigh * invoice.mid);
  const permitLow = roundUsd(permitBase.low * permitMultiplier);
  const permitHigh = roundUsd(permitBase.high * permitMultiplier);
  let fairLow = roundUsd((equipmentLow + laborLow + permitLow) * FAIR_TOTAL_LOW_FACTOR);
  let fairHigh = roundUsd((equipmentHigh + laborHigh + permitHigh) * FAIR_TOTAL_HIGH_FACTOR);
  if (fairLow > fairHigh) {
    const swap = fairLow;
    fairLow = fairHigh;
    fairHigh = swap;
  }

  return {
    zipCode: zip5 ?? zipCode.trim(),
    trade,
    metroName: metro?.metro_name ?? "US National Baseline",
    metroId: metro?.metro_id ?? "national_baseline",
    blueprintId: blueprint.blueprint_id,
    projectTitle: blueprint.project_title,
    tier: "better",
    invoiceHourly: invoice,
    burdenedHourly: { low: burdened.low, mid: burdened.mid, high: burdened.high },
    materialMultiplier: material,
    permitMultiplier,
    permitEvidenceLevel: metro?.permits.evidence_level ?? "national_baseline",
    wholesaleLow: wholesale.low,
    wholesaleHigh: wholesale.high,
    crew,
    hoursLow,
    hoursHigh,
    permitBaseLow: permitBase.low,
    permitBaseHigh: permitBase.high,
    equipmentLow,
    equipmentHigh,
    laborLow,
    laborHigh,
    permitLow,
    permitHigh,
    fairLow,
    fairHigh,
    clauses: [...blueprint.mandatory_contract_clauses],
    traps: blueprint.common_contractor_padding_traps.map((trap) => ({
      name: trap.trap_name,
      typicalChargeUsd: trap.typical_contractor_charge_usd,
      fairAddonUsd: trap.fair_installed_addon_usd,
      evidenceLevel: trap.evidence_level,
    })),
  };
}

/**
 * Hard numbers for the one vision call. These figures are the only price authority.
 */
export function buildGroundTruthPrompt(truth: GroundTruth): string {
  const hourly = truth.invoiceHourly;
  const burdened = truth.burdenedHourly;
  const traps = truth.traps.length
    ? truth.traps
        .map(
          (trap) =>
            `- ${trap.name} (typical contractor charge ${trap.typicalChargeUsd} USD, fair installed add-on ${trap.fairAddonUsd} USD, evidence_level ${trap.evidenceLevel})`,
        )
        .join("\n")
    : "- None listed on this blueprint.";
  const clauses = truth.clauses.map((clause) => `- ${clause}`).join("\n");
  return [
    "You are the one-shot auditor inside Quote Shield AI, a US homeowner contractor-quote auditor.",
    "Quote Shield AI knowledge-pack numbers below are the only price authority. Do not invent regional labor rates, material multipliers, wholesale prices, permit fees, or fair-price totals.",
    `Metro: ${truth.metroName}. ZIP: ${truth.zipCode}. Trade: ${truth.trade}. Blueprint id: ${truth.blueprintId}. Tier: ${truth.tier}. Project: ${truth.projectTitle}.`,
    `Five-trade invoice hourly band for ${truth.trade}: low ${plain(hourly.low)}, mid ${plain(hourly.mid)}, high ${plain(hourly.high)} USD per hour. Homeowner invoice hourly = burdened hourly × ${plain(BURDENED_TO_INVOICE_HOURLY)} (burdened low ${plain(burdened.low)}, mid ${plain(burdened.mid)}, high ${plain(burdened.high)}). Do not multiply burden_multiplier_vs_bls_wage or any labor index again.`,
    `Material multiplier: ${plain(truth.materialMultiplier)}. Permit multiplier: ${plain(truth.permitMultiplier)}. Permit evidence_level: ${truth.permitEvidenceLevel}.`,
    `Better-tier wholesale BOM: low ${truth.wholesaleLow} USD, high ${truth.wholesaleHigh} USD. Crew: ${truth.crew}. Hours: ${truth.hoursLow} to ${truth.hoursHigh}.`,
    `Fair equipment = wholesale BOM × ${plain(FAIR_EQUIPMENT_MARKUP)} × material multiplier = ${truth.equipmentLow} to ${truth.equipmentHigh} USD.`,
    `Fair labor = crew × hours × calibrated mid invoice hourly ${plain(hourly.mid)} = ${truth.laborLow} to ${truth.laborHigh} USD.`,
    `Permit = blueprint permit range ${truth.permitBaseLow} to ${truth.permitBaseHigh} × permit multiplier ${plain(truth.permitMultiplier)} = ${truth.permitLow} to ${truth.permitHigh} USD. Keep evidence_level ${truth.permitEvidenceLevel}.`,
    `Fair total = (equipment + labor + permit) × [${plain(FAIR_TOTAL_LOW_FACTOR)}, ${plain(FAIR_TOTAL_HIGH_FACTOR)}] = ${truth.fairLow} to ${truth.fairHigh} USD. Set fair_price_low_usd to ${truth.fairLow} and fair_price_high_usd to ${truth.fairHigh}.`,
    `Mandatory clauses:\n${clauses}`,
    `Common 2026 padding traps on blueprint ${truth.blueprintId}. Flag a trap only when the quote shows it. Use these names:\n${traps}`,
    "Return one JSON object and stop. This is the only model call. Include line-item pricing (line_items_breakdown), trap flags (red_flags, severity HIGH or MEDIUM, at least one flag), missing_protections, contractor_total_usd, fair_price_low_usd, fair_price_high_usd, estimated_savings_usd, risk_score, negotiation_script_email, and negotiation_script_sms. Read dollar amounts from the quote image. Do not invent a second regional rate.",
  ].join("\n\n");
}

export function groundTruthFairBand(truth: GroundTruth): FairBand {
  return {
    equipmentLow: truth.equipmentLow,
    equipmentHigh: truth.equipmentHigh,
    laborLow: truth.laborLow,
    laborHigh: truth.laborHigh,
    fairLow: truth.fairLow,
    fairHigh: truth.fairHigh,
    materialMultiplier: truth.materialMultiplier,
    laborMultiplier: 1,
    hourlyLow: truth.invoiceHourly.low,
    hourlyHigh: truth.invoiceHourly.high,
    markupPct: 35,
  };
}

/**
 * Keeps the model's line items, trap flags, and negotiation email.
 * fair_price_low_usd / fair_price_high_usd are clamped to the knowledge formula
 * when they sit more than 15% away, via reconcileModelNumbers.
 */
export function clampModelAuditToGroundTruth(input: {
  audit: Record<string, unknown>;
  truth: GroundTruth;
  modelName: string;
}): BuiltAudit | null {
  const validated = validateModelAudit(input.audit);
  if (!validated.ok) return null;
  const row = validated.audit;
  const flags = (row.red_flags as Record<string, unknown>[]).map((flag) => ({
    title: String(flag.title),
    severity: flag.severity as ReconcileFlagInput["severity"],
    quoted_amount_usd: Number(flag.quoted_amount_usd),
    fair_benchmark_usd: Number(flag.fair_benchmark_usd),
    potential_overcharge_usd: Number(flag.potential_overcharge_usd),
    insider_explanation: String(flag.insider_explanation),
    what_to_ask: String(flag.what_to_ask),
  }));
  const reconciled = reconcileModelNumbers({
    contractorTotal: Number(row.contractor_total_usd),
    modelFairLow: Number(row.fair_price_low_usd),
    modelFairHigh: Number(row.fair_price_high_usd),
    modelSavings: Number(row.estimated_savings_usd),
    band: groundTruthFairBand(input.truth),
    flags,
  });
  const repairedFlags = reconciled.flags.map((flag, index) => {
    const trap = matchTrap(input.truth, flag.title);
    if (!trap) return flag;
    const fair = clampToAuthority(flags[index]?.fair_benchmark_usd ?? flag.fair_benchmark_usd, trap.fairAddonUsd);
    const quoted = Math.round(flag.quoted_amount_usd);
    const over = Math.min(quoted, Math.max(0, Math.round(quoted - fair)));
    return {
      ...flag,
      fair_benchmark_usd: fair,
      potential_overcharge_usd: over,
    };
  });
  const savingsLow = Math.max(0, Math.round(reconciled.savings * 0.75));
  const savingsHigh = Math.max(reconciled.savings, Math.round(reconciled.savings * 1.1));
  const lines = Array.isArray(row.line_items_breakdown)
    ? (row.line_items_breakdown as Record<string, unknown>[]).map((line) => ({
        description: String(line.description ?? "Line"),
        quoted_usd: Number(line.quoted_usd ?? line.amount_usd ?? 0),
        fair_low_usd: typeof line.fair_low_usd === "number" ? line.fair_low_usd : null,
        fair_high_usd: typeof line.fair_high_usd === "number" ? line.fair_high_usd : null,
        note: typeof line.note === "string" ? line.note : "From the quote image.",
      }))
    : [];
  const built: BuiltAudit = {
    contractor_total_usd: Number(row.contractor_total_usd),
    fair_price_low_usd: reconciled.fairLow,
    fair_price_high_usd: reconciled.fairHigh,
    estimated_savings_usd: reconciled.savings,
    savings_low_usd: savingsLow,
    savings_high_usd: savingsHigh,
    gap_above_ceiling_usd: reconciled.gapLow,
    gap_above_floor_usd: reconciled.gapHigh,
    risk_score: Math.max(0, Math.min(100, Math.round(Number(row.risk_score)))),
    red_flags: repairedFlags,
    missing_protections: row.missing_protections as string[],
    line_items_breakdown: lines,
    negotiation_script_email: String(row.negotiation_script_email),
    negotiation_script_sms: String(row.negotiation_script_sms),
    benchmark_id: input.truth.blueprintId,
    metro_name: input.truth.metroName,
    band_note: `Quote Shield AI knowledge formula for ${input.truth.blueprintId} (${input.truth.tier}) in ${input.truth.metroName}: fair band ${reconciled.fairLow}–${reconciled.fairHigh} USD. Prices more than ${Math.round(ABSURD_DRIFT * 100)}% off that band were replaced with the formula.`,
    inference_tier: 2,
    model: input.modelName,
  };
  if (!(built.contractor_total_usd > 0)) return null;
  if (built.fair_price_low_usd > built.fair_price_high_usd) return null;
  if (built.risk_score < 0 || built.risk_score > 100) return null;
  return built;
}

function matchTrap(truth: GroundTruth, title: string): GroundTruthTrap | undefined {
  const needle = title.trim().toLowerCase();
  return truth.traps.find((trap) => {
    const name = trap.name.toLowerCase();
    return needle === name || needle.includes(name) || name.includes(needle);
  });
}

function clampToAuthority(model: number, authority: number): number {
  if (!Number.isFinite(model) || !Number.isFinite(authority)) return roundUsd(authority);
  const delta = Math.abs(authority) * ABSURD_DRIFT;
  if (model >= authority - delta && model <= authority + delta) return roundUsd(model);
  return roundUsd(authority);
}

function calibrate(burdened: HourlyBand): HourlyBand {
  return {
    low: burdened.low * BURDENED_TO_INVOICE_HOURLY,
    mid: burdened.mid * BURDENED_TO_INVOICE_HOURLY,
    high: burdened.high * BURDENED_TO_INVOICE_HOURLY,
  };
}

function nationalBaseline(): number {
  return metros[0].cost_indices.national_baseline;
}

function nationalBurdened(trade: KnowledgeTrade): HourlyBand {
  const field = LABOR_FIELD[trade];
  const rows = metros.map((metro) => metro.labor[field]);
  return {
    low: mean(rows.map((row) => row.low)),
    mid: mean(rows.map((row) => row.mid)),
    high: mean(rows.map((row) => row.high)),
  };
}

function parseZip5(input: string): string | null {
  const match = String(input ?? "").match(/\d{5}/);
  return match ? match[0] : null;
}

function ordered(low: number, high: number): { low: number; high: number } {
  return low <= high ? { low, high } : { low: high, high: low };
}

function roundUsd(value: number): number {
  return Math.round(value);
}

function plain(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function mean(values: number[]): number {
  if (values.length === 0) throw new Error("Cannot average an empty labor sample");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
