export const extractSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contractor_total_usd", "line_items", "visible_clauses", "confidence", "image_unreadable"],
  properties: {
    contractor_total_usd: { type: "number" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "amount_usd"],
        properties: {
          description: { type: "string" },
          amount_usd: { type: "number" },
        },
      },
    },
    visible_clauses: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    image_unreadable: { type: "boolean" },
  },
} as const;

export const auditSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contractor_total_usd",
    "fair_price_low_usd",
    "fair_price_high_usd",
    "estimated_savings_usd",
    "risk_score",
    "red_flags",
    "missing_protections",
    "line_items_breakdown",
    "negotiation_script_email",
    "negotiation_script_sms",
  ],
  properties: {
    contractor_total_usd: { type: "number" },
    fair_price_low_usd: { type: "number" },
    fair_price_high_usd: { type: "number" },
    estimated_savings_usd: { type: "number" },
    risk_score: { type: "number" },
    red_flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "severity",
          "quoted_amount_usd",
          "fair_benchmark_usd",
          "potential_overcharge_usd",
          "insider_explanation",
          "what_to_ask",
        ],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["HIGH", "MEDIUM"] },
          quoted_amount_usd: { type: "number" },
          fair_benchmark_usd: { type: "number" },
          potential_overcharge_usd: { type: "number" },
          insider_explanation: { type: "string" },
          what_to_ask: { type: "string" },
        },
      },
    },
    missing_protections: { type: "array", items: { type: "string" } },
    line_items_breakdown: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quoted_usd", "note"],
        properties: {
          description: { type: "string" },
          quoted_usd: { type: "number" },
          fair_low_usd: { type: ["number", "null"] },
          fair_high_usd: { type: ["number", "null"] },
          note: { type: "string" },
        },
      },
    },
    negotiation_script_email: { type: "string" },
    negotiation_script_sms: { type: "string" },
  },
} as const;
