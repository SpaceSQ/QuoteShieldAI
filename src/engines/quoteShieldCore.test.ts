import assert from "node:assert/strict";
import { test } from "node:test";
import { runKnowledgeBackedLocalAudit } from "./quoteShieldCore";
import {
  BURDENED_TO_INVOICE_HOURLY,
  calibrateHomeownerInvoiceHourly,
  defaultBlueprintForTrade,
  goldenDemoCatalog,
  lookupBlueprintById,
  lookupMetroByZip,
  metroPermitSchedule,
  nationalBaselineBurdenedHourly,
  nationalBaselineIndex,
  normalizeToRange,
  selectBestGoldenDemo,
  zipCostMatrix,
} from "../knowledge/knowledgeAdapter";

test("homeowner invoice hourly is burdened × 1.25 and does not reapply burden", () => {
  const losAngeles = lookupMetroByZip("90210");
  assert.ok(losAngeles);
  const burdened = losAngeles.labor.hvac_tech_burdened_hourly_usd;
  assert.equal(burdened.mid, 81);
  assert.equal(BURDENED_TO_INVOICE_HOURLY, 1.25);
  const invoice = calibrateHomeownerInvoiceHourly(burdened);
  assert.equal(invoice.low, 50 * 1.25);
  assert.equal(invoice.mid, 81 * 1.25);
  assert.equal(invoice.high, 118 * 1.25);
  assert.notEqual(invoice.mid, 81 * losAngeles.labor.burden_multiplier_vs_bls_wage * 1.25);
});

test("normalizeToRange accepts the price shapes present in the knowledge JSON", () => {
  const heatPump = lookupBlueprintById("hvac_3ton_heatpump_2026");
  const tank = lookupBlueprintById("plumb_wh_50gal_tank_2026");
  const heatPumpWater = lookupBlueprintById("plumb_wh_hpwh_50_2026");
  const unifi = lookupBlueprintById("smart_unifi_wifi_lutron_2026");
  const cat6 = lookupBlueprintById("smart_cat6_wholehome_2026");
  assert.ok(heatPump && tank && heatPumpWater && unifi && cat6);

  assert.equal(heatPump.design_tiers.better.wholesale_bom_low_usd, 3400);
  assert.deepEqual(normalizeToRange(heatPump.design_tiers.better.wholesale_bom_low_usd), { low: 3400, high: 3400 });

  assert.deepEqual(normalizeToRange(heatPump.standard_labor_allocation.typical_permit_and_inspection_usd), {
    low: 180,
    high: 450,
  });

  const hourly = lookupMetroByZip("92618")?.labor.hvac_tech_burdened_hourly_usd;
  assert.ok(hourly);
  assert.deepEqual(normalizeToRange(hourly), { low: hourly.low, high: hourly.high });
  assert.deepEqual(normalizeToRange({ low: hourly.low, high: hourly.high }), { low: 50, high: 118 });

  const bradford = tank.design_tiers.better.representative_brands_models[0];
  assert.match(bradford, /~\$850–\$1,100/);
  assert.deepEqual(normalizeToRange(bradford), { low: 850, high: 1100 });

  const ductNote = heatPump.common_contractor_padding_traps.find((trap) => trap.source_note.includes("$5k–$8k"));
  assert.ok(ductNote);
  assert.deepEqual(normalizeToRange(ductNote.source_note), { low: 5000, high: 8000 });

  const flagshipNote = unifi.common_contractor_padding_traps[0].source_note;
  assert.match(flagshipNote, /\$700–\$1,200/);
  assert.deepEqual(normalizeToRange(flagshipNote), { low: 700, high: 1200 });

  const cableNote = cat6.common_contractor_padding_traps[0].source_note;
  assert.match(cableNote, /\$0\.19–\$0\.25/);
  assert.deepEqual(normalizeToRange(cableNote), { low: 0.19, high: 0.25 });

  const singlePrice = heatPumpWater.design_tiers.better.representative_brands_models.find((line) => line.includes("~$2,375.99"));
  assert.ok(singlePrice);
  assert.deepEqual(normalizeToRange("~$2,375.99"), { low: 2375.99, high: 2375.99 });

  const emDashBadge = goldenDemoCatalog.cases[0].line_by_line_xray.find(
    (line) => line.evidence_badge.includes("— $850"),
  );
  assert.ok(emDashBadge);
  assert.deepEqual(normalizeToRange(emDashBadge.evidence_badge), { low: 66, high: 180 });

  const bundled = goldenDemoCatalog.cases[0].line_by_line_xray.find((line) => line.quoted_usd === "Bundled (Hidden)");
  assert.ok(bundled);
  const quoted = bundled.quoted_usd;
  assert.equal(typeof quoted, "string");
  if (typeof quoted === "string") assert.throws(() => normalizeToRange(quoted));
});

