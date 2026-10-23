/**
 * Quote Shield AI factory config.
 * Trade names, onboarding questions, colors, system-prompt fragments, paywall copy,
 * and the legal disclaimer live only in this file.
 * Active vertical id: quote-shield-ai.
 * A future clone adds another object to `verticals` and changes ACTIVE_VERTICAL_ID.
 * This repository ships Quote Shield AI only.
 *
 * Imported by the Expo app and by the Deno audit function. Do not import React Native here.
 */

export interface TradeOption {
  id: "hvac" | "electrical" | "smarthome" | "plumbing" | "roofing";
  label: string;
}

export interface OnboardingOption {
  id: string;
  label: string;
  detail?: string;
}

export interface OnboardingQuestion {
  id: string;
  prompt: string;
  options: OnboardingOption[];
}

export interface NegotiationFields {
  tradeLabel: string;
  zip: string;
  metro: string;
  total: string;
  itemName: string;
  savingsLow: string;
  savingsHigh: string;
  questions: string;
  missing: string;
  fairLow: string;
  fairHigh: string;
  flagged: string;
}

export interface VerticalConfig {
  id: string;
  displayName: string;
  tagline: string;
  disclaimer: string;
  colors: {
    background: string;
    card: string;
    text: string;
    muted: string;
    accent: string;
    accentInk: string;
    danger: string;
    success: string;
  };
  permissions: {
    camera: string;
    photos: string;
  };
  trades: TradeOption[];
  onboarding: OnboardingQuestion[];
  xrayStages: string[];
  systemPromptFragments: {
    identity: string;
    priceAuthority: string;
    tier1Task: string;
    tier2Task: string;
  };
  negotiation: {
    email: (input: NegotiationFields) => string;
    sms: (input: NegotiationFields) => string;
  };
  paywall: {
    entitlementId: string;
    projectPassPackageId: string;
    weeklyPackageId: string;
    projectPassName: string;
    projectPassPrice: string;
    projectPassBadge: string;
    projectPassDetail: string;
    weeklyName: string;
    weeklyPrice: string;
    weeklyTrialPrice: string;
    weeklyBadge: string;
    weeklyTrialDetail: string;
    weeklyNoTrialDetail: string;
    trialToggleLabel: string;
    ctaTrial: string;
    ctaUnlock: string;
    restore: string;
    terms: string;
    privacy: string;
    subscriptionFinePrint: string;
  };
  legal: {
    termsTitle: string;
    privacyTitle: string;
    termsBody: string;
    privacyBody: string;
  };
}

const trades: TradeOption[] = [
  { id: "hvac", label: "HVAC" },
  { id: "electrical", label: "Electrical Panel" },
  { id: "smarthome", label: "Smart Home" },
  { id: "plumbing", label: "Plumbing" },
  { id: "roofing", label: "Roofing" },
];

