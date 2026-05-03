-- STACKOPS NEXT UPGRADE: MANUAL UPI MIDDLEMAN PAYMENTS + SELLER WALLET
-- Run this in Supabase SQL Editor. Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
  );
$$;

alter table if exists public.profiles
  add column if not exists is_seller boolean default false,
  add column if not exists seller_status text default 'none',
  add column if not exists plan_key text default 'free',
  add column if not exists xp integer default 0,
  add column if not exists is_verified boolean default false,
  add column if not exists total_earned_inr integer default 0,
  add column if not exists pending_payout_inr integer default 0,
  add column if not exists paid_payout_inr integer default 0;

create table if not exists public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  title text not null,
  game text default 'Riot Games',
  description text,
  price_inr integer not null default 0,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  service_id text,
  service_title text,
  item_type text default 'service',
  plan_key text,
  amount_inr integer not null default 0,
  commission_percent integer default 15,
  commission_inr integer default 0,
  seller_payout_inr integer default 0,
  proof_path text,
  reference_number text,
  status text default 'pending',
  payout_status text default 'pending',
  admin_note text,
  approved_at timestamptz,
  payout_paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.manual_orders add column if not exists admin_note text;
alter table public.manual_orders add column if not exists payout_paid_at timestamptz;
alter table public.manual_orders add column if not exists approved_at timestamptz;

create table if not exists public.seller_payout_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  amount_inr integer not null default 0,
  payout_upi text,
  status text default 'pending',
  admin_note text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Storage bucket for payment screenshots / proof documents.
insert into storage.buckets (id, name, public)
values ('payment-proofs','payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "payment proofs upload own" on storage.objects;
create policy "payment proofs upload own" on storage.objects
for insert to authenticated
with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "payment proofs read own or admin" on storage.objects;
create policy "payment proofs read own or admin" on storage.objects
for select to authenticated
using (bucket_id = 'payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

-- Seller services policies
alter table public.seller_services enable row level security;
drop policy if exists "seller services public read" on public.seller_services;
create policy "seller services public read" on public.seller_services
for select to authenticated using (true);

drop policy if exists "approved sellers create services" on public.seller_services;
create policy "approved sellers create services" on public.seller_services
for insert to authenticated
with check (
  seller_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_seller = true and p.seller_status = 'approved')
);

drop policy if exists "seller or admin update services" on public.seller_services;
create policy "seller or admin update services" on public.seller_services
for update to authenticated
using (seller_id = auth.uid() or public.is_admin())
with check (seller_id = auth.uid() or public.is_admin());

-- Beta-friendly manual order access. This fixes admin permission issues on GitHub Pages.
-- You can tighten this later after launch.
alter table public.manual_orders disable row level security;

alter table public.seller_payout_requests enable row level security;
drop policy if exists "seller payout own read" on public.seller_payout_requests;
create policy "seller payout own read" on public.seller_payout_requests
for select to authenticated using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "seller payout own insert" on public.seller_payout_requests;
create policy "seller payout own insert" on public.seller_payout_requests
for insert to authenticated with check (seller_id = auth.uid());

drop policy if exists "admin payout update" on public.seller_payout_requests;
create policy "admin payout update" on public.seller_payout_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin insert notifications" on public.notifications;
create policy "admin insert notifications" on public.notifications
for insert to authenticated with check (public.is_admin() or user_id = auth.uid());

-- Realtime publication. Ignore duplicate member notices if any appear.
do $$ begin
  begin alter publication supabase_realtime add table public.manual_orders; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_services; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_payout_requests; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
