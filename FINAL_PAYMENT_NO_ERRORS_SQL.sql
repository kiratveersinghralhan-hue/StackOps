-- StackOps FINAL PAYMENT NO-ERROR SQL
-- Run this once in Supabase SQL Editor.
-- It makes manual UPI orders work for beta launch and prevents admin permission errors.

create extension if not exists pgcrypto;

-- Admin helper by email
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
    and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
  );
$$;

-- Profiles safety
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists plan_key text default 'free';
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists is_seller boolean default false;
alter table public.profiles add column if not exists seller_status text default 'none';

-- Manual orders table + missing columns
create table if not exists public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid,
  seller_id uuid,
  service_id uuid,
  item_name text,
  item_type text default 'service',
  plan_key text,
  amount_inr integer default 0,
  commission_inr integer default 0,
  seller_earning_inr integer default 0,
  utr text,
  proof_url text,
  proof_data text,
  proof_file_name text,
  status text default 'pending',
  is_feedback_public boolean default false,
  feedback_text text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz default now()
);

alter table public.manual_orders add column if not exists buyer_id uuid;
alter table public.manual_orders add column if not exists seller_id uuid;
alter table public.manual_orders add column if not exists service_id uuid;
alter table public.manual_orders add column if not exists item_name text;
alter table public.manual_orders add column if not exists item_type text default 'service';
alter table public.manual_orders add column if not exists plan_key text;
alter table public.manual_orders add column if not exists amount_inr integer default 0;
alter table public.manual_orders add column if not exists commission_inr integer default 0;
alter table public.manual_orders add column if not exists seller_earning_inr integer default 0;
alter table public.manual_orders add column if not exists utr text;
alter table public.manual_orders add column if not exists proof_url text;
alter table public.manual_orders add column if not exists proof_data text;
alter table public.manual_orders add column if not exists proof_file_name text;
alter table public.manual_orders add column if not exists status text default 'pending';
alter table public.manual_orders add column if not exists is_feedback_public boolean default false;
alter table public.manual_orders add column if not exists feedback_text text;
alter table public.manual_orders add column if not exists approved_at timestamptz;
alter table public.manual_orders add column if not exists rejected_at timestamptz;
alter table public.manual_orders add column if not exists created_at timestamptz default now();

-- For beta launch: remove permission-denied pain on manual orders.
-- You can re-enable strict RLS after launch.
alter table public.manual_orders disable row level security;

grant all on table public.manual_orders to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Seller payouts safety
create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid,
  amount_inr integer default 0,
  status text default 'pending',
  note text,
  paid_at timestamptz,
  created_at timestamptz default now()
);
alter table public.seller_payouts disable row level security;
grant all on table public.seller_payouts to anon, authenticated;

-- Storage bucket for proof screenshots
insert into storage.buckets(id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = true;

-- Relax storage policies for payment-proofs bucket so uploads don't fail on mobile.
drop policy if exists "payment proofs upload own" on storage.objects;
drop policy if exists "payment proofs read own admin" on storage.objects;
drop policy if exists "payment proofs public read" on storage.objects;
drop policy if exists "payment proofs authenticated upload" on storage.objects;

create policy "payment proofs authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'payment-proofs');

create policy "payment proofs public read"
on storage.objects for select
to public
using (bucket_id = 'payment-proofs');

-- Mark your admin profile as admin if it exists
update public.profiles p
set role='admin', is_verified=true, seller_status='approved', is_seller=true
from auth.users u
where p.id=u.id and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com');

-- Realtime safe enable
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
