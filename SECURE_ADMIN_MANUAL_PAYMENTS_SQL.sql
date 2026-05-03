-- STACKOPS SECURE ADMIN SYSTEM + MANUAL UPI PAYMENTS
-- Run this once in Supabase SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

-- Admin helper based on your two admin emails.
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

-- Profiles needed by admin, seller, wallet and user identity.
alter table if exists public.profiles
  add column if not exists role text default 'user',
  add column if not exists account_status text default 'approved',
  add column if not exists is_banned boolean default false,
  add column if not exists is_verified boolean default false,
  add column if not exists is_seller boolean default false,
  add column if not exists seller_status text default 'none',
  add column if not exists plan_key text default 'free',
  add column if not exists xp integer default 0,
  add column if not exists total_earned_inr integer default 0,
  add column if not exists pending_payout_inr integer default 0,
  add column if not exists paid_payout_inr integer default 0;

-- Auto-create profile for future signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, username, display_name, role, account_status, is_verified)
  values (
    new.id,
    split_part(coalesce(new.email,''), '@', 1),
    split_part(coalesce(new.email,''), '@', 1),
    case when lower(coalesce(new.email,'')) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    'approved',
    lower(coalesce(new.email,'')) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Mark existing admin accounts.
update public.profiles p
set role='admin', account_status='approved', is_verified=true
from auth.users u
where p.id = u.id
  and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com');

-- Manual orders for UPI proof flow.
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

alter table public.manual_orders
  add column if not exists admin_note text,
  add column if not exists payout_paid_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists reference_number text,
  add column if not exists proof_path text,
  add column if not exists payout_status text default 'pending';

-- Seller services.
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

-- Payout requests.
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

-- Notifications.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Storage bucket for payment screenshots.
insert into storage.buckets (id, name, public)
values ('payment-proofs','payment-proofs', false)
on conflict (id) do nothing;

-- Enable secure RLS.
alter table public.profiles enable row level security;
alter table public.manual_orders enable row level security;
alter table public.seller_services enable row level security;
alter table public.seller_payout_requests enable row level security;
alter table public.notifications enable row level security;

-- Profiles policies.
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
for insert to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Manual orders: buyers create/read own, sellers read their own orders, admins read/update all.
drop policy if exists "manual orders insert own" on public.manual_orders;
create policy "manual orders insert own" on public.manual_orders
for insert to authenticated
with check (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "manual orders read participant or admin" on public.manual_orders;
create policy "manual orders read participant or admin" on public.manual_orders
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "manual orders admin update" on public.manual_orders;
create policy "manual orders admin update" on public.manual_orders
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Seller services policies.
drop policy if exists "seller services readable" on public.seller_services;
create policy "seller services readable" on public.seller_services
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

-- Seller payout policies.
drop policy if exists "seller payout read own or admin" on public.seller_payout_requests;
create policy "seller payout read own or admin" on public.seller_payout_requests
for select to authenticated using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "seller payout insert own" on public.seller_payout_requests;
create policy "seller payout insert own" on public.seller_payout_requests
for insert to authenticated with check (seller_id = auth.uid());

drop policy if exists "seller payout admin update" on public.seller_payout_requests;
create policy "seller payout admin update" on public.seller_payout_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifications policies.
drop policy if exists "notifications read own or admin" on public.notifications;
create policy "notifications read own or admin" on public.notifications
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications insert own or admin" on public.notifications;
create policy "notifications insert own or admin" on public.notifications
for insert to authenticated with check (user_id = auth.uid() or public.is_admin());

-- Storage policies for payment proofs.
drop policy if exists "payment proofs upload own" on storage.objects;
create policy "payment proofs upload own" on storage.objects
for insert to authenticated
with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "payment proofs read own or admin" on storage.objects;
create policy "payment proofs read own or admin" on storage.objects
for select to authenticated
using (bucket_id = 'payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

drop policy if exists "payment proofs admin manage" on storage.objects;
create policy "payment proofs admin manage" on storage.objects
for all to authenticated
using (bucket_id = 'payment-proofs' and public.is_admin())
with check (bucket_id = 'payment-proofs' and public.is_admin());

-- Realtime. If Supabase says already member, ignore.
do $$ begin
  begin alter publication supabase_realtime add table public.manual_orders; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_services; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_payout_requests; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
