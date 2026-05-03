-- STACKOPS FINAL MANUAL UPI + MIDDLEMAN MARKETPLACE SQL
-- Run this in Supabase SQL Editor. It is safe to rerun.

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
  add column if not exists pending_payout_inr integer default 0;

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
  approved_at timestamptz,
  payout_paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;

-- seller_services policies
DROP POLICY IF EXISTS "seller services public read" ON public.seller_services;
CREATE POLICY "seller services public read" ON public.seller_services
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "approved sellers create services" ON public.seller_services;
CREATE POLICY "approved sellers create services" ON public.seller_services
FOR INSERT TO authenticated
WITH CHECK (
  seller_id = auth.uid()
  AND EXISTS (select 1 from public.profiles p where p.id = auth.uid() and p.is_seller = true and p.seller_status = 'approved')
);

DROP POLICY IF EXISTS "seller or admin update services" ON public.seller_services;
CREATE POLICY "seller or admin update services" ON public.seller_services
FOR UPDATE TO authenticated
USING (seller_id = auth.uid() OR public.is_admin())
WITH CHECK (seller_id = auth.uid() OR public.is_admin());

-- manual_orders policies
DROP POLICY IF EXISTS "buyers create own manual orders" ON public.manual_orders;
CREATE POLICY "buyers create own manual orders" ON public.manual_orders
FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "users read own manual orders" ON public.manual_orders;
CREATE POLICY "users read own manual orders" ON public.manual_orders
FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin update manual orders" ON public.manual_orders;
CREATE POLICY "admin update manual orders" ON public.manual_orders
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Storage bucket for payment screenshots/proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs','payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment proofs upload own" ON storage.objects;
CREATE POLICY "payment proofs upload own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "payment proofs read own or admin" ON storage.objects;
CREATE POLICY "payment proofs read own or admin" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

DROP POLICY IF EXISTS "payment proofs admin manage" ON storage.objects;
CREATE POLICY "payment proofs admin manage" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_admin())
WITH CHECK (bucket_id = 'payment-proofs' AND public.is_admin());

-- Realtime: duplicates are safe to ignore if Supabase says already member.
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_services; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
