import assert from "node:assert/strict";
import { test } from "node:test";
import { demoClientAudit, demoFullJson } from "../fixtures/demoQuote.ts";
import {
  benchmarkById,
  benchmarksForTrade,
  computeFairBand,
  lookupZip,
  reconcileModelNumbers,
  selectBenchmark,
  stripForClient,
} from "./auditEngine.ts";

test("Los Angeles 3-ton heat pump fair band matches the ZIP table", () => {
  const band = computeFairBand(benchmarkById("hvac_heatpump_3ton"), lookupZip("90210"));
  assert.equal(lookupZip("90210").metroName, "Los Angeles Metro");
  assert.equal(lookupZip("90210").zipPrefix, "900");
  assert.equal(band.equipmentLow, 4158);
  assert.equal(band.equipmentHigh, 6831);
  assert.equal(band.laborLow, 1500);
  assert.equal(band.laborHigh, 3700);
  assert.equal(band.fairLow, 5658);
  assert.equal(band.fairHigh, 10531);
});

test("unknown ZIP prefixes fall back to DEFAULT", () => {
  assert.equal(lookupZip("30301").zipPrefix, "DEFAULT");
  assert.equal(lookupZip("94105").metroName, "San Francisco Bay Area");
});

test("every trade has a primary benchmark", () => {
  for (const trade of ["hvac", "electrical", "smarthome", "plumbing", "roofing"]) {
    const rows = benchmarksForTrade(trade);
    assert.ok(rows.length >= 1);
    const primary = selectBenchmark(trade, "", rows);
    assert.equal(primary.tradeCategory, trade);
    const band = computeFairBand(primary, lookupZip("10001"));
    assert.ok(band.fairHigh >= band.fairLow);
    assert.ok(band.fairLow > 0);
  }
});

test("demo quote is the Los Angeles HVAC $16,800 fixture", () => {
  const demo = demoFullJson;
  assert.equal(demo.contractor_total_usd, 16800);
  assert.equal(demo.fair_price_low_usd, 5658);
  assert.equal(demo.fair_price_high_usd, 10531);
  assert.equal(demo.gap_above_ceiling_usd, 6269);
  assert.equal(demo.savings_low_usd, 2850);
  assert.equal(demo.savings_high_usd, 4200);
  assert.ok(demo.estimated_savings_usd >= 2850 && demo.estimated_savings_usd <= 4200);
  assert.equal(demo.risk_score, 86);
  const highs = demo.red_flags.filter((flag) => flag.severity === "HIGH");
  assert.equal(highs.length, 3);
  assert.ok(highs.some((flag) => /labor/i.test(flag.title)));
  assert.ok(highs.some((flag) => /markup|equipment/i.test(flag.title)));
  assert.ok(highs.some((flag) => /permit|warranty|refrigerant/i.test(flag.title)));
  const flagged = highs.reduce((sum, flag) => sum + flag.potential_overcharge_usd, 0);
  assert.equal(flagged, demo.estimated_savings_usd);
  assert.equal(
    demo.line_items_breakdown.reduce((sum, line) => sum + line.quoted_usd, 0),
    16800,
  );
  assert.match(demo.negotiation_script_email, /90210/);
  assert.match(demo.negotiation_script_sms, /Quote|quote|sign/i);
  assert.equal(demo.inference_tier, 0);
  assert.equal(demo.model, null);
});

test("absurd model prices are clamped back to Tier 0", () => {
  const band = computeFairBand(benchmarkById("hvac_heatpump_3ton"), lookupZip("90210"));
  const absurd = reconcileModelNumbers({
    contractorTotal: 16800,
    modelFairLow: 100,
    modelFairHigh: 90000,
    modelSavings: 80000,
    band,
    flags: [],
  });
  assert.equal(absurd.fairLow, 5658);
  assert.equal(absurd.fairHigh, 10531);
  assert.equal(absurd.savings, 6269);
  assert.equal(absurd.clamped, true);

  const nudged = reconcileModelNumbers({
    contractorTotal: 16800,
    modelFairLow: Math.round(band.fairLow * 1.1),
    modelFairHigh: Math.round(band.fairHigh * 1.1),
    modelSavings: 6269,
    band,
    flags: [],
  });
  assert.equal(nudged.fairLow, Math.round(band.fairLow * 1.1));
  assert.equal(nudged.fairHigh, Math.round(band.fairHigh * 1.1));
});

test("locked payload drops insider numbers", () => {
  const full = demoClientAudit();
  const locked = stripForClient(full);
  const raw = JSON.stringify(locked);
  assert.equal(raw.includes("fair_benchmark_usd"), false);
  assert.equal(raw.includes("what_to_ask"), false);
  assert.equal(raw.includes("insider_explanation"), false);
  assert.equal(raw.includes("negotiation_script"), false);
  assert.equal(raw.includes("fair_price"), false);
  assert.equal(raw.includes("5658"), false);
  assert.equal(raw.includes("10531"), false);
  assert.equal(raw.includes("band_note"), false);
  assert.equal(locked.contractor_total_usd, 16800);
  assert.equal(locked.red_flag_count, 3);
  assert.equal(locked.teaser_red_flag_titles.length, 3);
  assert.equal(locked.is_unlocked, false);
  assert.ok(locked.estimated_savings_usd >= 2850 && locked.estimated_savings_usd <= 4200);
});
