/**
 * Quote Shield AI knowledge adapter.
 * Reads the unpacked 2026 ZIP matrix, trade blueprints, and golden demos.
 * Static imports only. This module does not call fetch or a model provider.
 *
 * Labor calibration:
 * JSON `*_burdened_hourly_usd` is contractor shop cost (BLS wage × burden).
 * Homeowner fair invoice hourly = burdened / (1 - 0.20) = burdened × 1.25.
 * Do not multiply by `burden_multiplier_vs_bls_wage` or a labor index again.
 */

import type { TradeId } from "../types/audit";
import goldenDemoCatalog from "./raw/golden_demo_cases_2026.json";
import tradeBlueprintCatalog from "./raw/trade_reference_blueprints_2026.json";
import zipCostMatrix from "./raw/us_zip_cost_matrix_2026.json";

export { goldenDemoCatalog, tradeBlueprintCatalog, zipCostMatrix };

export type ZipMetro = (typeof zipCostMatrix.metros)[number];
export type Blueprint = (typeof tradeBlueprintCatalog.blueprints)[number];
export type BlueprintTierName = keyof Blueprint["design_tiers"];
export type GoldenDemoCase = (typeof goldenDemoCatalog.cases)[number];
export type KnowledgeTrade = "hvac" | "electrical" | "plumbing" | "roofing" | "smart_home";

export interface HourlyBand {
  low: number;
  mid: number;
  high: number;
}

export interface MoneyRange {
  low: number;
  high: number;
}

/** A permit amount plus the city evidence label from the ZIP matrix. */
export interface EvidencedMoneyRange extends MoneyRange {
  evidence_level: string;
}

export interface MetroPermitSchedule {
  evidence_level: string;
  source_note: string;
  electrical_panel_upgrade_typical_usd: EvidencedMoneyRange;
  mechanical_hvac_changeout_typical_usd: EvidencedMoneyRange;
  plumbing_water_heater_typical_usd: EvidencedMoneyRange;
  roofing_reroof_typical_usd: EvidencedMoneyRange;
}

export type GoldenDemoMatch = "metro_and_trade" | "trade" | "global_default";

export interface GoldenDemoSelection {
  match: GoldenDemoMatch;
  metro_id: string | null;
  zip5: string | null;
  case: GoldenDemoCase;
}

export interface PricingLocation {
  metro_id: string;
  metro_name: string;
  state: string;
  zip5: string | null;
  zip3: string | null;
  source: "zip_matrix" | "national_baseline";
  material_multiplier: number;
  permit_multiplier: number;
  overall_install_cost_index: number;
  national_baseline: number;
  permit_evidence_level: string;
  burdened_hourly: HourlyBand;
  invoice_hourly: HourlyBand;
  permits: MetroPermitSchedule | null;
}

/**
 * Shapes that actually appear on flagship BOM, RadioRA 3 / UniFi, and plumbing
 * prices in the 2026 JSON pack:
 * - a single finite number (`wholesale_bom_low_usd`, trap charges)
 * - a two-number array (`typical_permit_and_inspection_usd`, city permit rows, `verified_fair_range_usd`)
 * - `{ low, high }` and the labor object `{ low, mid, high }` (mid is ignored)
 * - currency strings using an en dash: `$66–$180`, `~$850–$1,100`, `~$0.19–$0.25`, `$5k–$8k`
 * - a whole-string single amount such as `~$2,375.99`
 * An em dash in prose (`$300 — $850 is padded`) is a pause, not a range.
 * `k` means × 1,000. A trailing `+` is ignored. "Bundled" strings are rejected.
 */
export type RangeInput =
  | number
  | readonly number[]
  | { low: number; high: number; mid?: number }
  | string;

/** burdened / (1 - 0.20). Exact value is 1.25. */
export const BURDENED_TO_INVOICE_HOURLY = 1 / (1 - 0.2);

export const NATIONAL_BASELINE_ID = "national_baseline";
export const NATIONAL_BASELINE_NAME = "US National Baseline";

const LABOR_FIELD = {
  hvac: "hvac_tech_burdened_hourly_usd",
  electrical: "electrician_burdened_hourly_usd",
  plumbing: "plumber_burdened_hourly_usd",
  roofing: "roofer_burdened_hourly_usd",
  smart_home: "low_voltage_tech_burdened_hourly_usd",
} as const satisfies Record<KnowledgeTrade, keyof ZipMetro["labor"]>;

const MONEY_NUMBER = String.raw`((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)`;
const CURRENCY_RANGE = new RegExp(
  `~?\\$\\s*${MONEY_NUMBER}(k)?\\s*–\\s*~?\\$?\\s*${MONEY_NUMBER}(k)?\\+?`,
  "i",
);
const WHOLE_AMOUNT = new RegExp(`^~?\\$?\\s*${MONEY_NUMBER}(k)?\\+?$`, "i");

