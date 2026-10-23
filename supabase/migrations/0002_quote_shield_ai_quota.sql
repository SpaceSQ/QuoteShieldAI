-- Quote Shield AI
-- Paid members get 3 cloud multimodal audits per UTC day.
-- Demo requests and cache hits must not call this function.
-- The edge function calls it with the service role before any model request.
-- A client-supplied isPaid flag is not an input. p_is_paid is set only after a
-- server-side RevenueCat pro_audit check (or the local ALLOW_DEV_UNLOCK bypass).

create table if not exists public.ai_audit_quota_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);

comment on table public.ai_audit_quota_ledger is
  'Quote Shield AI cloud-audit attempts. One row is one multimodal audit counted against the UTC daily quota. Image bytes and API keys are never stored here.';

comment on column public.ai_audit_quota_ledger.created_at is
  'Quote Shield AI attempt time. The daily quota counts rows from UTC midnight through the next UTC midnight.';

create index if not exists ai_audit_quota_ledger_user_created_idx
  on public.ai_audit_quota_ledger (user_id, created_at desc);

alter table public.ai_audit_quota_ledger enable row level security;

revoke all on table public.ai_audit_quota_ledger from public, anon, authenticated;
grant select, insert on table public.ai_audit_quota_ledger to service_role;

-- No policies. anon and authenticated are denied. The security-definer function
-- below runs as its owner and is the only writer the edge function uses.

create or replace function public.check_and_consume_ai_quota(
  p_user uuid,
  p_is_paid boolean,
  p_daily_limit integer default 3
)
returns table (
  allowed boolean,
  remaining integer,
  used_today integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_start timestamptz;
begin
  -- Quote Shield AI: unpaid callers never insert a ledger row.
  if p_user is null or p_is_paid is not true then
    if p_user is not null then
      v_start := (date_trunc('day', (pg_catalog.now() at time zone 'utc')) at time zone 'utc');
      select count(*)::integer
        into v_used
      from public.ai_audit_quota_ledger
      where user_id = p_user
        and created_at >= v_start
        and created_at < v_start + interval '1 day';
    else
      v_used := 0;
    end if;
    return query select false::boolean, 0::integer, coalesce(v_used, 0)::integer;
    return;
  end if;

  v_limit := coalesce(p_daily_limit, 3);
  if v_limit < 0 then
    v_limit := 0;
  end if;

  -- Serialize this user's UTC day so two overlapping calls cannot both pass the limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('quote_shield_ai_quota:' || p_user::text)::bigint
  );

  v_start := (date_trunc('day', (pg_catalog.now() at time zone 'utc')) at time zone 'utc');

  select count(*)::integer
    into v_used
  from public.ai_audit_quota_ledger
  where user_id = p_user
    and created_at >= v_start
    and created_at < v_start + interval '1 day';

  if v_used >= v_limit then
    return query select false::boolean, 0::integer, v_used::integer;
    return;
  end if;

  insert into public.ai_audit_quota_ledger (user_id)
  values (p_user);

  -- used_today is the count before this insert.
  -- remaining = daily limit - used_today - 1.
  return query select true::boolean, (v_limit - v_used - 1)::integer, v_used::integer;
end;
$$;

comment on function public.check_and_consume_ai_quota(uuid, boolean, integer) is
  'Quote Shield AI daily cloud-audit quota. Signature: check_and_consume_ai_quota(p_user uuid, p_is_paid boolean, p_daily_limit integer default 3) returns table (allowed boolean, remaining integer, used_today integer). Unpaid callers and callers at the limit are denied and no row is inserted. On allow, one row is inserted and remaining = p_daily_limit - used_today - 1.';

revoke all on function public.check_and_consume_ai_quota(uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.check_and_consume_ai_quota(uuid, boolean, integer) to service_role;
