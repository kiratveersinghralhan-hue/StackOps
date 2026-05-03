-- StackOps Middleman Marketplace + Manual UPI Payment System
-- Run this in Supabase SQL Editor.
-- This keeps your existing users/profiles and creates the missing marketplace system.

-- 1) Profile seller fields
alter table public.profiles
add column if not exists is_seller boolean default false,
add column if not exists seller_status text default 'none',
add column if not exists is_verified boolean default false,
add column if not exists account_status text default 'approved',
add column if not exists total_earned_inr integer default 0,
add column if not exists pending_payout_inr integer default 0;

-- 2) Clean duplicate seller applications and enforce one application per user
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  note text,
  proof_url text,
  status text default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- remove duplicates, keep newest per user
with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc nulls last) rn
  from public.seller_applications
  where user_id is not null
)
delete from public.seller_applications s
using ranked r
where s.id = r.id and r.rn > 1;

do $$ begin
  alter table public.seller_applications add constraint seller_applications_one_per_user unique (user_id);
exception when duplicate_object then null;
end $$;

-- 3) Seller services/listings
create table if not exists public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  title text not null,
  game text default 'Valorant',
  description text not null,
  price_inr integer not null check (price_inr > 0),
  status text default 'active',
  created_at timestamptz default now()
);

-- 4) Manual orders/payment proofs: buyer pays StackOps first, admin verifies, seller payout tracked
create table if not exists public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  service_id text,
  service_title text not null,
  amount_inr integer not null,
  commission_percent integer not null default 10,
  commission_inr integer not null default 0,
  seller_payout_inr integer not null default 0,
  proof_path text,
  status text default 'pending', -- pending, approved, rejected, completed
  payout_status text default 'pending', -- pending, paid
  approved_at timestamptz,
  payout_paid_at timestamptz,
  created_at timestamptz default now()
);

-- 5) Storage bucket for payment proofs
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- 6) Enable RLS
alter table public.seller_applications enable row level security;
alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;

-- Helper: admin by email or role, if not already available
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and (
        lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
        or p.role = 'admin'
      )
  );
$$;

-- 7) Policies
-- seller applications
drop policy if exists "seller apps insert own" on public.seller_applications;
create policy "seller apps insert own" on public.seller_applications
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "seller apps read own/admin" on public.seller_applications;
create policy "seller apps read own/admin" on public.seller_applications
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "seller apps admin update" on public.seller_applications;
create policy "seller apps admin update" on public.seller_applications
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- seller services
drop policy if exists "services public read" on public.seller_services;
create policy "services public read" on public.seller_services
for select using (status = 'active' or public.is_admin() or seller_id = auth.uid());

drop policy if exists "approved sellers create services" on public.seller_services;
create policy "approved sellers create services" on public.seller_services
for insert to authenticated
with check (
  seller_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_seller = true or p.seller_status = 'approved'))
);

drop policy if exists "seller update own services" on public.seller_services;
create policy "seller update own services" on public.seller_services
for update to authenticated
using (seller_id = auth.uid() or public.is_admin())
with check (seller_id = auth.uid() or public.is_admin());

-- manual orders
drop policy if exists "buyer create manual order" on public.manual_orders;
create policy "buyer create manual order" on public.manual_orders
for insert to authenticated
with check (buyer_id = auth.uid());

drop policy if exists "orders read participant/admin" on public.manual_orders;
create policy "orders read participant/admin" on public.manual_orders
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "admin update manual orders" on public.manual_orders;
create policy "admin update manual orders" on public.manual_orders
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- storage policies for payment proofs
drop policy if exists "payment proofs upload own" on storage.objects;
create policy "payment proofs upload own" on storage.objects
for insert to authenticated
with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "payment proofs read owner or admin" on storage.objects;
create policy "payment proofs read owner or admin" on storage.objects
for select to authenticated
using (bucket_id = 'payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

-- 8) Realtime add safely
do $$ begin
  begin alter publication supabase_realtime add table public.seller_applications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_services; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.manual_orders; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
