import assert from "node:assert/strict";
import { test } from "node:test";
import { runKnowledgeBackedLocalAudit } from "../../../../src/engines/quoteShieldCore.ts";
import {
  calibrateHomeownerInvoiceHourly,
  lookupBlueprintById,
  lookupMetroByZip,
} from "../../../../src/knowledge/knowledgeAdapter.ts";
import { DAILY_CLOUD_AUDIT_LIMIT, decideAiQuota, shouldConsumeCloudQuota } from "../quotaDecision.ts";
import { buildGroundTruthPrompt, clampModelAuditToGroundTruth, resolveGroundTruth } from "./groundTruth.ts";

test("quota decision denies the 4th cloud audit and denies unpaid users", () => {
  assert.equal(DAILY_CLOUD_AUDIT_LIMIT, 3);
  let usedToday = 0;
  for (let call = 1; call <= 3; call += 1) {
    const decision = decideAiQuota({ isPaid: true, usedToday });
    assert.equal(decision.allowed, true, `call ${call} should be allowed`);
    assert.equal(decision.consume, true);
    assert.equal(decision.remaining, DAILY_CLOUD_AUDIT_LIMIT - usedToday - 1);
    usedToday += 1;
  }
  const fourth = decideAiQuota({ isPaid: true, usedToday });
  assert.equal(usedToday, 3);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.remaining, 0);
  assert.equal(fourth.consume, false);

  const unpaid = decideAiQuota({ isPaid: false, usedToday: 0 });
  assert.equal(unpaid.allowed, false);
  assert.equal(unpaid.remaining, 0);
  assert.equal(unpaid.consume, false);

  const unpaidWithRoom = decideAiQuota({ isPaid: false, usedToday: 1, dailyLimit: 3 });
  assert.equal(unpaidWithRoom.allowed, false);
  assert.equal(unpaidWithRoom.remaining, 0);
  assert.equal(unpaidWithRoom.consume, false);
});

test("demo requests and cache hits do not consume cloud quota", () => {
  assert.equal(shouldConsumeCloudQuota({ demo: true, cacheHit: false }), false);
  assert.equal(shouldConsumeCloudQuota({ demo: false, cacheHit: true }), false);
  assert.equal(shouldConsumeCloudQuota({ demo: true, cacheHit: true }), false);
  assert.equal(shouldConsumeCloudQuota({ demo: false, cacheHit: false }), true);
});

test("90210 HVAC ground-truth prompt uses the Los Angeles invoice hourly and the heat-pump blueprint", () => {
  const metro = lookupMetroByZip("90210");
  const blueprint = lookupBlueprintById("hvac_3ton_heatpump_2026");
  assert.ok(metro);
  assert.ok(blueprint);
  assert.match(metro.metro_name, /Los Angeles/);

  const burdened = metro.labor.hvac_tech_burdened_hourly_usd;
  const invoice = calibrateHomeownerInvoiceHourly(burdened);
  assert.equal(invoice.mid, burdened.mid * 1.25);

  const truth = resolveGroundTruth("90210", "hvac");
  assert.ok(truth);
  assert.equal(truth.blueprintId, "hvac_3ton_heatpump_2026");
  assert.equal(truth.tier, "better");
  assert.equal(truth.invoiceHourly.mid, invoice.mid);
  assert.equal(truth.invoiceHourly.low, invoice.low);
  assert.equal(truth.invoiceHourly.high, invoice.high);
  assert.equal(truth.permitEvidenceLevel, metro.permits.evidence_level);

  const local = runKnowledgeBackedLocalAudit({ zipCode: "90210", tradeCategory: "hvac" });
  assert.equal(truth.fairLow, local.fair_price_low_usd);
  assert.equal(truth.fairHigh, local.fair_price_high_usd);
  assert.equal(truth.equipmentLow, local.equipment_low_usd);
  assert.equal(truth.equipmentHigh, local.equipment_high_usd);
  assert.equal(truth.laborLow, local.labor_low_usd);
  assert.equal(truth.laborHigh, local.labor_high_usd);
  assert.equal(truth.permitLow, local.permit_low_usd);
  assert.equal(truth.permitHigh, local.permit_high_usd);

  const prompt = buildGroundTruthPrompt(truth);
  assert.match(prompt, /Quote Shield AI/);
  assert.match(prompt, /Los Angeles/);
  assert.match(prompt, /90210/);
  assert.match(prompt, /hvac_3ton_heatpump_2026/);
  assert.ok(prompt.includes(String(Math.round(invoice.mid * 100) / 100)));
  assert.match(prompt, /only price authority/i);
  assert.ok(prompt.includes(String(truth.fairLow)));
  assert.ok(prompt.includes(String(truth.fairHigh)));
  assert.ok(prompt.includes(metro.permits.evidence_level));

  const trap = blueprint.common_contractor_padding_traps.find((item) => /R-454B|2026/.test(item.trap_name));
  assert.ok(trap, "expected a 2026 trap on the HVAC blueprint");
  assert.ok(prompt.includes(trap.trap_name));
  assert.match(blueprint.common_contractor_padding_traps.map((item) => item.trap_name).join("\n"), /R-454B/);
  assert.match(prompt, /R-454B/);
});

