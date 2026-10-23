/**
 * Quote Shield AI price engine.
 * Imported by the Expo app and by supabase/functions/_shared/inference/router.ts.
 * Do not import React Native or a model provider here.
 *
 * Tier 0 formula (the price source of truth):
 *   equipment = wholesale × material_multiplier × (1 + reasonable_markup_pct/100)
 *   labor     = benchmark hours × the ZIP typical hourly rate
 *   fair band = equipment + labor
 * typical_hourly_rate_* is already the regional rate. Do not multiply labor by
 * labor_multiplier again. labor_multiplier is context for the prompt only.
 *
 * CLAMP RULE
 * Tier 0 is authoritative. ABSURD_DRIFT is 15%.
 * - Keep a model fair_price_low_usd only when it sits within ±15% of Tier 0 fairLow.
 *   Otherwise replace it with Tier 0 fairLow. Same rule for fair_price_high_usd
 *   against Tier 0 fairHigh. If the ends cross, sort them.
 * - A labor-flag fair_benchmark_usd is kept only within ±15% of the Tier 0 labor
 *   ceiling (laborHigh). Otherwise it becomes laborHigh.
 * - An equipment-flag fair_benchmark_usd uses the same ±15% window around
 *   equipmentHigh.
 * - An "included item" flag (permit, warranty, refrigerant recovery) has authority 0.
 *   A model fair_benchmark_usd above ABSURD_INCLUDED_USD ($250) is replaced with 0.
 * - potential_overcharge_usd is recomputed as max(0, quoted − fair_benchmark)
 *   and cannot exceed the quoted amount.
 * - estimated_savings_usd must fall between
 *   min(flagSum, gapAboveCeiling) × 0.85 and max(flagSum, gapAboveFloor) × 1.15.
 *   Outside that window it is replaced with the gap above the fair ceiling
 *   (contractor total − fairHigh). A $0 savings figure is also replaced with that
 *   gap when the quote is above the ceiling and no flag dollars were found.
 *   This stops a model from inventing a $50 or $50,000 savings number while still
 *   allowing the flagged-line total, which can be smaller than the full wholesale gap.
 */

export const ABSURD_DRIFT = 0.15;
export const ABSURD_INCLUDED_USD = 250;
export const LOW_CONFIDENCE = 0.65;

export interface ZipMultiplier {
  zipPrefix: string;
  stateCode: string;
  metroName: string;
  laborMultiplier: number;
  materialMultiplier: number;
  hourlyLow: number;
  hourlyHigh: number;
}

export interface Benchmark {
  id: string;
  tradeCategory: string;
  itemName: string;
  wholesaleLow: number;
  wholesaleHigh: number;
  laborHoursLow: number;
  laborHoursHigh: number;
  reasonableMarkupPct: number;
  mandatoryClauses: string[];
}

export interface FairBand {
  equipmentLow: number;
  equipmentHigh: number;
  laborLow: number;
  laborHigh: number;
  fairLow: number;
  fairHigh: number;
  materialMultiplier: number;
  laborMultiplier: number;
  hourlyLow: number;
  hourlyHigh: number;
  markupPct: number;
}

export interface QuoteExtract {
  contractor_total_usd: number;
  line_items: { description: string; amount_usd: number }[];
  visible_clauses: string[];
  confidence: number;
  image_unreadable: boolean;
}

export interface NegotiationFields {
  tradeLabel: string;
  zip: string;
  metro: string;
  total: string;
  itemName: string;
  savingsLow: string;
  savingsHigh: string;
  questions: string;
  missing: string;
  fairLow: string;
  fairHigh: string;
  flagged: string;
}

export interface NegotiationCopy {
  email: (input: NegotiationFields) => string;
  sms: (input: NegotiationFields) => string;
}

export type FlagKind = "labor" | "equipment" | "included";
export type Severity = "HIGH" | "MEDIUM";

export interface PublicRedFlag {
  title: string;
  severity: Severity;
  quoted_amount_usd: number;
  fair_benchmark_usd: number;
  potential_overcharge_usd: number;
  insider_explanation: string;
  what_to_ask: string;
}

export interface BuiltLine {
  description: string;
  quoted_usd: number;
  fair_low_usd: number | null;
  fair_high_usd: number | null;
  note: string;
}

export interface BuiltAudit {
  contractor_total_usd: number;
  fair_price_low_usd: number;
  fair_price_high_usd: number;
  estimated_savings_usd: number;
  savings_low_usd: number;
  savings_high_usd: number;
  gap_above_ceiling_usd: number;
  gap_above_floor_usd: number;
  risk_score: number;
  red_flags: PublicRedFlag[];
  missing_protections: string[];
  line_items_breakdown: BuiltLine[];
  negotiation_script_email: string;
  negotiation_script_sms: string;
  benchmark_id: string;
  metro_name: string;
  band_note: string;
  inference_tier: 0 | 1 | 2;
  model: string | null;
}

