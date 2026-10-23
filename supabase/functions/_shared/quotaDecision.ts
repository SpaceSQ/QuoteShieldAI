/**
 * Quote Shield AI daily cloud-audit decision.
 * Mirrors check_and_consume_ai_quota in supabase/migrations/0002_quote_shield_ai_quota.sql.
 * Pure: no Deno, no network, no database. The SQL function is what inserts the ledger row.
 */

export const DAILY_CLOUD_AUDIT_LIMIT = 3;

export interface QuotaDecision {
  allowed: boolean;
  remaining: number;
  /** Count of ledger rows already stored for this UTC day, before this call. */
  usedToday: number;
  /** True only when the SQL function should insert one ledger row. */
  consume: boolean;
}

/**
 * Paid Quote Shield AI members may make `dailyLimit` cloud audits per UTC day (default 3).
 * The 4th call (usedToday >= limit) is denied and does not consume.
 * Unpaid callers are denied with remaining 0 and do not consume.
 */
export function decideAiQuota(input: {
  isPaid: boolean;
  usedToday: number;
  dailyLimit?: number;
}): QuotaDecision {
  const limit = normalizeLimit(input.dailyLimit ?? DAILY_CLOUD_AUDIT_LIMIT);
  const usedToday = normalizeUsed(input.usedToday);
  if (input.isPaid !== true) {
    return { allowed: false, remaining: 0, usedToday, consume: false };
  }
  if (usedToday >= limit) {
    return { allowed: false, remaining: 0, usedToday, consume: false };
  }
  return {
    allowed: true,
    remaining: limit - usedToday - 1,
    usedToday,
    consume: true,
  };
}

/** Demo quotes and cache hits must not consume a cloud audit or call a model. */
export function shouldConsumeCloudQuota(input: { demo: boolean; cacheHit: boolean }): boolean {
  return input.demo !== true && input.cacheHit !== true;
}

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  readonly status = 402;
  readonly remaining = 0;
  constructor(message = "Quote Shield AI did not run a cloud audit. Paid members get 3 cloud multimodal audits per UTC day.") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class QuotaCheckError extends Error {
  readonly code = "QUOTA_CHECK_FAILED";
  readonly status = 503;
  constructor() {
    super("Could not verify the Quote Shield AI daily audit quota, so no model call was made.");
    this.name = "QuotaCheckError";
  }
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) return DAILY_CLOUD_AUDIT_LIMIT;
  return Math.max(0, Math.floor(value));
}

function normalizeUsed(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