test("smarthome and smart_home resolve the same blueprint", () => {
  const app = resolveGroundTruth("90210", "smarthome");
  const knowledge = resolveGroundTruth("90210", "smart_home");
  assert.ok(app && knowledge);
  assert.equal(app.blueprintId, knowledge.blueprintId);
  assert.equal(app.trade, "smart_home");
});

test("a model fair band more than 15% off 90210 HVAC is clamped to the knowledge formula", () => {
  const truth = resolveGroundTruth("90210", "hvac");
  assert.ok(truth);
  const email = "Hello — please revise this quote. Quote Shield AI";
  const drifted = clampModelAuditToGroundTruth({
    modelName: "gpt-4o",
    truth,
    audit: {
      contractor_total_usd: 16800,
      fair_price_low_usd: 100,
      fair_price_high_usd: 90000,
      estimated_savings_usd: 80000,
      risk_score: 80,
      red_flags: [
        {
          title: "2026 A2L Refrigerant (R-454B/R-32) Sensor / Mitigation Board Gouging",
          severity: "HIGH",
          quoted_amount_usd: 1500,
          fair_benchmark_usd: 9000,
          potential_overcharge_usd: 0,
          insider_explanation: "Sensor line is padded.",
          what_to_ask: "Please reprice the sensor.",
        },
      ],
      missing_protections: ["Manual J"],
      line_items_breakdown: [{ description: "Heat pump", quoted_usd: 16800, note: "Lump sum" }],
      negotiation_script_email: email,
      negotiation_script_sms: "Please revise the HVAC quote.",
    },
  });
  assert.ok(drifted);
  assert.equal(drifted.fair_price_low_usd, truth.fairLow);
  assert.equal(drifted.fair_price_high_usd, truth.fairHigh);
  assert.equal(drifted.negotiation_script_email, email);
  assert.equal(drifted.benchmark_id, "hvac_3ton_heatpump_2026");
  assert.equal(drifted.red_flags[0]?.fair_benchmark_usd, 350);

  const nudgedLow = Math.round(truth.fairLow * 1.1);
  const nudgedHigh = Math.round(truth.fairHigh * 1.1);
  const kept = clampModelAuditToGroundTruth({
    modelName: "gpt-4o",
    truth,
    audit: {
      contractor_total_usd: 16800,
      fair_price_low_usd: nudgedLow,
      fair_price_high_usd: nudgedHigh,
      estimated_savings_usd: Math.max(0, 16800 - nudgedHigh),
      risk_score: 40,
      red_flags: [
        {
          title: "Labor Above the Regional Hourly Band",
          severity: "MEDIUM",
          quoted_amount_usd: truth.laborHigh,
          fair_benchmark_usd: truth.laborHigh,
          potential_overcharge_usd: 0,
          insider_explanation: "Labor is inside the band.",
          what_to_ask: "Please show hours.",
        },
      ],
      missing_protections: [],
      line_items_breakdown: [],
      negotiation_script_email: email,
      negotiation_script_sms: "Thanks",
    },
  });
  assert.ok(kept);
  assert.equal(kept.fair_price_low_usd, nudgedLow);
  assert.equal(kept.fair_price_high_usd, nudgedHigh);
});