/** Offline mirror of supabase/migrations/0001_quote_shield_ai_init.sql. Keep the numbers in sync. */
export const REFERENCE_ZIPS: ZipMultiplier[] = [
  { zipPrefix: "900", stateCode: "CA", metroName: "Los Angeles Metro", laborMultiplier: 1.35, materialMultiplier: 1.1, hourlyLow: 125, hourlyHigh: 185 },
  { zipPrefix: "941", stateCode: "CA", metroName: "San Francisco Bay Area", laborMultiplier: 1.5, materialMultiplier: 1.15, hourlyLow: 145, hourlyHigh: 220 },
  { zipPrefix: "100", stateCode: "NY", metroName: "New York City Metro", laborMultiplier: 1.45, materialMultiplier: 1.12, hourlyLow: 140, hourlyHigh: 210 },
  { zipPrefix: "750", stateCode: "TX", metroName: "Dallas-Fort Worth", laborMultiplier: 0.95, materialMultiplier: 0.98, hourlyLow: 95, hourlyHigh: 145 },
  { zipPrefix: "770", stateCode: "TX", metroName: "Houston Metro", laborMultiplier: 0.92, materialMultiplier: 0.96, hourlyLow: 90, hourlyHigh: 140 },
  { zipPrefix: "331", stateCode: "FL", metroName: "Miami / South Florida", laborMultiplier: 1.08, materialMultiplier: 1.05, hourlyLow: 105, hourlyHigh: 160 },
  { zipPrefix: "981", stateCode: "WA", metroName: "Seattle Metro", laborMultiplier: 1.32, materialMultiplier: 1.08, hourlyLow: 130, hourlyHigh: 190 },
  { zipPrefix: "DEFAULT", stateCode: "US", metroName: "US National Average", laborMultiplier: 1, materialMultiplier: 1, hourlyLow: 100, hourlyHigh: 155 },
];

export const REFERENCE_BENCHMARKS: Benchmark[] = [
  {
    id: "hvac_heatpump_3ton",
    tradeCategory: "hvac",
    itemName: "3-Ton Central Heat Pump / AC Replacement",
    wholesaleLow: 2800,
    wholesaleHigh: 4600,
    laborHoursLow: 12,
    laborHoursHigh: 20,
    reasonableMarkupPct: 35,
    mandatoryClauses: [
      "Manual J Load Calculation provided",
      "City permit & inspection fee included",
      "10-Year Manufacturer Parts Warranty registration",
      "Old refrigerant recovery & disposal included",
    ],
  },
  {
    id: "elec_panel_200a",
    tradeCategory: "electrical",
    itemName: "200A Main Breaker Panel & Service Upgrade",
    wholesaleLow: 650,
    wholesaleHigh: 1200,
    laborHoursLow: 8,
    laborHoursHigh: 14,
    reasonableMarkupPct: 35,
    mandatoryClauses: [
      "Utility company disconnect/reconnect coordination",
      "NEC 2023 Whole-Home Surge Protector included",
      "Electrical permit & final city inspection",
      "Arc-Fault (AFCI) breakers labeled clearly",
    ],
  },
  {
    id: "smarthome_wired",
    tradeCategory: "smarthome",
    itemName: "Whole-Home Smart Lighting, Shade & Network System",
    wholesaleLow: 2500,
    wholesaleHigh: 8000,
    laborHoursLow: 16,
    laborHoursHigh: 40,
    reasonableMarkupPct: 30,
    mandatoryClauses: [
      "Full Admin Passwords & Programming Source Files handover",
      " itemized Hardware BOM vs Programming Labor breakdown",
      "1-Year On-Site Calibration & Firmware Warranty",
    ],
  },
  {
    id: "plumbing_water_heater_50",
    tradeCategory: "plumbing",
    itemName: "50-Gallon Water Heater Replacement",
    wholesaleLow: 650,
    wholesaleHigh: 1400,
    laborHoursLow: 4,
    laborHoursHigh: 8,
    reasonableMarkupPct: 35,
    mandatoryClauses: [
      "Permit pulled when the fuel or venting changes",
      "Expansion tank and T&P discharge to code",
      "Old water heater haul-away",
      "Manufacturer warranty registration",
    ],
  },
  {
    id: "plumbing_tankless",
    tradeCategory: "plumbing",
    itemName: "Tankless Gas Water Heater Install",
    wholesaleLow: 1100,
    wholesaleHigh: 2400,
    laborHoursLow: 8,
    laborHoursHigh: 16,
    reasonableMarkupPct: 35,
    mandatoryClauses: [
      "Gas line and venting sized for the unit",
      "Permit and inspection included",
      "Condensate neutralization where required",
      "Flush valves and warranty registration",
    ],
  },
  {
    id: "roofing_asphalt_30sq",
    tradeCategory: "roofing",
    itemName: "30-Square Architectural Shingle Replacement",
    wholesaleLow: 4500,
    wholesaleHigh: 7800,
    laborHoursLow: 24,
    laborHoursHigh: 40,
    reasonableMarkupPct: 30,
    mandatoryClauses: [
      "Building permit included",
      "Ice-and-water shield and underlayment spec",
      "Manufacturer shingle warranty registration",
      "Decking replacement priced per sheet, not a lump sum",
      "Drip edge, flashing, and ventilation",
    ],
  },
  {
    id: "roofing_leak_repair",
    tradeCategory: "roofing",
    itemName: "Localized Roof Leak and Flashing Repair",
    wholesaleLow: 180,
    wholesaleHigh: 650,
    laborHoursLow: 3,
    laborHoursHigh: 7,
    reasonableMarkupPct: 35,
    mandatoryClauses: [
      "Leak location documented with photos",
      "Flashing and underlayment scope in writing",
      "Workmanship warranty stated in months",
      "No whole-roof upsell buried in the repair price",
    ],
  },
];

