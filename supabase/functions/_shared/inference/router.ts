/**
 * Quote Shield AI hybrid inference router.
 *
 * Demo — zero tokens. Try Demo Quote returns the fixture. It does not consume
 * the daily cloud quota and it does not call a model.
 * Cache hit — SHA-256 of the image bytes, ZIP, and trade. It does not consume
 * quota and it does not call a model.
 * One-Shot Merge — one strong vision call (LLM_STRONG_MODEL, default gpt-4o;
 * LLM_PROVIDER=xai selects the Grok vision model). The system prompt carries
 * the 2026 knowledge-pack ground truth. The model returns line-item pricing,
 * trap flags, and the negotiation email in one JSON object. There is no second
 * model call. Fair prices are clamped to the knowledge formula when they drift
 * more than 15%. Token spend and the daily quota are checked before that call.
 * API keys and image bytes are never logged.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { activeVertical } from "../../../../src/config/vertical.config.ts";
import { buildDemoAudit, parseModelJson, validatePersistedNumbers, type BuiltAudit } from "../../../../src/engine/auditEngine.ts";
import { assertWithinBudget, writeLedger } from "./budget.ts";
import { cacheKey, decodeBase64, readCache, writeCache } from "./cache.ts";
import { callVisionModel } from "./provider.ts";
import { auditSchema } from "./schema.ts";
import { QuotaExceededError, shouldConsumeCloudQuota } from "../quotaDecision.ts";
import { buildGroundTruthPrompt, clampModelAuditToGroundTruth, resolveGroundTruth } from "../knowledge/groundTruth.ts";

export class AuditRouteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuditRouteError";
  }
}

export interface RouteSuccess {
  audit: BuiltAudit;
  tier: 0 | 1 | 2;
  cacheHit: boolean;
  provider: string;
  model: string | null;
}

export interface QuotaRpcResult {
  allowed: boolean;
  remaining: number;
  usedToday: number;
}

interface RouteInput {
  db: SupabaseClient;
  userId: string;
  auditId: string;
  demo?: boolean;
  isPaid: boolean;
  consumeQuota: () => Promise<QuotaRpcResult>;
  zipCode: string;
  tradeCategory: string;
  imageBase64?: string;
  mimeType?: string;
  quizAnswers?: Record<string, string>;
}

function rawBase64(input: string): string {
  return input.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
}

function quizText(answers?: Record<string, string>): string {
  if (!answers) return "No quiz answers were provided.";
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") safe[key.slice(0, 40)] = value.slice(0, 80);
  }
  return `Homeowner quiz (context only, not a price source): ${JSON.stringify(safe)}`;
}

export async function routeAudit(input: RouteInput): Promise<RouteSuccess> {
  const trade = activeVertical.trades.find((item) => item.id === input.tradeCategory);
  if (!trade) {
    throw new AuditRouteError("UNKNOWN_TRADE", "Choose HVAC, Electrical Panel, Smart Home, Plumbing, or Roofing.", 400);
  }
  if (!/^\d{5}$/.test(input.zipCode)) {
    throw new AuditRouteError("BAD_ZIP", "Enter a 5-digit US ZIP code.", 400);
  }

  if (input.demo) {
    return {
      audit: buildDemoAudit({ copy: activeVertical.negotiation, tradeLabel: trade.label }),
      tier: 0,
      cacheHit: false,
      provider: "fixture",
      model: null,
    };
  }

  if (!input.imageBase64) {
    throw new AuditRouteError("IMAGE_REQUIRED", "Add a quote photo or use Try Demo Quote.", 400);
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(input.imageBase64);
  } catch (error) {
    const code = error instanceof Error ? error.message : "IMAGE_ENCODING";
    const status = code === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    throw new AuditRouteError(code, code === "PAYLOAD_TOO_LARGE" ? "That file is too large." : "The quote image could not be read.", status);
  }

  const key = await cacheKey(bytes, input.zipCode, trade.id);
  const cached = await readCache(input.db, key);
  if (cached && validatePersistedNumbers(cached)) {
    await writeLedger(input.db, {
      userId: input.userId,
      auditId: input.auditId,
      provider: "cache",
      model: "none",
      tier: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      cacheHit: true,
    });
    return { audit: cached, tier: 0, cacheHit: true, provider: "cache", model: null };
  }

  const truth = resolveGroundTruth(input.zipCode, trade.id);
  if (!truth) {
    throw new AuditRouteError("UNKNOWN_TRADE", "Choose HVAC, Electrical Panel, Smart Home, Plumbing, or Roofing.", 400);
  }

  if (!shouldConsumeCloudQuota({ demo: input.demo === true, cacheHit: false })) {
    throw new AuditRouteError("QUOTA_SKIPPED", "Demo and cache hits do not call a model.", 400);
  }

  await assertWithinBudget(input.db, input.userId);
  const quota = await input.consumeQuota();
  if (!input.isPaid || !quota.allowed) {
    throw new QuotaExceededError(
      input.isPaid
        ? "Paid Quote Shield AI members get 3 cloud audits per UTC day."
        : "Quote Shield AI could not verify the pro_audit entitlement, so no cloud audit was run.",
    );
  }

  const mime = input.mimeType || "image/jpeg";
  const image = rawBase64(input.imageBase64);
  const vision = await callVisionModel({
    tier: 2,
    schemaName: "quote_audit",
    schema: auditSchema as unknown as Record<string, unknown>,
    mimeType: mime,
    imageBase64: image,
    system: [activeVertical.systemPromptFragments.identity, buildGroundTruthPrompt(truth)].join("\n\n"),
    userText: `Audit this ${trade.label} quote for ZIP ${input.zipCode}. ${quizText(input.quizAnswers)} Quote Shield AI ground truth in the system prompt is the only price authority. Return line-item pricing, trap flags, and the negotiation email in one JSON object.`,
  });

  await writeLedger(input.db, {
    userId: input.userId,
    auditId: input.auditId,
    provider: vision.provider,
    model: vision.model,
    tier: 2,
    promptTokens: vision.promptTokens,
    completionTokens: vision.completionTokens,
    estimatedCostUsd: vision.estimatedCostUsd,
    cacheHit: false,
  });

  let parsed: unknown;
  try {
    parsed = parseModelJson(vision.content);
  } catch {
    throw new AuditRouteError("AUDIT_SCHEMA_INVALID", "The audit was missing required prices, so it was not saved.", 422);
  }
  const audit = clampModelAuditToGroundTruth({
    audit: (parsed ?? {}) as Record<string, unknown>,
    truth,
    modelName: vision.model,
  });
  if (!audit || !validatePersistedNumbers(audit)) {
    throw new AuditRouteError("AUDIT_SCHEMA_INVALID", "The audit was missing required prices, so it was not saved.", 422);
  }
  await writeCache(input.db, key, input.zipCode, trade.id, audit);
  console.log(JSON.stringify({ tier: 2, model: vision.model, cacheHit: false, oneShot: true, zipPrefix: input.zipCode.slice(0, 3), trade: trade.id }));
  return { audit, tier: 2, cacheHit: false, provider: vision.provider, model: vision.model };
}
