/**
 * Public marketing copy for Quote Shield AI.
 * Prices and the disclaimer match src/config/vertical.config.ts.
 * The support mailbox is the address named in DEPLOYMENT_AND_WEB_SPEC.md.
 * The GitHub repo may stay QuoteShieldAI. The product name on these pages does not.
 */

export const site = {
  name: "Quote Shield AI",
  url: "https://quoteshieldai.qianjia.com",
  supportEmail: "support@robot0.com",
  responseHours: 24,
  effectiveDate: "October 23, 2026",
  disclaimer:
    "Quote Shield AI provides statistical cost benchmarks and educational negotiation templates based on regional industry data. It does not constitute legal, engineering, or licensed building inspection advice.",
  neutralLine: "100% homeowner-neutral. Zero contractor kickbacks.",
  trades: ["HVAC", "Electrical Panel", "Smart Home", "Plumbing", "Roofing"] as const,
  projectPass: {
    name: "Project Pro Pass",
    price: "$39.99",
    detail: "One-time purchase. Fair-price table and educational negotiation templates for your audits.",
  },
  weekly: {
    name: "Weekly Auditor",
    price: "$9.99",
    period: "week",
    trialDays: 3,
    detail: "Auto-renewable weekly subscription after a 3-day free trial when the App Store product includes that intro offer.",
  },
  entitlementId: "pro_audit",
  cloudAuditsPerUtcDay: 3,
} as const;

export const paths = {
  home: "/",
  support: "/support",
  privacy: "/privacy",
  terms: "/terms",
  download: "/#download",
} as const;