const PRIMARY_BENCHMARK_ID: Record<string, string> = {
  hvac: "hvac_heatpump_3ton",
  electrical: "elec_panel_200a",
  smarthome: "smarthome_wired",
  plumbing: "plumbing_water_heater_50",
  roofing: "roofing_asphalt_30sq",
};

const KEYWORD_RULES: { id: string; words: string[] }[] = [
  { id: "plumbing_tankless", words: ["tankless"] },
  { id: "plumbing_water_heater_50", words: ["water heater", "hot water"] },
  { id: "roofing_leak_repair", words: ["leak", "flashing repair"] },
  { id: "roofing_asphalt_30sq", words: ["shingle", "roof", "tear-off", "tear off"] },
  { id: "hvac_heatpump_3ton", words: ["heat pump", "furnace", "air handler", "condenser", "hvac"] },
  { id: "elec_panel_200a", words: ["panel", "breaker", "200a", "200 amp", "service upgrade"] },
  { id: "smarthome_wired", words: ["shade", "smart lighting", "control4", "lutron", "keypad"] },
];

export function roundUsd(value: number): number {
  return Math.round(value);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Seeded prefixes are metro anchors, not every ZIP3.
 * 90210 (Beverly Hills) is in the Los Angeles metro whose anchor row is 900.
 * An exact "902" lookup would miss and incorrectly use DEFAULT.
 */
const ANCHOR_ALIASES: Record<string, string> = {
  "902": "900",
};

export function anchorPrefix(zipCode: string): string {
  const prefix = (zipCode || "").replace(/\D/g, "").slice(0, 3);
  return ANCHOR_ALIASES[prefix] ?? prefix;
}

export function lookupZip(zipCode: string): ZipMultiplier {
  const prefix = anchorPrefix(zipCode);
  return (
    REFERENCE_ZIPS.find((row) => row.zipPrefix === prefix) ??
    REFERENCE_ZIPS.find((row) => row.zipPrefix === "DEFAULT")!
  );
}

export function benchmarkById(id: string): Benchmark {
  const found = REFERENCE_BENCHMARKS.find((row) => row.id === id);
  if (!found) {
    throw new Error(`Unknown benchmark ${id}`);
  }
  return found;
}

export function benchmarksForTrade(trade: string): Benchmark[] {
  return REFERENCE_BENCHMARKS.filter((row) => row.tradeCategory === trade);
}

export function selectBenchmark(trade: string, text: string, rows: Benchmark[]): Benchmark {
  const haystack = text.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (!rule.words.some((word) => haystack.includes(word))) continue;
    const found = rows.find((row) => row.id === rule.id && row.tradeCategory === trade);
    if (found) return found;
  }
  const primaryId = PRIMARY_BENCHMARK_ID[trade];
  return rows.find((row) => row.id === primaryId) ?? rows[0] ?? benchmarkById(primaryId);
}

export function computeFairBand(benchmark: Benchmark, zip: ZipMultiplier): FairBand {
  const materialPoints = Math.round(zip.materialMultiplier * 100);
  const markupPoints = 100 + benchmark.reasonableMarkupPct;
  const equipmentLow = Math.round((benchmark.wholesaleLow * materialPoints * markupPoints) / 10000);
  const equipmentHigh = Math.round((benchmark.wholesaleHigh * materialPoints * markupPoints) / 10000);
  const laborLow = Math.round(benchmark.laborHoursLow * zip.hourlyLow);
  const laborHigh = Math.round(benchmark.laborHoursHigh * zip.hourlyHigh);
  return {
    equipmentLow,
    equipmentHigh,
    laborLow,
    laborHigh,
    fairLow: equipmentLow + laborLow,
    fairHigh: equipmentHigh + laborHigh,
    materialMultiplier: zip.materialMultiplier,
    laborMultiplier: zip.laborMultiplier,
    hourlyLow: zip.hourlyLow,
    hourlyHigh: zip.hourlyHigh,
    markupPct: benchmark.reasonableMarkupPct,
  };
}

export function zipFromDbRow(row: {
  zip_prefix: string;
  state_code: string;
  metro_name: string;
  labor_multiplier: number | string;
  material_multiplier: number | string;
  typical_hourly_rate_low: number | string;
  typical_hourly_rate_high: number | string;
}): ZipMultiplier {
  return {
    zipPrefix: row.zip_prefix,
    stateCode: row.state_code,
    metroName: row.metro_name,
    laborMultiplier: Number(row.labor_multiplier),
    materialMultiplier: Number(row.material_multiplier),
    hourlyLow: Number(row.typical_hourly_rate_low),
    hourlyHigh: Number(row.typical_hourly_rate_high),
  };
}

