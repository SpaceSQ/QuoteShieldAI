# Quote Shield AI

iOS-first auditor for US homeowner contractor quotes. Photograph an HVAC, electrical panel, smart home, plumbing, or roofing quote, enter a US ZIP, and see a rip-off risk score plus estimated savings. Wholesale benchmarks, exact overcharge dollars, and counter-offer scripts stay blurred until purchase.

The product name is exactly **Quote Shield AI**.

## Run the app

```bash
npm install
npx expo start
```

Then press `i` for the iOS simulator or `w` for a quick web preview. Real App Store purchases need a development build (`npx expo run:ios`); Expo Go does not include the RevenueCat native module. Without a RevenueCat key, the unlock button still reveals the built-in demo.

Copy `.env.example` to `.env` when you have a project:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`

If those are empty, the app stays in local demo mode and does not crash.

Create the Supabase project in **us-east-1**. Apply `supabase/migrations/0001_quote_shield_ai_init.sql`. Enable Anonymous sign-ins. Apple sign-in is optional and is not required before the teaser. Edge function secrets live in `supabase/functions/.env.example` (`OPENAI_API_KEY`, `XAI_API_KEY`, `LLM_PROVIDER`, `LLM_CHEAP_MODEL`, `LLM_STRONG_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Never commit real keys.

## Demo funnel

1. Answer the four onboarding cards (any answers).
2. On the scanner, tap **Try Demo Quote**.
3. Wait through the X-Ray lines (about 6 seconds). No photo and no model call.
4. The teaser shows the $16,800 Los Angeles HVAC quote, risk score, and savings range. Red-flag detail stays blurred.
5. Tap unlock. With no RevenueCat key, the fair-price table and email/SMS scripts open on device.

The fixture is `src/fixtures/demoQuote.ts`. ZIP 90210 uses the Los Angeles anchor prefix `900`.

## Hybrid inference

The app never calls OpenAI or xAI. The only model entry point is `supabase/functions/audit-quote`, which runs `supabase/functions/_shared/inference/router.ts`.

1. **Tier 0, zero tokens.** Look up the ZIP prefix on `us_zip_multipliers` (fallback `DEFAULT`) and the trade row in `trade_benchmarks`. Fair band = wholesale × material multiplier × (1 + markup) + hours × the ZIP hourly rate. That band is the price source of truth and is clamped onto model numbers afterward (`ABSURD_DRIFT` 15%, documented in `src/engine/auditEngine.ts`).
2. **Tier 1.** Unless the request is the built-in demo, call `LLM_CHEAP_MODEL` (default `gpt-4o-mini`) once to extract line items, the total, and visible clauses. A valid, confident extract is priced by Tier 0. The strong model is not called.
3. **Tier 2.** Call `LLM_STRONG_MODEL` (default `gpt-4o`) only when Tier 1 JSON fails, confidence is under 0.65, or the image is unreadable. Set `LLM_PROVIDER=xai` to use Grok vision instead.
4. **Budget.** Before each provider call, today's `token_usage_ledger` spend is compared with `token_budgets`. Over the cap returns `TOKEN_BUDGET_EXCEEDED` and does not call the provider. The demo spends nothing.
5. **Cache.** SHA-256 of image bytes + ZIP + trade is stored in `inference_cache`. A hit skips the provider and logs `cache_hit=true` with 0 tokens.

`unlock-audit` sets `is_unlocked` only after a RevenueCat `pro_audit` check, or when `ALLOW_DEV_UNLOCK=true` for a local review build. Do not enable that flag in production.

## Checks

```bash
npm test
npx tsc --noEmit
```
