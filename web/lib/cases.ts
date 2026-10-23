import { readFileSync } from "node:fs";
import path from "node:path";

export interface SampleReport {
  id: string;
  location: string;
  trade: string;
  scope: string;
  quoted: number;
  fairLow: number;
  fairHigh: number;
  savings: number;
  risk: number;
}

const TRADE_LABEL: Record<string, string> = {
  hvac: "HVAC",
  electrical: "Electrical Panel",
  plumbing: "Plumbing",
  roofing: "Roofing",
  smart_home: "Smart Home",
};

/** One educational fixture per trade. Ids are rows in golden_demo_cases_2026.json. */
const FEATURED: { id: string; scope: string }[] = [
  { id: "demo_ca_hvac_irvine_3ton_01", scope: "3-ton heat pump changeout" },
  { id: "demo_tx_elec_dfw_panel_03", scope: "100A to 200A panel upgrade" },
  { id: "demo_co_plumb_denver_tank_07", scope: "50-gallon water heater replacement" },
  { id: "demo_nc_roof_charlotte_shingle_11", scope: "Architectural shingle reroof" },
  { id: "demo_ca_smart_sandiego_unifi_14", scope: "Whole-home Wi-Fi and smart dimmers" },
];

interface GoldenFile {
  cases: Array<{
    case_id: string;
    location_zip: string;
    trade_category: string;
    contractor_quoted_total_usd: number;
    verified_fair_range_usd: number[];
    verified_savings_achieved_usd: number;
    risk_score: number;
  }>;
}

export function featuredSamples(): SampleReport[] {
  const file = path.join(process.cwd(), "..", "src", "knowledge", "raw", "golden_demo_cases_2026.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as GoldenFile;
  return FEATURED.map((item) => {
    const row = raw.cases.find((entry) => entry.case_id === item.id);
    if (!row) throw new Error(`Missing golden demo case ${item.id}`);
    const [fairLow, fairHigh] = row.verified_fair_range_usd;
    if (fairLow == null || fairHigh == null) throw new Error(`Missing fair range for ${item.id}`);
    return {
      id: row.case_id,
      location: row.location_zip,
      trade: TRADE_LABEL[row.trade_category] ?? row.trade_category,
      scope: item.scope,
      quoted: row.contractor_quoted_total_usd,
      fairLow,
      fairHigh,
      savings: row.verified_savings_achieved_usd,
      risk: row.risk_score,
    };
  });
}