test("Las Vegas permit rows keep the E4 evidence label", () => {
  const lasVegas = zipCostMatrix.metros.find((metro) => metro.metro_id === "msa_las_vegas_nv");
  assert.ok(lasVegas);
  const schedule = metroPermitSchedule(lasVegas);
  assert.equal(schedule.evidence_level, "E4");
  assert.equal(schedule.electrical_panel_upgrade_typical_usd.evidence_level, "E4");
  assert.equal(schedule.mechanical_hvac_changeout_typical_usd.evidence_level, "E4");
  assert.equal(schedule.plumbing_water_heater_typical_usd.evidence_level, "E4");
  assert.equal(schedule.roofing_reroof_typical_usd.evidence_level, "E4");
  assert.deepEqual(
    normalizeToRange(lasVegas.permits.mechanical_hvac_changeout_typical_usd),
    {
      low: schedule.mechanical_hvac_changeout_typical_usd.low,
      high: schedule.mechanical_hvac_changeout_typical_usd.high,
    },
  );
  assert.equal(zipCostMatrix.metros.filter((metro) => metro.permits.evidence_level === "E4").length, 12);
  assert.equal(zipCostMatrix.metros.filter((metro) => metro.permits.evidence_level === "E1").length, 18);
});

test("selectBestGoldenDemo prefers metro and trade, then trade, then the first case", () => {
  const irvine = selectBestGoldenDemo("92618", "hvac");
  assert.equal(irvine.match, "metro_and_trade");
  assert.equal(irvine.metro_id, "msa_los_angeles_ca");
  assert.equal(irvine.case.case_id, "demo_ca_hvac_irvine_3ton_01");

  const dallasHvac = selectBestGoldenDemo("75024", "hvac");
  assert.equal(dallasHvac.match, "trade");
  assert.equal(dallasHvac.metro_id, "msa_dallas_fort_worth_tx");
  assert.equal(dallasHvac.case.trade_category, "hvac");
  assert.equal(dallasHvac.case.case_id, "demo_ca_hvac_irvine_3ton_01");
  assert.notEqual(dallasHvac.case.case_id, "demo_tx_elec_dfw_panel_03");

  const unknown = selectBestGoldenDemo("00000", "landscaping");
  assert.equal(unknown.match, "global_default");
  assert.equal(unknown.case.case_id, goldenDemoCatalog.cases[0].case_id);
  assert.equal(unknown.case.case_id, "demo_ca_hvac_irvine_3ton_01");

  const portlandApp = selectBestGoldenDemo("97201", "smarthome");
  const portlandKnowledge = selectBestGoldenDemo("97201", "smart_home");
  assert.equal(portlandApp.match, "metro_and_trade");
  assert.equal(portlandApp.case.case_id, "demo_or_smart_portland_lutron_15");
  assert.equal(portlandKnowledge.case.case_id, portlandApp.case.case_id);
});