export function benchmarkFromDbRow(row: {
  id: string;
  trade_category: string;
  item_name: string;
  wholesale_equipment_low: number | string;
  wholesale_equipment_high: number | string;
  standard_labor_hours_low: number | string;
  standard_labor_hours_high: number | string;
  reasonable_markup_pct: number | string;
  mandatory_clauses: unknown;
}): Benchmark {
  let clauses: string[] = [];
  if (Array.isArray(row.mandatory_clauses)) {
    clauses = row.mandatory_clauses.filter((item): item is string => typeof item === "string");
  } else if (typeof row.mandatory_clauses === "string") {
    const parsed = JSON.parse(row.mandatory_clauses) as unknown;
    if (Array.isArray(parsed)) {
      clauses = parsed.filter((item): item is string => typeof item === "string");
    }
  }
  return {
    id: row.id,
    tradeCategory: row.trade_category,
    itemName: row.item_name,
    wholesaleLow: Number(row.wholesale_equipment_low),
    wholesaleHigh: Number(row.wholesale_equipment_high),
    laborHoursLow: Number(row.standard_labor_hours_low),
    laborHoursHigh: Number(row.standard_labor_hours_high),
    reasonableMarkupPct: Number(row.reasonable_markup_pct),
    mandatoryClauses: clauses,
  };
}

export function riskLabel(score: number): string {
  if (score >= 65) return "High rip-off risk";
  if (score >= 40) return "Review before you sign";
  return "Lower risk";
}

export function scoreRisk(highCount: number, mediumCount: number, contractor: number, fairHigh: number): number {
  let score = 22 + highCount * 16 + mediumCount * 7;
  const ratio = fairHigh > 0 ? contractor / fairHigh : 1;
  if (ratio >= 1.5) score += 16;
  else if (ratio >= 1.25) score += 10;
  else if (ratio >= 1.1) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function withinDrift(model: number, authority: number): boolean {
  if (!Number.isFinite(model) || !Number.isFinite(authority)) return false;
  const delta = Math.abs(authority) * ABSURD_DRIFT;
  return model >= authority - delta && model <= authority + delta;
}

function clampEndpoint(model: number, authority: number): number {
  if (!withinDrift(model, authority)) return authority;
  return roundUsd(model);
}

function inferKind(title: string): FlagKind {
  const text = title.toLowerCase();
  if (text.includes("labor") || text.includes("hour")) return "labor";
  if (text.includes("markup") || text.includes("equipment") || text.includes("wholesale")) return "equipment";
  return "included";
}

function clampBenchmark(kind: FlagKind, model: number, band: FairBand): number {
  if (kind === "included") {
    return model <= ABSURD_INCLUDED_USD && model >= 0 ? roundUsd(model) : 0;
  }
  const authority = kind === "labor" ? band.laborHigh : band.equipmentHigh;
  return clampEndpoint(model, authority);
}

export interface ReconcileFlagInput {
  title: string;
  severity: Severity;
  quoted_amount_usd: number;
  fair_benchmark_usd: number;
  potential_overcharge_usd: number;
  insider_explanation: string;
  what_to_ask: string;
  kind?: FlagKind;
}

export interface ReconcileResult {
  fairLow: number;
  fairHigh: number;
  savings: number;
  gapLow: number;
  gapHigh: number;
  flags: PublicRedFlag[];
  clamped: boolean;
}

export function reconcileModelNumbers(input: {
  contractorTotal: number;
  modelFairLow: number;
  modelFairHigh: number;
  modelSavings: number;
  band: FairBand;
  flags: ReconcileFlagInput[];
}): ReconcileResult {
  let clamped = false;
  const fairLowRaw = clampEndpoint(input.modelFairLow, input.band.fairLow);
  const fairHighRaw = clampEndpoint(input.modelFairHigh, input.band.fairHigh);
  if (fairLowRaw !== roundUsd(input.modelFairLow) || fairHighRaw !== roundUsd(input.modelFairHigh)) {
    clamped = true;
  }
  const fairLow = Math.min(fairLowRaw, fairHighRaw);
  const fairHigh = Math.max(fairLowRaw, fairHighRaw);
  const flags = input.flags.map((flag) => {
    const kind = flag.kind ?? inferKind(flag.title);
    const fair = clampBenchmark(kind, flag.fair_benchmark_usd, input.band);
    const quoted = roundUsd(flag.quoted_amount_usd);
    const over = Math.min(quoted, Math.max(0, roundUsd(quoted - fair)));
    if (fair !== roundUsd(flag.fair_benchmark_usd) || over !== roundUsd(flag.potential_overcharge_usd)) {
      clamped = true;
    }
    return {
      title: flag.title,
      severity: flag.severity,
      quoted_amount_usd: quoted,
      fair_benchmark_usd: fair,
      potential_overcharge_usd: over,
      insider_explanation: flag.insider_explanation,
      what_to_ask: flag.what_to_ask,
    };
  });
  const flagSum = flags.reduce((sum, flag) => sum + flag.potential_overcharge_usd, 0);
  const gapLow = Math.max(0, roundUsd(input.contractorTotal - fairHigh));
  const gapHigh = Math.max(0, roundUsd(input.contractorTotal - fairLow));
  const floor = Math.min(flagSum, gapLow) * (1 - ABSURD_DRIFT);
  const ceil = Math.max(flagSum, gapHigh, gapLow) * (1 + ABSURD_DRIFT);
  let savings = input.modelSavings;
  if (!Number.isFinite(savings) || savings < floor || savings > ceil) {
    savings = gapLow;
    clamped = true;
  }
  if (gapLow > 0 && flagSum === 0 && input.modelSavings < gapLow * (1 - ABSURD_DRIFT)) {
    savings = gapLow;
    clamped = true;
  }
  return {
    fairLow,
    fairHigh,
    savings: roundUsd(savings),
    gapLow,
    gapHigh,
    flags,
    clamped,
  };
}

const SIGNIFICANT_STOP = new Set(["with", "from", "that", "this", "your", "included", "and", "the"]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !SIGNIFICANT_STOP.has(word));
}