const quoteShieldAi: VerticalConfig = {
  id: "quote-shield-ai",
  displayName: "Quote Shield AI",
  tagline: "See the rip-off risk in a contractor quote before you sign.",
  disclaimer:
    "Quote Shield AI provides statistical cost benchmarks and educational negotiation templates based on regional industry data. It does not constitute legal, engineering, or licensed building inspection advice.",
  colors: {
    background: "#020617",
    card: "#0F172A",
    text: "#F8FAFC",
    muted: "#94A3B8",
    accent: "#F59E0B",
    accentInk: "#0F172A",
    danger: "#EF4444",
    success: "#34D399",
  },
  permissions: {
    camera: "Quote Shield AI uses the camera to photograph a contractor quote.",
    photos: "Quote Shield AI opens your photo library so you can choose a contractor quote.",
  },
  trades,
  onboarding: [
    {
      id: "trade",
      prompt: "Which trade is this quote?",
      options: trades.map((trade) => ({ id: trade.id, label: trade.label })),
    },
    {
      id: "total_range",
      prompt: "What is the quote total range?",
      options: [
        { id: "under_3k", label: "Under $3,000" },
        { id: "3k_8k", label: "$3,000 – $8,000" },
        { id: "8k_15k", label: "$8,000 – $15,000" },
        { id: "15k_25k", label: "$15,000 – $25,000" },
        { id: "over_25k", label: "$25,000 or more" },
      ],
    },
    {
      id: "itemized",
      prompt: "Did the contractor itemize wholesale equipment vs labor hours?",
      options: [
        { id: "yes", label: "Yes — equipment and labor hours are listed separately" },
        { id: "lump", label: "No — it is one lump sum" },
        { id: "partial", label: "Only some lines are itemized" },
        { id: "unsure", label: "I can't tell from the quote" },
      ],
    },
    {
      id: "urgency",
      prompt: "How soon will you sign?",
      options: [
        { id: "today", label: "I may sign today" },
        { id: "3_days", label: "Within 3 days" },
        { id: "this_week", label: "This week" },
        { id: "comparing", label: "I'm comparing and not ready to sign" },
      ],
    },
  ],
  xrayStages: [
    "Extracting line items…",
    "Matching ZIP labor rates…",
    "Checking wholesale equipment markups…",
    "Flagging missing permit & warranty traps…",
  ],
  systemPromptFragments: {
    identity:
      "You are the document reader inside Quote Shield AI, a US homeowner contractor-quote auditor.",
    priceAuthority:
      "Deterministic ZIP multipliers and trade benchmark rows are the only price authority. Never invent regional labor rates, material multipliers, wholesale prices, or fair-price totals. If a dollar figure is not printed on the quote, do not guess it.",
    tier1Task:
      "Extract the contractor total, each visible line item with its amount, and any permit, warranty, or inclusion clauses you can actually read. Set image_unreadable to true when the photo is blank, cropped, or illegible. Set confidence from 0 to 1. Do not return fair-market prices.",
    tier2Task:
      "Return the audit as JSON only. Set fair_price_low_usd and fair_price_high_usd to the Tier 0 band in the user message. Explain overcharges only with that band and the line items you can see. Do not invent a different city rate.",
  },
  negotiation: {
    email: (input) =>
      [
        `Subject: Please revise the ${input.tradeLabel} quote for ${input.zip}`,
        "",
        "Hello,",
        "",
        `Thank you for the quote of ${input.total} for our home in ${input.metro} (${input.zip}). I compared it with regional benchmarks for a ${input.itemName} before signing.`,
        "",
        "Please send a revised, itemized quote that:",
        input.questions,
        "",
        "Protections to add in writing:",
        input.missing,
        "",
        `I can move forward this week if the revised total comes down by ${input.savingsLow} to ${input.savingsHigh} from the current ${input.total}. The flagged lines add up to about ${input.flagged}.`,
        "",
        "Thank you",
        "A homeowner, with help from Quote Shield AI",
      ].join("\n"),
    sms: (input) =>
      `Hi — thanks for the ${input.total} ${input.tradeLabel} quote for ${input.zip}. Before I sign, please split labor hours from equipment and put the missing protections in writing. If you can revise the total down by ${input.savingsLow} to ${input.savingsHigh}, I can review it this week.`,
  },
  paywall: {
    entitlementId: "pro_audit",
    projectPassPackageId: "$rc_lifetime",
    weeklyPackageId: "$rc_weekly",
    projectPassName: "Project Pro Pass",
    projectPassPrice: "$39.99",
    projectPassBadge: "Best ROI",
    projectPassDetail: "Fair-price table plus a word-for-word counter script for this quote",
    weeklyName: "Weekly Auditor",
    weeklyPrice: "$9.99/wk",
    weeklyTrialPrice: "$0 today",
    weeklyBadge: "3-day trial",
    weeklyTrialDetail: "Then $9.99/wk. Cancel anytime in Settings.",
    weeklyNoTrialDetail: "Unlimited scans and scripts for 7 days.",
    trialToggleLabel: "3-day free trial",
    ctaTrial: "Start 3-Day Free Trial & Reveal Prices",
    ctaUnlock: "Unlock My Audit & Negotiation Script Now",
    restore: "Restore Purchases",
    terms: "Terms",
    privacy: "Privacy",
    subscriptionFinePrint:
      "Weekly Auditor is $9.99 per week after a 3-day free trial and renews until you cancel at least 24 hours before the period ends. Project Pro Pass is a one-time $39.99 purchase. Apple charges your Apple ID. Manage or cancel in Settings.",
  },
  legal: {
    termsTitle: "Terms of Use",
    privacyTitle: "Privacy Policy",
    termsBody: `Quote Shield AI helps a homeowner compare a contractor quote with regional cost benchmarks and educational negotiation templates.

Quote Shield AI provides statistical cost benchmarks and educational negotiation templates based on regional industry data. It does not constitute legal, engineering, or licensed building inspection advice.

Quote Shield AI is not a contractor, law firm, or building inspector. You decide whether to sign, and you are responsible for permits, safety, and contract terms.

Project Pro Pass is a one-time in-app purchase of $39.99 that reveals the fair-price table and negotiation scripts for audits in this install. Weekly Auditor is an auto-renewable subscription at $9.99 per week with a 3-day free trial. After the trial, Apple bills $9.99 each week until you cancel. Cancel at least 24 hours before the trial or renewal ends in your Apple ID subscription settings. Payment is charged to your Apple ID. Restore Purchases is available in the paywall.

The Try Demo Quote path uses a built-in Los Angeles HVAC example and does not require a contractor photo.`,
    privacyBody: `Quote Shield AI stores an anonymous account id when Supabase is configured, so you can audit a quote before creating an email login. You can later add Apple sign-in in the Supabase Auth settings if you want a recoverable account.

Photos and PDFs are used only to read a contractor quote. When Supabase is configured, the file is sent to your Quote Shield AI project so the server-side audit function can read it. The app does not call a model provider directly. The built-in demo quote stays on this device and does not upload a photo.

Quote Shield AI records model token counts and estimated cost for budget control. It does not log API keys or the raw image payload in application logs.

Purchases are processed by Apple and RevenueCat. Quote Shield AI does not receive your card number. Camera and photo library access is requested only after you tap those buttons.

Host this policy at a public URL before App Store submission. The same text is shown in the app.`,
  },
};