test("90210 and 92618 HVAC audits price a finite band without network", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network");
  };
  try {
    const beverlyHills = runKnowledgeBackedLocalAudit({ zipCode: "90210", tradeCategory: "hvac" });
    const irvine = runKnowledgeBackedLocalAudit({ zipCode: "92618", tradeCategory: "hvac" });
    const metro = lookupMetroByZip("90210");
    const blueprint = lookupBlueprintById("hvac_3ton_heatpump_2026");
    assert.ok(metro && blueprint);
    assert.equal(defaultBlueprintForTrade("hvac")?.blueprint_id, "hvac_3ton_heatpump_2026");
    const tier = blueprint.design_tiers.better;
    const invoiceMid = metro.labor.hvac_tech_burdened_hourly_usd.mid * (1 / (1 - 0.2));
    const equipmentLow = Math.round(tier.wholesale_bom_low_usd * 1.35 * metro.cost_indices.material_multiplier_vs_national);
    const equipmentHigh = Math.round(tier.wholesale_bom_high_usd * 1.35 * metro.cost_indices.material_multiplier_vs_national);
    const laborLow = Math.round(blueprint.standard_labor_allocation.crew_size * blueprint.standard_labor_allocation.hours_low * invoiceMid);
    const laborHigh = Math.round(blueprint.standard_labor_allocation.crew_size * blueprint.standard_labor_allocation.hours_high * invoiceMid);
    const permitLow = Math.round(
      blueprint.standard_labor_allocation.typical_permit_and_inspection_usd[0] * metro.cost_indices.permit_fee_multiplier_vs_national,
    );
    const permitHigh = Math.round(
      blueprint.standard_labor_allocation.typical_permit_and_inspection_usd[1] * metro.cost_indices.permit_fee_multiplier_vs_national,
    );
    const fairLow = Math.round((equipmentLow + laborLow + permitLow) * 0.92);
    const fairHigh = Math.round((equipmentHigh + laborHigh + permitHigh) * 1.12);

    assert.equal(fairLow, 5911);
    assert.equal(fairHigh, 10942);
    assert.equal(beverlyHills.fair_price_low_usd, fairLow);
    assert.equal(beverlyHills.fair_price_high_usd, fairHigh);
    assert.equal(irvine.fair_price_low_usd, fairLow);
    assert.equal(irvine.fair_price_high_usd, fairHigh);
    assert.equal(beverlyHills.metro_id, "msa_los_angeles_ca");
    assert.equal(beverlyHills.benchmark_id, "hvac_3ton_heatpump_2026");
    assert.equal(beverlyHills.tier, "better");
    assert.equal(beverlyHills.inference_tier, 0);
    assert.equal(beverlyHills.model, null);
    assert.equal(beverlyHills.permit_evidence_level, "E1");
    assert.equal(irvine.golden_demo_match, "metro_and_trade");
    assert.equal(irvine.golden_demo_case_id, "demo_ca_hvac_irvine_3ton_01");
    assert.equal(irvine.demo_published_range_differs, true);
    assert.match(irvine.band_note, /11,800/);
    assert.match(irvine.negotiation_script_email, /Quote Shield AI/);
    assert.ok(Number.isFinite(beverlyHills.fair_price_low_usd));
    assert.ok(Number.isFinite(beverlyHills.fair_price_high_usd));

    const quoted = runKnowledgeBackedLocalAudit({
      zipCode: "92618",
      tradeCategory: "hvac",
      contractorTotalUsd: 19850,
    });
    assert.equal(quoted.fair_price_low_usd, fairLow);
    assert.equal(quoted.fair_price_high_usd, fairHigh);
    assert.equal(quoted.estimated_savings_usd, 19850 - fairHigh);
    assert.ok(quoted.red_flags.length >= 1);
    assert.ok(quoted.missing_protections.length >= 1);
    assert.notEqual(quoted.fair_price_high_usd, 14400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an unknown ZIP uses the dataset national baseline, not the old seed hourly", () => {
  const audit = runKnowledgeBackedLocalAudit({ zipCode: "00000", tradeCategory: "hvac" });
  const burdened = nationalBaselineBurdenedHourly("hvac");
  const mids = zipCostMatrix.metros.map((metro) => metro.labor.hvac_tech_burdened_hourly_usd.mid);
  const meanMid = mids.reduce((sum, value) => sum + value, 0) / mids.length;
  assert.equal(burdened.mid, meanMid);
  assert.notEqual(meanMid, 100);
  assert.equal(audit.pricing_source, "national_baseline");
  assert.equal(audit.material_multiplier, nationalBaselineIndex());
  assert.equal(audit.permit_multiplier, nationalBaselineIndex());
  assert.equal(audit.invoice_hourly_usd.mid, calibrateHomeownerInvoiceHourly(burdened).mid);
  assert.equal(audit.golden_demo_match, "trade");
  assert.ok(Number.isFinite(audit.fair_price_low_usd));
  assert.ok(audit.fair_price_high_usd >= audit.fair_price_low_usd);

  const denver = runKnowledgeBackedLocalAudit({ zipCode: "80014", tradeCategory: "plumbing" });
  assert.equal(denver.metro_id, "msa_denver_co");
  assert.equal(denver.permit_evidence_level, "E4");
});
