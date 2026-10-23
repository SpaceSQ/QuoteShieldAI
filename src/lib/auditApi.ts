import { demoClientAudit } from "../fixtures/demoQuote";
import type { AuditRequestBody, ClientAudit } from "../types/audit";
import { isSupabaseConfigured, supabase } from "./supabase";

export class AuditApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly remaining: number | null = null,
  ) {
    super(message);
    this.name = "AuditApiError";
  }
}

let networkFlight: Promise<ClientAudit> | null = null;

function finiteRemaining(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asClientAudit(value: unknown): ClientAudit {
  if (!value || typeof value !== "object") {
    throw new AuditApiError("AUDIT_FAILED", "The audit response was empty.");
  }
  const row = value as ClientAudit & { code?: string; message?: string; remaining?: unknown };
  if (row.code && row.code !== "OK") {
    throw new AuditApiError(row.code, row.message || "The audit could not be completed.", finiteRemaining(row.remaining));
  }
  if (row.contractor_total_usd == null || row.risk_score == null) {
    throw new AuditApiError("AUDIT_FAILED", "The audit response was missing the teaser.");
  }
  return {
    ...row,
    contractor_total_usd: Number(row.contractor_total_usd),
    estimated_savings_usd: Number(row.estimated_savings_usd),
    savings_low_usd: Number(row.savings_low_usd),
    savings_high_usd: Number(row.savings_high_usd),
    risk_score: Number(row.risk_score),
    red_flag_count: Number(row.red_flag_count),
    fair_price_low_usd: row.fair_price_low_usd == null ? undefined : Number(row.fair_price_low_usd),
    fair_price_high_usd: row.fair_price_high_usd == null ? undefined : Number(row.fair_price_high_usd),
  };
}

async function errorFromInvoke(error: unknown): Promise<AuditApiError> {
  const fallback = error instanceof Error ? error.message : "The audit could not be completed.";
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { code?: string; message?: string; remaining?: unknown };
      if (body?.code) return new AuditApiError(body.code, body.message || fallback, finiteRemaining(body.remaining));
    } catch {
      // The body was not JSON. Keep the generic message and do not log it.
    }
  }
  return new AuditApiError("AUDIT_FAILED", fallback);
}

async function runNetwork(input: AuditRequestBody): Promise<ClientAudit> {
  if (!supabase || !isSupabaseConfigured) {
    throw new AuditApiError(
      "LOCAL_DEMO",
      "This install has no Supabase project. Tap Try Demo Quote to walk through Quote Shield AI.",
    );
  }
  const { data, error } = await supabase.functions.invoke("audit-quote", { body: input });
  if (error) throw await errorFromInvoke(error);
  return asClientAudit(data);
}

/** Demo returns the on-device fixture and does not call a model or the network. */
export function requestQuoteAudit(input: AuditRequestBody): Promise<ClientAudit> {
  if (input.demo) return Promise.resolve(demoClientAudit());
  if (networkFlight) return networkFlight;
  networkFlight = runNetwork(input).finally(() => {
    networkFlight = null;
  });
  return networkFlight;
}

export async function unlockAudit(input: {
  auditId: string;
  devUnlock: boolean;
  revenueCatAppUserId?: string;
}): Promise<ClientAudit> {
  if (!supabase || !isSupabaseConfigured) {
    throw new AuditApiError("LOCAL_DEMO", "Unlock stays on this device in local demo mode.");
  }
  const { data, error } = await supabase.functions.invoke("unlock-audit", { body: input });
  if (error) throw await errorFromInvoke(error);
  return asClientAudit(data);
}