/**
 * HANDOFF does not name a global demo. The stable rule is file order:
 * the first case, `demo_ca_hvac_irvine_3ton_01`.
 * Same-trade fallback uses that same file order.
 */
export const GLOBAL_DEFAULT_CASE_ID = goldenDemoCatalog.cases[0].case_id;

export function normalizeTradeKey(tradeCategory: string): KnowledgeTrade | null {
  const compact = tradeCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (compact === "hvac") return "hvac";
  if (compact === "electrical" || compact === "electric") return "electrical";
  if (compact === "plumbing" || compact === "plumber") return "plumbing";
  if (compact === "roofing" || compact === "roof") return "roofing";
  // "smart_home", "smart-home", and the app id "smarthome" all collapse to smarthome.
  if (compact === "smarthome" || compact === "lowvoltage") return "smart_home";
  return null;
}

/** App TradeId uses `smarthome`. Knowledge JSON uses `smart_home`. */
export function toAppTradeId(trade: KnowledgeTrade): TradeId {
  if (trade === "smart_home") return "smarthome";
  return trade;
}

/** First 5-digit ZIP in a string. `location_zip` looks like `92618 (Irvine / Orange County, CA)`. */
export function parseZip5(input: string): string | null {
  const match = String(input ?? "").match(/\d{5}/);
  return match ? match[0] : null;
}

export function lookupMetroByZip(zipCode: string): ZipMetro | null {
  const zip5 = parseZip5(zipCode);
  if (!zip5) return null;
  const zip3 = zip5.slice(0, 3);
  return zipCostMatrix.metros.find((metro) => metro.primary_zip3_prefixes.includes(zip3)) ?? null;
}

export function calibrateHomeownerInvoiceHourly(burdened: HourlyBand): HourlyBand {
  // Homeowner fair invoice hourly = burdened shop cost / (1 - 0.20) = burdened × 1.25.
  // The JSON hourly already includes BLS wage × burden. Do not apply
  // burden_multiplier_vs_bls_wage or labor_multiplier again.
  const factor = BURDENED_TO_INVOICE_HOURLY;
  return {
    low: burdened.low * factor,
    mid: burdened.mid * factor,
    high: burdened.high * factor,
  };
}

/**
 * Unweighted mean of the 30 metro burdened bands for this trade.
 * The matrix has no national labor row. This is not the old seed hourly of $100–$155.
 */
export function nationalBaselineBurdenedHourly(trade: KnowledgeTrade): HourlyBand {
  const field = LABOR_FIELD[trade];
  const rows = zipCostMatrix.metros.map((metro) => metro.labor[field]);
  return {
    low: mean(rows.map((row) => row.low)),
    mid: mean(rows.map((row) => row.mid)),
    high: mean(rows.map((row) => row.high)),
  };
}

/** Every metro stores `cost_indices.national_baseline` (1.0). */
export function nationalBaselineIndex(): number {
  return zipCostMatrix.metros[0].cost_indices.national_baseline;
}

export function metroPermitSchedule(metro: ZipMetro): MetroPermitSchedule {
  const evidence = metro.permits.evidence_level;
  return {
    evidence_level: evidence,
    source_note: metro.permits.source_note,
    electrical_panel_upgrade_typical_usd: withEvidence(metro.permits.electrical_panel_upgrade_typical_usd, evidence),
    mechanical_hvac_changeout_typical_usd: withEvidence(metro.permits.mechanical_hvac_changeout_typical_usd, evidence),
    plumbing_water_heater_typical_usd: withEvidence(metro.permits.plumbing_water_heater_typical_usd, evidence),
    roofing_reroof_typical_usd: withEvidence(metro.permits.roofing_reroof_typical_usd, evidence),
  };
}

export function lookupBlueprintById(blueprintId: string): Blueprint | null {
  return tradeBlueprintCatalog.blueprints.find((blueprint) => blueprint.blueprint_id === blueprintId) ?? null;
}

/**
 * First blueprint in file order for the trade.
 * HVAC → hvac_3ton_heatpump_2026, electrical → elec_panel_100_to_200a_2026,
 * plumbing → plumb_wh_50gal_tank_2026, roofing → roof_arch_shingle_2500sqft_2026,
 * smart_home → smart_cat6_wholehome_2026.
 */
export function defaultBlueprintForTrade(tradeCategory: string): Blueprint | null {
  const trade = normalizeTradeKey(tradeCategory);
  if (!trade) return null;
  return tradeBlueprintCatalog.blueprints.find((blueprint) => blueprint.trade_category === trade) ?? null;
}

export function normalizeToRange(input: RangeInput): MoneyRange {
  if (typeof input === "number") {
    return { low: finiteNumber(input, "value"), high: finiteNumber(input, "value") };
  }
  if (typeof input === "string") return normalizeStringRange(input);
  if (Array.isArray(input)) {
    if (input.length !== 2) {
      throw new Error(`normalizeToRange expected a two-number array, received length ${input.length}`);
    }
    return ordered(finiteNumber(input[0], "low"), finiteNumber(input[1], "high"));
  }
  if (input && typeof input === "object" && "low" in input && "high" in input) {
    return ordered(finiteNumber(input.low, "low"), finiteNumber(input.high, "high"));
  }
  throw new Error("normalizeToRange received an unsupported price shape");
}