export const verticals = {
  "quote-shield-ai": quoteShieldAi,
} as const;

export const ACTIVE_VERTICAL_ID = "quote-shield-ai" as const;

export const activeVertical: VerticalConfig = verticals[ACTIVE_VERTICAL_ID];

/** Screen-facing view of the active product. The stored config stays `activeVertical`. */
export const vertical = {
  displayName: activeVertical.displayName,
  tagline: activeVertical.tagline,
  disclaimer: activeVertical.disclaimer,
  neutralLine: "100% homeowner-neutral. Zero contractor kickbacks.",
  trades: activeVertical.trades,
  questions: activeVertical.onboarding,
  xrayStages: [
    "Extracting line items…",
    "Matching ZIP {zip} labor rates…",
    "Checking wholesale equipment markups…",
    "Flagging missing permit and warranty traps…",
  ],
  demoCta: "Try Demo Quote",
  demoDetail: "Los Angeles 90210 · $16,800 3-ton heat pump. No photo and no model call.",
  theme: {
    background: activeVertical.colors.background,
    amber: activeVertical.colors.accent,
    danger: activeVertical.colors.danger,
    ok: activeVertical.colors.success,
  },
  errors: {
    budget: "Today's audit capacity is used up. Try again tomorrow.",
    unreadable: "Quote Shield AI could not read that file. Photograph the full quote in even light.",
    provider: "The reader is temporarily unavailable. Try the demo quote, or come back in a few minutes.",
    imageRequired: "Add a photo, or tap Try Demo Quote.",
    imageTooLarge: "That file is too large. Retake the photo a little farther from the page.",
    zip: "Enter a 5-digit US ZIP code.",
    localOnly: "Photo audits need Supabase configured. Try Demo Quote works on this device with no network.",
    notEntitled: "This Apple ID does not have an active Quote Shield AI pass yet.",
  },
  paywall: {
    trialToggle: activeVertical.paywall.trialToggleLabel,
    projectPass: {
      badge: activeVertical.paywall.projectPassBadge,
      title: activeVertical.paywall.projectPassName,
      price: activeVertical.paywall.projectPassPrice,
      detail: activeVertical.paywall.projectPassDetail,
    },
    weekly: {
      badge: activeVertical.paywall.weeklyBadge,
      title: activeVertical.paywall.weeklyName,
      price: activeVertical.paywall.weeklyPrice,
      trialPrice: activeVertical.paywall.weeklyTrialPrice,
      trialDetail: activeVertical.paywall.weeklyTrialDetail,
      directDetail: activeVertical.paywall.weeklyNoTrialDetail,
    },
    trialCta: activeVertical.paywall.ctaTrial,
    unlockCta: activeVertical.paywall.ctaUnlock,
    restore: activeVertical.paywall.restore,
    terms: activeVertical.legal.termsTitle,
    privacy: activeVertical.legal.privacyTitle,
  },
};

export function tradeLabel(id: string): string {
  return activeVertical.trades.find((trade) => trade.id === id)?.label ?? id;
}

export function stageCopy(template: string, zip: string): string {
  return template.replace("{zip}", zip);
}

