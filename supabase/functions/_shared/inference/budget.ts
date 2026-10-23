import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export class TokenBudgetExceededError extends Error {
  readonly code = "TOKEN_BUDGET_EXCEEDED";
  readonly status = 402;
  constructor() {
    super("Daily or monthly audit capacity is used up. No model call was made.");
    this.name = "TokenBudgetExceededError";
  }
}

export class BudgetCheckError extends Error {
  readonly code = "BUDGET_CHECK_FAILED";
  readonly status = 503;
  constructor() {
    super("Could not verify the token budget, so no model call was made.");
    this.name = "BudgetCheckError";
  }
}

function startOfUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function sumSpend(db: SupabaseClient, userId: string | null, sinceIso: string): Promise<number> {
  let query = db.from("token_usage_ledger").select("estimated_cost_usd").gte("created_at", sinceIso);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) {
    console.error("budget read failed", error.message.slice(0, 160));
    throw new BudgetCheckError();
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
}

/** Blocks the provider call when today's spend is at or over the seeded ceilings. */
export async function assertWithinBudget(db: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await db
    .from("token_budgets")
    .select("id, scope, user_id, daily_soft_cap_usd, monthly_hard_cap_usd");
  if (error || !data) {
    console.error("budget table read failed", error?.message?.slice(0, 160) ?? "empty");
    throw new BudgetCheckError();
  }
  const userRow = data.find((row) => row.user_id === userId) ?? data.find((row) => row.id === "default_user");
  const globalRow = data.find((row) => row.id === "global");
  if (!userRow || !globalRow) throw new BudgetCheckError();

  const [userDay, userMonth, globalDay, globalMonth] = await Promise.all([
    sumSpend(db, userId, startOfUtcDay()),
    sumSpend(db, userId, startOfUtcMonth()),
    sumSpend(db, null, startOfUtcDay()),
    sumSpend(db, null, startOfUtcMonth()),
  ]);

  const over =
    userDay >= Number(userRow.daily_soft_cap_usd) ||
    userMonth >= Number(userRow.monthly_hard_cap_usd) ||
    globalDay >= Number(globalRow.daily_soft_cap_usd) ||
    globalMonth >= Number(globalRow.monthly_hard_cap_usd);

  if (over) throw new TokenBudgetExceededError();
}

export async function writeLedger(
  db: SupabaseClient,
  row: {
    userId: string;
    auditId: string | null;
    provider: string;
    model: string;
    tier: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
    cacheHit: boolean;
  },
): Promise<boolean> {
  const { error } = await db.from("token_usage_ledger").insert({
    user_id: row.userId,
    audit_id: row.auditId,
    provider: row.provider,
    model: row.model,
    tier: row.tier,
    prompt_tokens: row.promptTokens,
    completion_tokens: row.completionTokens,
    estimated_cost_usd: row.estimatedCostUsd,
    cache_hit: row.cacheHit,
  });
  if (error) {
    console.error("ledger insert failed", error.message.slice(0, 160));
    return false;
  }
  return true;
}