/**
 * Match order: same metro and same trade, else same trade, else the first case.
 * ZIP3 is mapped through `primary_zip3_prefixes` to `metro_id`.
 * `smarthome` and `smart_home` are the same trade.
 */
export function selectBestGoldenDemo(zipCode: string, tradeCategory: string): GoldenDemoSelection {
  const zip5 = parseZip5(zipCode);
  const metro = zip5 ? lookupMetroByZip(zip5) : null;
  const trade = normalizeTradeKey(tradeCategory);
  const cases = goldenDemoCatalog.cases;

  if (metro && trade) {
    const sameMetroAndTrade = cases.find((item) => demoMatches(item, metro.metro_id, trade));
    if (sameMetroAndTrade) {
      return { match: "metro_and_trade", metro_id: metro.metro_id, zip5, case: sameMetroAndTrade };
    }
  }

  if (trade) {
    const sameTrade = cases.find((item) => normalizeTradeKey(item.trade_category) === trade);
    if (sameTrade) {
      return { match: "trade", metro_id: metro?.metro_id ?? null, zip5, case: sameTrade };
    }
  }

  return {
    match: "global_default",
    metro_id: metro?.metro_id ?? null,
    zip5,
    case: cases[0],
  };
}

export function resolvePricingLocation(zipCode: string, trade: KnowledgeTrade): PricingLocation {
  const zip5 = parseZip5(zipCode);
  const metro = zip5 ? lookupMetroByZip(zip5) : null;
  const baseline = nationalBaselineIndex();
  if (!metro) {
    const burdened = nationalBaselineBurdenedHourly(trade);
    return {
      metro_id: NATIONAL_BASELINE_ID,
      metro_name: NATIONAL_BASELINE_NAME,
      state: "US",
      zip5,
      zip3: zip5 ? zip5.slice(0, 3) : null,
      source: "national_baseline",
      material_multiplier: baseline,
      permit_multiplier: baseline,
      overall_install_cost_index: baseline,
      national_baseline: baseline,
      permit_evidence_level: NATIONAL_BASELINE_ID,
      burdened_hourly: burdened,
      invoice_hourly: calibrateHomeownerInvoiceHourly(burdened),
      permits: null,
    };
  }

  const burdened = metro.labor[LABOR_FIELD[trade]];
  const permits = metroPermitSchedule(metro);
  return {
    metro_id: metro.metro_id,
    metro_name: metro.metro_name,
    state: metro.state,
    zip5,
    zip3: zip5 ? zip5.slice(0, 3) : null,
    source: "zip_matrix",
    material_multiplier: metro.cost_indices.material_multiplier_vs_national,
    permit_multiplier: metro.cost_indices.permit_fee_multiplier_vs_national,
    overall_install_cost_index: metro.cost_indices.overall_install_cost_index,
    national_baseline: metro.cost_indices.national_baseline,
    permit_evidence_level: permits.evidence_level,
    burdened_hourly: { low: burdened.low, mid: burdened.mid, high: burdened.high },
    invoice_hourly: calibrateHomeownerInvoiceHourly(burdened),
    permits,
  };
}

function demoMatches(item: GoldenDemoCase, metroId: string, trade: KnowledgeTrade): boolean {
  if (normalizeTradeKey(item.trade_category) !== trade) return false;
  const zip5 = parseZip5(item.location_zip);
  const demoMetro = zip5 ? lookupMetroByZip(zip5) : null;
  return demoMetro?.metro_id === metroId;
}

function withEvidence(value: readonly number[], evidence: string): EvidencedMoneyRange {
  return { ...normalizeToRange(value), evidence_level: evidence };
}

function normalizeStringRange(input: string): MoneyRange {
  const text = input.trim();
  const range = CURRENCY_RANGE.exec(text);
  if (range?.[1] && range[3]) {
    return ordered(parseMoneyToken(range[1], range[2]), parseMoneyToken(range[3], range[4]));
  }
  const whole = WHOLE_AMOUNT.exec(text);
  if (whole?.[1]) {
    const value = parseMoneyToken(whole[1], whole[2]);
    return { low: value, high: value };
  }
  throw new Error("normalizeToRange found no currency amount in the string");
}

function parseMoneyToken(numberText: string, kilo: string | undefined): number {
  const value = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(value)) throw new Error("normalizeToRange could not read a price");
  return kilo ? value * 1000 : value;
}

function finiteNumber(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`normalizeToRange expected a finite number for ${label}`);
  }
  return value;
}

function ordered(low: number, high: number): MoneyRange {
  return low <= high ? { low, high } : { low: high, high: low };
}

function mean(values: number[]): number {
  if (values.length === 0) throw new Error("Cannot average an empty labor sample");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
