-- StackOps Final Manual UPI Middleman Marketplace SQL
-- Run this in Supabase SQL Editor.
-- This is safe for your existing StackOps DB and replaces the broken payment flow with manual UPI proof approval.

-- =====================================================
-- 1) PROFILE FIELDS
-- =====================================================
alter table public.profiles
add column if not exists is_seller boolean default false,
add column if not exists seller_status text default 'none',
add column if not exists is_verified boolean default false,
add column if not exists account_status text default 'approved',
add column if not exists total_earned_inr integer default 0,
add column if not exists pending_payout_inr integer default 0,
add column if not exists role text default 'user';

-- =====================================================
-- 2) ADMIN HELPER
-- =====================================================
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

-- =====================================================
-- 3) AUTO PROFILE CREATION FOR FUTURE USERS
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, account_status, seller_status, plan_key, xp)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    'approved',
    'none',
    'free',
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =====================================================
-- 4) SELLER APPLICATIONS: ONE PER USER
-- =====================================================
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

-- Required columns if old table exists
alter table public.seller_applications
add column if not exists user_id uuid references auth.users(id) on delete cascade,
add column if not exists applicant_email text,
add column if not exists applicant_name text,
add column if not exists note text,
add column if not exists proof_url text,
add column if not exists status text default 'pending',
add column if not exists reviewed_at timestamptz,
add column if not exists created_at timestamptz default now();

-- Remove duplicate applications, keep newest per user
with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc nulls last) rn
  from public.seller_applications
  where user_id is not null
)
delete from public.seller_applications s
using ranked r
where s.id = r.id and r.rn > 1;

-- Recreate constraint cleanly to avoid duplicate errors
do $$
begin
  alter table public.seller_applications drop constraint if exists seller_applications_one_per_user;
  alter table public.seller_applications add constraint seller_applications_one_per_user unique (user_id);
exception when others then
  raise notice 'seller_applications unique constraint skipped: %', sqlerrm;
end $$;

-- =====================================================
-- 5) SELLER SERVICES / LISTINGS
-- =====================================================
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

-- =====================================================
-- 6) MANUAL ORDERS / UPI PAYMENT PROOFS
-- Buyer pays StackOps UPI first, uploads screenshot + reference/UTR.
-- Admin approves within 24-48h, then seller delivers.
-- =====================================================
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
  reference_number text,
  status text default 'pending', -- pending, approved, rejected, completed
  payout_status text default 'pending', -- pending, paid
  approved_at timestamptz,
  payout_paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.manual_orders
add column if not exists reference_number text,
add column if not exists proof_path text,
add column if not exists payout_status text default 'pending',
add column if not exists approved_at timestamptz,
add column if not exists payout_paid_at timestamptz;

-- =====================================================
-- 7) STORAGE BUCKET FOR PAYMENT PROOF SCREENSHOTS
-- =====================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- =====================================================
-- 8) RLS ENABLE
-- =====================================================
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;

-- =====================================================
-- 9) POLICIES
-- =====================================================
-- Profiles
DROP POLICY IF EXISTS "profiles read own or admin" ON public.profiles;
CREATE POLICY "profiles read own or admin" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles insert own" ON public.profiles;
CREATE POLICY "profiles insert own" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles update own or admin" ON public.profiles;
CREATE POLICY "profiles update own or admin" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- Seller applications
DROP POLICY IF EXISTS "seller apps insert own" ON public.seller_applications;
CREATE POLICY "seller apps insert own" ON public.seller_applications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "seller apps read own/admin" ON public.seller_applications;
CREATE POLICY "seller apps read own/admin" ON public.seller_applications
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "seller apps admin update" ON public.seller_applications;
CREATE POLICY "seller apps admin update" ON public.seller_applications
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Services
DROP POLICY IF EXISTS "services public read" ON public.seller_services;
CREATE POLICY "services public read" ON public.seller_services
FOR SELECT
USING (status = 'active' OR seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "approved sellers create services" ON public.seller_services;
CREATE POLICY "approved sellers create services" ON public.seller_services
FOR INSERT TO authenticated
WITH CHECK (
  seller_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_seller = true OR p.seller_status = 'approved' OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "seller update own services" ON public.seller_services;
CREATE POLICY "seller update own services" ON public.seller_services
FOR UPDATE TO authenticated
USING (seller_id = auth.uid() OR public.is_admin())
WITH CHECK (seller_id = auth.uid() OR public.is_admin());

-- Manual orders
DROP POLICY IF EXISTS "buyer create manual order" ON public.manual_orders;
CREATE POLICY "buyer create manual order" ON public.manual_orders
FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "orders read participant/admin" ON public.manual_orders;
CREATE POLICY "orders read participant/admin" ON public.manual_orders
FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin update manual orders" ON public.manual_orders;
CREATE POLICY "admin update manual orders" ON public.manual_orders
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Storage: payment proofs
DROP POLICY IF EXISTS "payment proofs upload own" ON storage.objects;
CREATE POLICY "payment proofs upload own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "payment proofs read owner or admin" ON storage.objects;
CREATE POLICY "payment proofs read owner or admin" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

-- =====================================================
-- 10) REALTIME SAFE ENABLE
-- =====================================================
do $$ begin
  begin alter publication supabase_realtime add table public.seller_applications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_services; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.manual_orders; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- =====================================================
-- 11) MAKE YOUR ACCOUNT ADMIN + SELLER + VERIFIED
-- =====================================================
insert into public.profiles (id, username, display_name, role, is_seller, seller_status, is_verified, account_status, plan_key, xp)
select id, split_part(email, '@', 1), split_part(email, '@', 1), 'admin', true, 'approved', true, 'approved', 'premium', 1500
from auth.users
where lower(email) = 'kiratveersinghralhan@gmail.com'
on conflict (id) do update set
  role = 'admin',
  is_seller = true,
  seller_status = 'approved',
  is_verified = true,
  account_status = 'approved',
  plan_key = 'premium';

-- Done.
