export type TradeId = "hvac" | "electrical" | "smarthome" | "plumbing" | "roofing";

export type Severity = "HIGH" | "MEDIUM";

export type InferenceTier = 0 | 1 | 2;

export interface RedFlag {
  title: string;
  severity: Severity;
  quoted_amount_usd: number;
  fair_benchmark_usd: number;
  potential_overcharge_usd: number;
  insider_explanation: string;
  what_to_ask: string;
}

export interface LineItemBreakdown {
  description: string;
  quoted_usd: number;
  fair_low_usd: number | null;
  fair_high_usd: number | null;
  note: string;
}

/** Full audit stored in quote_audits.full_audit_json. Insider fields stay server-side until unlock. */
export interface FullAuditJson {
  contractor_total_usd: number;
  fair_price_low_usd: number;
  fair_price_high_usd: number;
  estimated_savings_usd: number;
  savings_low_usd: number;
  savings_high_usd: number;
  gap_above_ceiling_usd: number;
  gap_above_floor_usd: number;
  risk_score: number;
  red_flags: RedFlag[];
  missing_protections: string[];
  line_items_breakdown: LineItemBreakdown[];
  negotiation_script_email: string;
  negotiation_script_sms: string;
  benchmark_id: string;
  metro_name: string;
  band_note: string;
  inference_tier: InferenceTier;
  model: string | null;
}

export interface QuoteAuditRecord {
  id: string;
  user_id: string;
  zip_code: string;
  trade_category: string;
  image_storage_path: string | null;
  contractor_total_usd: number;
  fair_price_low_usd: number;
  fair_price_high_usd: number;
  estimated_savings_usd: number;
  savings_low_usd: number;
  savings_high_usd: number;
  risk_score: number;
  red_flag_count: number;
  teaser_red_flag_titles: string[];
  is_unlocked: boolean;
  full_audit_json: FullAuditJson;
  created_at: string;
}

export interface ClientRedFlag {
  title: string;
  severity: Severity;
  quoted_amount_usd?: number;
  fair_benchmark_usd?: number;
  potential_overcharge_usd?: number;
  insider_explanation?: string;
  what_to_ask?: string;
}

/** Payload the app renders. Locked responses omit insider keys entirely. */
export interface ClientAudit {
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
  is_unlocked: boolean;
  red_flags: ClientRedFlag[];
  created_at: string;
  demo?: boolean;
  fair_price_low_usd?: number;
  fair_price_high_usd?: number;
  gap_above_ceiling_usd?: number;
  gap_above_floor_usd?: number;
  missing_protections?: string[];
  line_items_breakdown?: LineItemBreakdown[];
  negotiation_script_email?: string;
  negotiation_script_sms?: string;
  band_note?: string;
  full_audit_json?: FullAuditJson;
}

export interface AuditRequestBody {
  demo?: boolean;
  zipCode: string;
  tradeCategory: TradeId;
  imageBase64?: string;
  mimeType?: string;
  quizAnswers?: Record<string, string>;
  devUnlock?: boolean;
  revenueCatAppUserId?: string;
}
