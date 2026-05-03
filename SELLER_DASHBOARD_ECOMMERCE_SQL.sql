-- StackOps Seller Dashboard / Orders / Earnings / Payouts
-- Run in Supabase SQL editor.

-- Required helper: admin by email
create or replace function public.stackops_admin_emails()
returns text[] language sql stable as $$
  select array['kiratveersinghralhan@gmail.com','qq299629@gmail.com'];
$$;

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
    and lower(u.email) = any(public.stackops_admin_emails())
  );
$$;

-- Seller service listings
create table if not exists public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  title text not null,
  game text default 'Valorant',
  description text,
  price_inr integer not null default 0,
  status text default 'active' check (status in ('active','paused','deleted','pending')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Manual orders: buyer pays StackOps, admin approves, seller receives earning later
create table if not exists public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.seller_services(id) on delete set null,
  item_name text,
  item_type text default 'service',
  plan_key text,
  amount_inr integer not null default 0,
  commission_inr integer default 0,
  seller_earning_inr integer default 0,
  utr text,
  proof_url text,
  status text default 'pending' check (status in ('pending','approved','rejected','completed','cancelled','refunded')),
  is_feedback_public boolean default false,
  feedback_text text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz default now()
);

-- Seller payout requests
create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  amount_inr integer not null default 0,
  status text default 'pending' check (status in ('pending','paid','rejected')),
  note text,
  payout_method text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- Make sure profile seller flags exist
alter table public.profiles add column if not exists is_seller boolean default false;
alter table public.profiles add column if not exists seller_status text default 'none';

-- Storage bucket for payment proof screenshots
insert into storage.buckets (id, name, public)
values ('payment-proofs','payment-proofs', false)
on conflict (id) do nothing;

alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;
alter table public.seller_payouts enable row level security;

-- Clean policies for these tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('seller_services','manual_orders','seller_payouts') LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- seller_services policies
create policy "services public active read"
on public.seller_services for select
using (status = 'active' or seller_id = auth.uid() or public.is_admin());

create policy "approved sellers create services"
on public.seller_services for insert
with check (
  seller_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_seller = true or p.seller_status = 'approved'))
);

create policy "seller or admin update services"
on public.seller_services for update
using (seller_id = auth.uid() or public.is_admin())
with check (seller_id = auth.uid() or public.is_admin());

create policy "seller or admin delete services"
on public.seller_services for delete
using (seller_id = auth.uid() or public.is_admin());

-- manual_orders policies
create policy "buyers create own manual orders"
on public.manual_orders for insert
with check (buyer_id = auth.uid());

create policy "orders visible to buyer seller admin"
on public.manual_orders for select
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

create policy "admin updates manual orders"
on public.manual_orders for update
using (public.is_admin())
with check (public.is_admin());

-- seller_payouts policies
create policy "seller creates own payout request"
on public.seller_payouts for insert
with check (seller_id = auth.uid());

create policy "payouts visible to seller admin"
on public.seller_payouts for select
using (seller_id = auth.uid() or public.is_admin());

create policy "admin updates payouts"
on public.seller_payouts for update
using (public.is_admin())
with check (public.is_admin());

-- Storage policies for payment proof uploads
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'stackops payment proofs%' LOOP
    EXECUTE format('drop policy if exists %I on storage.objects', r.policyname);
  END LOOP;
END $$;

create policy "stackops payment proofs upload own"
on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "stackops payment proofs read owner admin"
on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

-- Realtime; ignore duplicate membership notices
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_services; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_payouts; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
