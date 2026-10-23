-- Quote Shield AI
-- Create the Supabase project in us-east-1 (N. Virginia) so US homeowners get the lowest latency.
-- This migration cannot set the project region; pick us-east-1 when the project is created.
--
-- Auth notes:
--   Enable Anonymous sign-ins so the app can call auth.signInAnonymously() before the first scan.
--   Enable the Apple provider if you want a recoverable login later. Do not require it before the teaser.
--   Service-role writes bypass RLS. The mobile app uses the anon/publishable key and can only read its own audits.
--
-- Keep these seed numbers in sync with src/engine/auditEngine.ts (the offline mirror).

create extension if not exists "uuid-ossp";

-- Regional labor and material multipliers. Prefix is the first 3 ZIP digits, or DEFAULT.
create table if not exists public.us_zip_multipliers (
  zip_prefix text primary key,
  state_code text not null,
  metro_name text not null,
  labor_multiplier numeric(4,2) not null default 1.00,
  material_multiplier numeric(4,2) not null default 1.00,
  typical_hourly_rate_low integer not null,
  typical_hourly_rate_high integer not null
);

comment on table public.us_zip_multipliers is
  'Quote Shield AI regional multipliers. typical_hourly_rate is already local; do not apply labor_multiplier a second time.';

insert into public.us_zip_multipliers (
  zip_prefix, state_code, metro_name, labor_multiplier, material_multiplier, typical_hourly_rate_low, typical_hourly_rate_high
) values
  ('900', 'CA', 'Los Angeles Metro', 1.35, 1.10, 125, 185),
  ('941', 'CA', 'San Francisco Bay Area', 1.50, 1.15, 145, 220),
  ('100', 'NY', 'New York City Metro', 1.45, 1.12, 140, 210),
  ('750', 'TX', 'Dallas-Fort Worth', 0.95, 0.98, 95, 145),
  ('770', 'TX', 'Houston Metro', 0.92, 0.96, 90, 140),
  ('331', 'FL', 'Miami / South Florida', 1.08, 1.05, 105, 160),
  ('981', 'WA', 'Seattle Metro', 1.32, 1.08, 130, 190),
  ('DEFAULT', 'US', 'US National Average', 1.00, 1.00, 100, 155)
on conflict (zip_prefix) do nothing;

-- Residential trade benchmarks. HVAC, electrical, and smart home match the product brief.
-- Plumbing and roofing rows are added so all five trades resolve a Tier 0 band.
create table if not exists public.trade_benchmarks (
  id text primary key,
  trade_category text not null,
  item_name text not null,
  wholesale_equipment_low integer not null,
  wholesale_equipment_high integer not null,
  standard_labor_hours_low numeric(5,1) not null,
  standard_labor_hours_high numeric(5,1) not null,
  reasonable_markup_pct integer default 35,
  mandatory_clauses jsonb not null
);

comment on table public.trade_benchmarks is
  'Quote Shield AI wholesale and labor benchmarks. The model may not replace these rates.';

insert into public.trade_benchmarks (
  id, trade_category, item_name, wholesale_equipment_low, wholesale_equipment_high,
  standard_labor_hours_low, standard_labor_hours_high, reasonable_markup_pct, mandatory_clauses
) values
  (
    'hvac_heatpump_3ton', 'hvac', '3-Ton Central Heat Pump / AC Replacement',
    2800, 4600, 12.0, 20.0, 35,
    '["Manual J Load Calculation provided", "City permit & inspection fee included", "10-Year Manufacturer Parts Warranty registration", "Old refrigerant recovery & disposal included"]'::jsonb
  ),
  (
    'elec_panel_200a', 'electrical', '200A Main Breaker Panel & Service Upgrade',
    650, 1200, 8.0, 14.0, 35,
    '["Utility company disconnect/reconnect coordination", "NEC 2023 Whole-Home Surge Protector included", "Electrical permit & final city inspection", "Arc-Fault (AFCI) breakers labeled clearly"]'::jsonb
  ),
  (
    'smarthome_wired', 'smarthome', 'Whole-Home Smart Lighting, Shade & Network System',
    2500, 8000, 16.0, 40.0, 30,
    '["Full Admin Passwords & Programming Source Files handover", " itemized Hardware BOM vs Programming Labor breakdown", "1-Year On-Site Calibration & Firmware Warranty"]'::jsonb
  ),
  (
    'plumbing_water_heater_50', 'plumbing', '50-Gallon Water Heater Replacement',
    650, 1400, 4.0, 8.0, 35,
    '["Permit pulled when the fuel or venting changes", "Expansion tank and T&P discharge to code", "Old water heater haul-away", "Manufacturer warranty registration"]'::jsonb
  ),
  (
    'plumbing_tankless', 'plumbing', 'Tankless Gas Water Heater Install',
    1100, 2400, 8.0, 16.0, 35,
    '["Gas line and venting sized for the unit", "Permit and inspection included", "Condensate neutralization where required", "Flush valves and warranty registration"]'::jsonb
  ),
  (
    'roofing_asphalt_30sq', 'roofing', '30-Square Architectural Shingle Replacement',
    4500, 7800, 24.0, 40.0, 30,
    '["Building permit included", "Ice-and-water shield and underlayment spec", "Manufacturer shingle warranty registration", "Decking replacement priced per sheet, not a lump sum", "Drip edge, flashing, and ventilation"]'::jsonb
  ),
  (
    'roofing_leak_repair', 'roofing', 'Localized Roof Leak and Flashing Repair',
    180, 650, 3.0, 7.0, 35,
    '["Leak location documented with photos", "Flashing and underlayment scope in writing", "Workmanship warranty stated in months", "No whole-roof upsell buried in the repair price"]'::jsonb
  )
