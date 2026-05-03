-- StackOps Auto Premium Unlock Safe Migration
-- SQL REQUIRED: YES
-- Safe: no data delete. Adds payment verification fields, entitlements, and policies.

create extension if not exists pgcrypto;

-- Payments table + production verification fields
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  amount_inr integer not null,
  commission_inr integer default 0,
  provider text default 'razorpay',
  provider_payment_id text,
  status text default 'created',
  created_at timestamptz default now()
);

alter table public.payments add column if not exists item_name text;
alter table public.payments add column if not exists item_type text default 'service';
alter table public.payments add column if not exists plan_key text;
alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_signature text;
alter table public.payments add column if not exists razorpay_event text;
alter table public.payments add column if not exists raw_response jsonb;
alter table public.payments add column if not exists verified_at timestamptz;
alter table public.payments add column if not exists unlocked_at timestamptz;
alter table public.payments add column if not exists updated_at timestamptz default now();

-- Profile fields used by auto-unlock
alter table public.profiles add column if not exists plan_key text default 'free';
alter table public.profiles add column if not exists premium_until timestamptz;
alter table public.profiles add column if not exists xp integer default 0;
alter table public.profiles add column if not exists coins integer default 0;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists title text default 'Rookie';
alter table public.profiles add column if not exists badge text default 'Starter Spark';

-- Entitlement log: every verified payment creates an unlock record.
create table if not exists public.payment_entitlements (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  entitlement_type text not null,
  entitlement_key text not null,
  status text default 'active',
  starts_at timestamptz default now(),
  ends_at timestamptz,
  created_at timestamptz default now(),
  unique(payment_id, entitlement_type, entitlement_key)
);

-- Payment audit log for admin dashboard/debugging
create table if not exists public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  event_name text,
  provider_payment_id text,
  message text,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;
alter table public.payment_entitlements enable row level security;
alter table public.payment_audit_log enable row level security;

-- Payments policies
drop policy if exists "payments owner admin read" on public.payments;
create policy "payments owner admin read" on public.payments
for select using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "payments owner insert" on public.payments;
create policy "payments owner insert" on public.payments
for insert with check (buyer_id = auth.uid());

-- Allows only the logged-in buyer to mark their checkout as client_success.
-- Real unlock still requires Razorpay webhook verification.
drop policy if exists "payments owner update callback" on public.payments;
create policy "payments owner update callback" on public.payments
for update using (buyer_id = auth.uid() or public.is_admin())
with check (buyer_id = auth.uid() or public.is_admin());

-- Entitlements policies
drop policy if exists "entitlements owner admin read" on public.payment_entitlements;
create policy "entitlements owner admin read" on public.payment_entitlements
for select using (user_id = auth.uid() or public.is_admin());

-- Audit policies
drop policy if exists "payment audit admin read" on public.payment_audit_log;
create policy "payment audit admin read" on public.payment_audit_log
for select using (public.is_admin());

-- Safe realtime enablement
DO $$
BEGIN
  IF exists (select 1 from information_schema.tables where table_schema='public' and table_name='payments')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payments') THEN
    alter publication supabase_realtime add table public.payments;
  END IF;
  IF exists (select 1 from information_schema.tables where table_schema='public' and table_name='payment_entitlements')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payment_entitlements') THEN
    alter publication supabase_realtime add table public.payment_entitlements;
  END IF;
END $$;

-- Grants required for Supabase REST.
grant select, insert, update on public.payments to authenticated;
grant select on public.payment_entitlements to authenticated;
grant select on public.payment_audit_log to authenticated;

-- Production hardening: users should not be able to grant themselves premium/admin rewards.
-- This revokes broad profile updates and grants updates only on safe personal-profile columns that exist.
DO $$
DECLARE
  safe_cols text[] := array[
    'username','display_name','bio','avatar_url','banner_url','riot_id','region','main_game','gender','selected_banner_key','updated_at'
  ];
  cols text;
BEGIN
  REVOKE UPDATE ON public.profiles FROM authenticated;
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='profiles'
    AND column_name = ANY(safe_cols);

  IF cols IS NOT NULL THEN
    EXECUTE 'GRANT UPDATE (' || cols || ') ON public.profiles TO authenticated';
  END IF;
END $$;