function looseMatch(left: string, right: string): boolean {
  const a = tokens(left);
  const b = new Set(tokens(right));
  if (a.length === 0 || b.size === 0) return false;
  const hits = a.filter((word) => b.has(word)).length;
  return hits >= Math.min(2, a.length);
}

function clauseCovered(
  clause: string,
  visibleClauses: string[],
  lines: { description: string; amount_usd: number }[],
): boolean {
  if (visibleClauses.some((clauseText) => looseMatch(clause, clauseText))) return true;
  return lines.some((line) => line.amount_usd <= 0 && looseMatch(clause, line.description));
}

function isLaborLine(description: string): boolean {
  return /labor|installation|install\b/i.test(description);
}

function isEquipmentLine(description: string, trade: string): boolean {
  if (/pad|whip|line set|thermostat/i.test(description) && !/heat pump|panel|water heater|shingle/i.test(description)) {
    return false;
  }
  const patterns: Record<string, RegExp> = {
    hvac: /heat pump|air handler|furnace|compressor|evaporator|\bcondenser\b(?!\s+pad)/i,
    electrical: /panel|breaker|service upgrade|meter socket/i,
    smarthome: /shade|keypad|processor|lighting control|control4|lutron/i,
    plumbing: /water heater|tankless|repipe/i,
    roofing: /shingle|underlayment|roof system|tear-?off/i,
  };
  return (patterns[trade] ?? /equipment/i).test(description);
}

function isIncludedFee(description: string): boolean {
  return /refrigerant|recovery|disposal|permit fee|warranty fee/i.test(description);
}

function hasHours(description: string): boolean {
  return /\d+(\.\d+)?\s*(hours|hour|hrs|hr)\b/i.test(description);
}

function missingTitle(trade: string): string {
  if (trade === "hvac") return "Missing Permit, Warranty, and Refrigerant Recovery";
  if (trade === "electrical") return "Missing Permit, Inspection, and Labeling Protections";
  if (trade === "smarthome") return "Missing Password Handover and Warranty Protections";
  if (trade === "plumbing") return "Missing Permit, Code, and Disposal Protections";
  return "Missing Permit, Warranty, and Scope Protections";
}

