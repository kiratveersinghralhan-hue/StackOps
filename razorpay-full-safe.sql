-- StackOps Razorpay Full Safe Migration
-- SQL REQUIRED: YES if your payments table does not already have these columns/policies.
-- Safe: does not delete user data.

create extension if not exists pgcrypto;

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
alter table public.payments add column if not exists raw_response jsonb;
alter table public.payments add column if not exists verified_at timestamptz;
alter table public.payments add column if not exists updated_at timestamptz default now();

alter table public.profiles add column if not exists plan_key text default 'free';

alter table public.payments enable row level security;

drop policy if exists "payments owner admin read" on public.payments;
create policy "payments owner admin read"
on public.payments for select
using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "payments owner insert" on public.payments;
create policy "payments owner insert"
on public.payments for insert
with check (buyer_id = auth.uid());

-- Allows the frontend to update its own payment row after Razorpay checkout callback.
-- For strict production, move verification to webhook/Edge Function and remove owner update.
drop policy if exists "payments owner update callback" on public.payments;
create policy "payments owner update callback"
on public.payments for update
using (buyer_id = auth.uid() or public.is_admin())
with check (buyer_id = auth.uid() or public.is_admin());

-- Optional realtime for admin revenue dashboard
DO $$
BEGIN
  IF exists (select 1 from information_schema.tables where table_schema='public' and table_name='payments')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payments') THEN
    alter publication supabase_realtime add table public.payments;
  END IF;
END $$;