on conflict (id) do nothing;

create table if not exists public.quote_audits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  zip_code text not null,
  trade_category text not null,
  image_storage_path text,
  contractor_total_usd numeric(10,2) not null,
  fair_price_low_usd numeric(10,2) not null,
  fair_price_high_usd numeric(10,2) not null,
  estimated_savings_usd numeric(10,2) not null,
  savings_low_usd numeric(10,2) not null,
  savings_high_usd numeric(10,2) not null,
  risk_score integer not null check (risk_score between 0 and 100),
  red_flag_count integer not null default 0,
  teaser_red_flag_titles text[] not null,
  is_unlocked boolean default false,
  full_audit_json jsonb not null,
  created_at timestamptz default now()
);

comment on table public.quote_audits is
  'Quote Shield AI audits. Fair prices and full_audit_json are stored for the owner. The edge function strips insider numbers for non-pro clients.';

comment on column public.quote_audits.savings_low_usd is
  'Public teaser: low end of the opening negotiation range.';
comment on column public.quote_audits.savings_high_usd is
  'Public teaser: high end of the opening negotiation range.';
comment on column public.quote_audits.full_audit_json is
  'Insider payload: line items, fair benchmarks, overcharge dollars, explanations, and negotiation scripts.';

create index if not exists quote_audits_user_created_idx
  on public.quote_audits (user_id, created_at desc);

-- Token cost control. Demo audits do not insert spend rows.
create table if not exists public.token_usage_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
  audit_id uuid,
  provider text not null,
  model text not null,
  tier smallint not null check (tier in (0, 1, 2)),
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.token_usage_ledger is
  'Quote Shield AI token ledger. Never store API keys or image bytes here.';

create index if not exists token_usage_ledger_user_created_idx
  on public.token_usage_ledger (user_id, created_at desc);
create index if not exists token_usage_ledger_created_idx
  on public.token_usage_ledger (created_at desc);

create table if not exists public.token_budgets (
  id text primary key,
  scope text not null check (scope in ('global', 'default_user', 'user')),
  user_id uuid,
  daily_soft_cap_usd numeric(12,4) not null,
  monthly_hard_cap_usd numeric(12,4) not null,
  created_at timestamptz not null default now()
);

comment on table public.token_budgets is
  'Quote Shield AI spend ceilings. The daily soft cap blocks new model calls for the rest of the UTC day.';

create unique index if not exists token_budgets_user_idx
  on public.token_budgets (user_id)
  where user_id is not null;

insert into public.token_budgets (id, scope, user_id, daily_soft_cap_usd, monthly_hard_cap_usd) values
  ('global', 'global', null, 25.0000, 400.0000),
  ('default_user', 'default_user', null, 1.5000, 15.0000)
on conflict (id) do nothing;

-- Hash of image bytes + ZIP + trade. The image itself is not stored.
create table if not exists public.inference_cache (
  cache_key text primary key,
  zip_code text not null,
  trade_category text not null,
  full_audit_json jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.inference_cache is
  'Quote Shield AI inference cache. cache_key is a SHA-256 of the image bytes, ZIP, and trade.';

alter table public.us_zip_multipliers enable row level security;
alter table public.trade_benchmarks enable row level security;
alter table public.quote_audits enable row level security;
alter table public.token_usage_ledger enable row level security;
alter table public.token_budgets enable row level security;
alter table public.inference_cache enable row level security;

revoke all on table public.us_zip_multipliers from anon, authenticated;
revoke all on table public.trade_benchmarks from anon, authenticated;
revoke all on table public.quote_audits from anon, authenticated;
revoke all on table public.token_usage_ledger from anon, authenticated;
revoke all on table public.token_budgets from anon, authenticated;
revoke all on table public.inference_cache from anon, authenticated;

grant select on table public.us_zip_multipliers to anon, authenticated;
grant select on table public.trade_benchmarks to anon, authenticated;
grant select on table public.quote_audits to authenticated;

grant all privileges on table public.us_zip_multipliers to service_role;
grant all privileges on table public.trade_benchmarks to service_role;
grant all privileges on table public.quote_audits to service_role;
grant all privileges on table public.token_usage_ledger to service_role;
grant all privileges on table public.token_budgets to service_role;
grant all privileges on table public.inference_cache to service_role;

drop policy if exists "quote_shield_ai_zip_read" on public.us_zip_multipliers;
create policy "quote_shield_ai_zip_read"
  on public.us_zip_multipliers
  for select
  to anon, authenticated
  using (true);

drop policy if exists "quote_shield_ai_benchmark_read" on public.trade_benchmarks;
create policy "quote_shield_ai_benchmark_read"
  on public.trade_benchmarks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "quote_shield_ai_audits_select_own" on public.quote_audits;
create policy "quote_shield_ai_audits_select_own"
  on public.quote_audits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policies for authenticated users.
-- The audit and unlock edge functions write with the service role, which bypasses RLS.
-- Token ledger, budgets, and inference cache have RLS on and no policies, so the Data API denies them.

-- Storage bucket for quote photos. Objects stay private.
-- Path convention: {user_id}/{audit_id}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-images',
  'quote-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- storage.objects already has RLS on hosted Supabase. Policies let a signed-in user
-- read and write only their own folder. Upsert needs insert, select, and update.
drop policy if exists "quote_shield_ai_quote_images_insert" on storage.objects;
create policy "quote_shield_ai_quote_images_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'quote-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "quote_shield_ai_quote_images_select" on storage.objects;
create policy "quote_shield_ai_quote_images_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'quote-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "quote_shield_ai_quote_images_update" on storage.objects;
create policy "quote_shield_ai_quote_images_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'quote-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'quote-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