export function buildDeterministicAudit(input: {
  extract: QuoteExtract;
  benchmark: Benchmark;
  zip: ZipMultiplier;
  zipCode: string;
  tradeLabel: string;
  copy: NegotiationCopy;
  tier: 0 | 1 | 2;
  model: string | null;
  savingsRange?: { low: number; high: number };
}): BuiltAudit {
  const band = computeFairBand(input.benchmark, input.zip);
  const lines = input.extract.line_items;
  const laborLine = lines.find((line) => isLaborLine(line.description) && !isIncludedFee(line.description));
  const equipmentLine = lines.find((line) => isEquipmentLine(line.description, input.benchmark.tradeCategory));
  const includedLines = lines.filter((line) => isIncludedFee(line.description) && line.amount_usd > 0);
  const missing = input.benchmark.mandatoryClauses.filter(
    (clause) => !clauseCovered(clause, input.extract.visible_clauses, lines),
  );
  const draft: ReconcileFlagInput[] = [];

  if (laborLine && (!hasHours(laborLine.description) || laborLine.amount_usd > band.laborHigh * 1.02)) {
    const over = Math.max(0, roundUsd(laborLine.amount_usd - band.laborHigh));
    draft.push({
      kind: "labor",
      title: hasHours(laborLine.description) ? "Labor Above the Regional Hourly Band" : "Unitemized Lump-Sum Labor Trap",
      severity: over > 0 && !hasHours(laborLine.description) ? "HIGH" : over > 0 ? "HIGH" : "MEDIUM",
      quoted_amount_usd: laborLine.amount_usd,
      fair_benchmark_usd: band.laborHigh,
      potential_overcharge_usd: over,
      insider_explanation: `Labor is listed at ${formatUsd(laborLine.amount_usd)} without a trustworthy hour breakdown. For this ZIP the benchmark is ${input.benchmark.laborHoursLow}–${input.benchmark.laborHoursHigh} hours at ${formatUsd(band.hourlyLow)}–${formatUsd(band.hourlyHigh)} per hour, so fair labor tops out at ${formatUsd(band.laborHigh)}.`,
      what_to_ask: `Please replace the lump-sum labor line with hours times a rate between ${formatUsd(band.hourlyLow)} and ${formatUsd(band.hourlyHigh)}, and reprice anything above ${formatUsd(band.laborHigh)}.`,
    });
  }

  if (equipmentLine && equipmentLine.amount_usd > band.equipmentHigh * 1.02) {
    const over = Math.max(0, roundUsd(equipmentLine.amount_usd - band.equipmentHigh));
    draft.push({
      kind: "equipment",
      title: "Equipment Markup Above the Wholesale Cap",
      severity: "HIGH",
      quoted_amount_usd: equipmentLine.amount_usd,
      fair_benchmark_usd: band.equipmentHigh,
      potential_overcharge_usd: over,
      insider_explanation: `Wholesale equipment for this benchmark is ${formatUsd(input.benchmark.wholesaleLow)}–${formatUsd(input.benchmark.wholesaleHigh)}. After the ${band.materialMultiplier.toFixed(2)} material multiplier and ${band.markupPct}% markup cap, fair equipment is ${formatUsd(band.equipmentLow)}–${formatUsd(band.equipmentHigh)}. The quote lists ${formatUsd(equipmentLine.amount_usd)}.`,
      what_to_ask: `Please reprice the equipment at wholesale times a ${band.markupPct}% markup, adjusted only by the local material factor, and show the model number.`,
    });
  }

  if (missing.length > 0 || includedLines.length > 0) {
    const quoted = includedLines.reduce((sum, line) => sum + line.amount_usd, 0);
    draft.push({
      kind: "included",
      title: missingTitle(input.benchmark.tradeCategory),
      severity: missing.length >= 2 || quoted > 0 ? "HIGH" : "MEDIUM",
      quoted_amount_usd: quoted,
      fair_benchmark_usd: 0,
      potential_overcharge_usd: quoted,
      insider_explanation: `The benchmark treats these protections as part of a complete quote, not optional extras: ${missing.join("; ") || "the billed inclusion line"}. Separate charges for work that should be included total ${formatUsd(quoted)}.`,
      what_to_ask: "Please include the missing protections in the base price and remove any separate fee for work the scope already requires.",
    });
  }

  const reconciled = reconcileModelNumbers({
    contractorTotal: input.extract.contractor_total_usd,
    modelFairLow: band.fairLow,
    modelFairHigh: band.fairHigh,
    modelSavings: draft.reduce((sum, flag) => sum + flag.potential_overcharge_usd, 0) || Math.max(0, input.extract.contractor_total_usd - band.fairHigh),
    band,
    flags: draft,
  });
  const highCount = reconciled.flags.filter((flag) => flag.severity === "HIGH").length;
  const mediumCount = reconciled.flags.filter((flag) => flag.severity === "MEDIUM").length;
  const savingsLow = input.savingsRange?.low ?? Math.max(0, Math.round(reconciled.savings * 0.75));
  const savingsHigh = input.savingsRange?.high ?? Math.max(reconciled.savings, Math.round(reconciled.savings * 1.1));
  const questions = reconciled.flags.map((flag) => `- ${flag.what_to_ask}`).join("\n");
  const missingBlock = missing.map((clause) => `- ${clause}`).join("\n");
  const scriptInput: NegotiationFields = {
    tradeLabel: input.tradeLabel,
    zip: input.zipCode,
    metro: input.zip.metroName,
    total: formatUsd(input.extract.contractor_total_usd),
    itemName: input.benchmark.itemName,
    savingsLow: formatUsd(savingsLow),
    savingsHigh: formatUsd(savingsHigh),
    questions: questions || "- Please itemize equipment and labor hours.",
    missing: missingBlock || "- Please confirm permit, warranty, and disposal in writing.",
    fairLow: formatUsd(reconciled.fairLow),
    fairHigh: formatUsd(reconciled.fairHigh),
    flagged: formatUsd(reconciled.savings),
  };
  const lineItems: BuiltLine[] = lines.map((line) => {
    if (laborLine && line.description === laborLine.description) {
      return {
        description: line.description,
        quoted_usd: line.amount_usd,
        fair_low_usd: band.laborLow,
        fair_high_usd: band.laborHigh,
        note: "Benchmark hours times the ZIP hourly rate.",
      };
    }
    if (equipmentLine && line.description === equipmentLine.description) {
      return {
        description: line.description,
        quoted_usd: line.amount_usd,
        fair_low_usd: band.equipmentLow,
        fair_high_usd: band.equipmentHigh,
        note: "Wholesale times the material multiplier times the markup cap.",
      };
    }
    if (isIncludedFee(line.description)) {
      return {
        description: line.description,
        quoted_usd: line.amount_usd,
        fair_low_usd: 0,
        fair_high_usd: 0,
        note: "The benchmark treats this as included, not a separate charge.",
      };
    }
    return {
      description: line.description,
      quoted_usd: line.amount_usd,
      fair_low_usd: null,
      fair_high_usd: null,
      note: "Outside the core benchmark. Ask for this scope in writing before comparing it.",
    };
  });

  return {
    contractor_total_usd: input.extract.contractor_total_usd,
    fair_price_low_usd: reconciled.fairLow,
    fair_price_high_usd: reconciled.fairHigh,
    estimated_savings_usd: reconciled.savings,
    savings_low_usd: savingsLow,
    savings_high_usd: savingsHigh,
    gap_above_ceiling_usd: reconciled.gapLow,
    gap_above_floor_usd: reconciled.gapHigh,
    risk_score: scoreRisk(highCount, mediumCount, input.extract.contractor_total_usd, reconciled.fairHigh),
    red_flags: reconciled.flags,
    missing_protections: missing,
    line_items_breakdown: lineItems,
    negotiation_script_email: input.copy.email(scriptInput),
    negotiation_script_sms: input.copy.sms(scriptInput),
    benchmark_id: input.benchmark.id,
    metro_name: input.zip.metroName,
    band_note: `Fair band ${formatUsd(reconciled.fairLow)}–${formatUsd(reconciled.fairHigh)} = equipment ${formatUsd(band.equipmentLow)}–${formatUsd(band.equipmentHigh)} (wholesale × ${band.materialMultiplier.toFixed(2)} material × ${band.markupPct}% markup) + labor ${formatUsd(band.laborLow)}–${formatUsd(band.laborHigh)} (${input.benchmark.laborHoursLow}–${input.benchmark.laborHoursHigh} h × ${formatUsd(band.hourlyLow)}–${formatUsd(band.hourlyHigh)}). This quote is ${formatUsd(reconciled.gapLow)} above the top of that band. The opening ask uses the flagged lines, not a demand to hit wholesale.`,
    inference_tier: input.tier,
    model: input.model,
  };
}

const DEMO_EXTRACT: QuoteExtract = {
  contractor_total_usd: 16800,
  line_items: [
    { description: "3-Ton Central Heat Pump Equipment", amount_usd: 8050 },
    { description: "Installation labor (lump sum)", amount_usd: 5450 },
    { description: "Thermostat, equipment pad, line set, and electrical whip", amount_usd: 2500 },
    { description: "Refrigerant recovery and disposal", amount_usd: 800 },
  ],
  visible_clauses: [],
  confidence: 0.96,
  image_unreadable: false,
};

export function buildDemoAudit(input: { copy: NegotiationCopy; tradeLabel: string }): BuiltAudit {
  const zip = lookupZip("90210");
  const benchmark = benchmarkById("hvac_heatpump_3ton");
  const audit = buildDeterministicAudit({
    extract: DEMO_EXTRACT,
    benchmark,
    zip,
    zipCode: "90210",
    tradeLabel: input.tradeLabel,
    copy: input.copy,
    tier: 0,
    model: null,
    savingsRange: { low: 2850, high: 4200 },
  });
  return { ...audit, inference_tier: 0, model: null };
}

export function validateExtract(
  value: unknown,
): { ok: true; extract: QuoteExtract } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") return { ok: false, reason: "not_object" };
  const row = value as Record<string, unknown>;
  if (typeof row.contractor_total_usd !== "number" || !Number.isFinite(row.contractor_total_usd)) {
    return { ok: false, reason: "contractor_total_usd" };
  }
  if (!Array.isArray(row.line_items)) return { ok: false, reason: "line_items" };
  const lineItems: QuoteExtract["line_items"] = [];
  for (const item of row.line_items) {
    if (!item || typeof item !== "object") return { ok: false, reason: "line_item" };
    const line = item as Record<string, unknown>;
    if (typeof line.description !== "string" || typeof line.amount_usd !== "number" || !Number.isFinite(line.amount_usd)) {
      return { ok: false, reason: "line_item_fields" };
    }
    lineItems.push({ description: line.description, amount_usd: line.amount_usd });
  }
  if (!Array.isArray(row.visible_clauses) || !row.visible_clauses.every((clause) => typeof clause === "string")) {
    return { ok: false, reason: "visible_clauses" };
  }
  if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence)) {
    return { ok: false, reason: "confidence" };
  }
  if (typeof row.image_unreadable !== "boolean") return { ok: false, reason: "image_unreadable" };
  return {
    ok: true,
    extract: {
      contractor_total_usd: row.contractor_total_usd,
      line_items: lineItems,
      visible_clauses: row.visible_clauses as string[],
      confidence: row.confidence,
      image_unreadable: row.image_unreadable,
    },
  };
}

export function shouldEscalateExtract(result: { ok: true; extract: QuoteExtract } | { ok: false; reason: string }): boolean {
  if (!result.ok) return true;
  const extract = result.extract;
  if (extract.image_unreadable) return true;
  if (extract.confidence < LOW_CONFIDENCE) return true;
  if (!(extract.contractor_total_usd > 0)) return true;
  if (extract.line_items.length === 0) return true;
  return false;
}

function isSeverity(value: unknown): value is Severity {
  return value === "HIGH" || value === "MEDIUM";
}

export function validateModelAudit(value: unknown): { ok: true; audit: Record<string, unknown> } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") return { ok: false, reason: "not_object" };
  const row = value as Record<string, unknown>;
  const numbers = ["contractor_total_usd", "fair_price_low_usd", "fair_price_high_usd", "estimated_savings_usd", "risk_score"] as const;
  for (const key of numbers) {
    if (typeof row[key] !== "number" || !Number.isFinite(row[key] as number)) return { ok: false, reason: key };
  }
  if (!Array.isArray(row.red_flags) || row.red_flags.length === 0) return { ok: false, reason: "red_flags" };
  for (const flag of row.red_flags) {
    if (!flag || typeof flag !== "object") return { ok: false, reason: "red_flag" };
    const item = flag as Record<string, unknown>;
    if (typeof item.title !== "string" || !isSeverity(item.severity)) return { ok: false, reason: "red_flag_title" };
    for (const key of ["quoted_amount_usd", "fair_benchmark_usd", "potential_overcharge_usd"] as const) {
      if (typeof item[key] !== "number" || !Number.isFinite(item[key] as number)) return { ok: false, reason: key };
    }
    if (typeof item.insider_explanation !== "string" || typeof item.what_to_ask !== "string") {
      return { ok: false, reason: "red_flag_copy" };
    }
  }
  if (!Array.isArray(row.missing_protections) || !row.missing_protections.every((item) => typeof item === "string")) {
    return { ok: false, reason: "missing_protections" };
  }
  if (typeof row.negotiation_script_email !== "string" || typeof row.negotiation_script_sms !== "string") {
    return { ok: false, reason: "scripts" };
  }
  if (!Array.isArray(row.line_items_breakdown)) return { ok: false, reason: "line_items_breakdown" };
  return { ok: true, audit: row };
}

export function modelAuditToBuilt(input: {
  audit: Record<string, unknown>;
  benchmark: Benchmark;
  zip: ZipMultiplier;
  tier: 1 | 2;
  model: string;
}): BuiltAudit | null {
  const validated = validateModelAudit(input.audit);
  if (!validated.ok) return null;
  const row = validated.audit;
  const band = computeFairBand(input.benchmark, input.zip);
  const flags = (row.red_flags as Record<string, unknown>[]).map((flag) => ({
    title: String(flag.title),
    severity: flag.severity as Severity,
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
    band,
    flags,
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
    red_flags: reconciled.flags,
    missing_protections: row.missing_protections as string[],
    line_items_breakdown: lines,
    negotiation_script_email: String(row.negotiation_script_email),
    negotiation_script_sms: String(row.negotiation_script_sms),
    benchmark_id: input.benchmark.id,
    metro_name: input.zip.metroName,
    band_note: `Fair band held to the Tier 0 table: ${formatUsd(reconciled.fairLow)}–${formatUsd(reconciled.fairHigh)} in ${input.zip.metroName}.`,
    inference_tier: input.tier,
    model: input.model,
  };
  return validatePersistedNumbers(built) ? built : null;
}

export function validatePersistedNumbers(audit: {
  contractor_total_usd: number;
  fair_price_low_usd: number;
  fair_price_high_usd: number;
  estimated_savings_usd: number;
  risk_score: number;
}): boolean {
  const values = [
    audit.contractor_total_usd,
    audit.fair_price_low_usd,
    audit.fair_price_high_usd,
    audit.estimated_savings_usd,
    audit.risk_score,
  ];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return false;
  if (audit.contractor_total_usd <= 0) return false;
  if (audit.fair_price_low_usd > audit.fair_price_high_usd) return false;
  if (audit.risk_score < 0 || audit.risk_score > 100) return false;
  return true;
}

export interface StrippedAudit {
  id: string;
  user_id: string;
  zip_code: string;
  trade_category: string;
  metro_name: string;
  contractor_total_usd: number;
  estimated_savings_usd: number;
  savings_low_usd: number;
  savings_high_usd: number;
  risk_score: number;
  red_flag_count: number;
  teaser_red_flag_titles: string[];
  is_unlocked: false;
  created_at: string;
  demo?: boolean;
  red_flags: { title: string; severity: Severity }[];
}

/** Allowlist for non-pro HTTP responses. Insider keys are never copied. */
export function stripForClient(audit: {
  id: string;
  user_id: string;
  zip_code: string;
  trade_category: string;
  metro_name?: string | null;
  contractor_total_usd: number;
  estimated_savings_usd: number;
  savings_low_usd: number;
  savings_high_usd: number;
  risk_score: number;
  red_flag_count: number;
  teaser_red_flag_titles: string[];
  created_at: string;
  demo?: boolean;
  red_flags: { title: string; severity: Severity }[];
  full_audit_json?: { metro_name?: string; red_flags?: { title: string; severity: Severity }[] };
}): StrippedAudit {
  const flags = audit.red_flags?.length
    ? audit.red_flags
    : (audit.full_audit_json?.red_flags ?? []);
  return {
    id: audit.id,
    user_id: audit.user_id,
    zip_code: audit.zip_code,
    trade_category: audit.trade_category,
    metro_name: audit.metro_name ?? audit.full_audit_json?.metro_name ?? "",
    contractor_total_usd: Number(audit.contractor_total_usd),
    estimated_savings_usd: Number(audit.estimated_savings_usd),
    savings_low_usd: Number(audit.savings_low_usd),
    savings_high_usd: Number(audit.savings_high_usd),
    risk_score: Number(audit.risk_score),
    red_flag_count: Number(audit.red_flag_count),
    teaser_red_flag_titles: [...audit.teaser_red_flag_titles],
    is_unlocked: false,
    created_at: audit.created_at,
    demo: audit.demo,
    red_flags: flags.map((flag) => ({ title: flag.title, severity: flag.severity })),
  };
}

export function presentAudit<T extends Parameters<typeof stripForClient>[0]>(audit: T, unlocked: boolean): T | StrippedAudit {
  if (!unlocked) return stripForClient(audit);
  return { ...audit, is_unlocked: true };
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/u, "").trim();
  return JSON.parse(trimmed);
}
