
-- StackOps trust carousel + seller reviews + manual UPI payment proof system
-- Run this once in Supabase SQL Editor.

create table if not exists public.admin_emails (
  email text primary key
);
insert into public.admin_emails(email) values
('kiratveersinghralhan@gmail.com'),
('qq299629@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on lower(a.email) = lower(u.email)
    where u.id = uid
  );
$$;

create table if not exists public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  item_name text,
  item_type text default 'service',
  plan_key text,
  amount_inr integer default 0,
  commission_inr integer default 0,
  seller_earning_inr integer default 0,
  utr text,
  proof_url text,
  status text default 'pending',
  feedback_text text,
  is_feedback_public boolean default false,
  created_at timestamptz default now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

alter table public.manual_orders add column if not exists buyer_id uuid references auth.users(id) on delete set null;
alter table public.manual_orders add column if not exists seller_id uuid references auth.users(id) on delete set null;
alter table public.manual_orders add column if not exists item_name text;
alter table public.manual_orders add column if not exists item_type text default 'service';
alter table public.manual_orders add column if not exists plan_key text;
alter table public.manual_orders add column if not exists amount_inr integer default 0;
alter table public.manual_orders add column if not exists commission_inr integer default 0;
alter table public.manual_orders add column if not exists seller_earning_inr integer default 0;
alter table public.manual_orders add column if not exists utr text;
alter table public.manual_orders add column if not exists proof_url text;
alter table public.manual_orders add column if not exists status text default 'pending';
alter table public.manual_orders add column if not exists feedback_text text;
alter table public.manual_orders add column if not exists is_feedback_public boolean default false;
alter table public.manual_orders add column if not exists approved_at timestamptz;
alter table public.manual_orders add column if not exists rejected_at timestamptz;

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  service_id uuid,
  order_id uuid references public.manual_orders(id) on delete set null,
  seller_name text,
  item_name text,
  rating integer not null default 5 check (rating between 1 and 5),
  review_text text not null,
  status text default 'pending',
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.seller_reviews add column if not exists reviewer_id uuid references auth.users(id) on delete set null;
alter table public.seller_reviews add column if not exists seller_id uuid references auth.users(id) on delete set null;
alter table public.seller_reviews add column if not exists service_id uuid;
alter table public.seller_reviews add column if not exists order_id uuid references public.manual_orders(id) on delete set null;
alter table public.seller_reviews add column if not exists seller_name text;
alter table public.seller_reviews add column if not exists item_name text;
alter table public.seller_reviews add column if not exists rating integer default 5;
alter table public.seller_reviews add column if not exists review_text text;
alter table public.seller_reviews add column if not exists status text default 'pending';
alter table public.seller_reviews add column if not exists reviewed_at timestamptz;

alter table public.manual_orders enable row level security;
alter table public.seller_reviews enable row level security;

-- Reset policies for these two tables only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('manual_orders','seller_reviews') LOOP
    EXECUTE format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- manual_orders policies
create policy "manual orders insert own"
on public.manual_orders for insert
to authenticated
with check (buyer_id = auth.uid());

create policy "manual orders read own seller admin or public feedback"
on public.manual_orders for select
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.is_admin()
  or (status = 'approved' and is_feedback_public = true)
);

create policy "manual orders admin update"
on public.manual_orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- seller_reviews policies
create policy "approved reviews public read"
on public.seller_reviews for select
to anon, authenticated
using (status = 'approved' or reviewer_id = auth.uid() or public.is_admin());

create policy "users insert own review"
on public.seller_reviews for insert
to authenticated
with check (reviewer_id = auth.uid());

create policy "admin update reviews"
on public.seller_reviews for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Storage bucket for payment proofs. Public is true so selected public feedback screenshots can render on GitHub Pages.
insert into storage.buckets (id, name, public)
values ('payment-proofs','payment-proofs', true)
on conflict (id) do update set public = true;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'payment proofs%' LOOP
    EXECUTE format('drop policy if exists %I on storage.objects', r.policyname);
  END LOOP;
END $$;

create policy "payment proofs user upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "payment proofs public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'payment-proofs');

create policy "payment proofs admin manage"
on storage.objects for all
to authenticated
using (bucket_id = 'payment-proofs' and public.is_admin())
with check (bucket_id = 'payment-proofs' and public.is_admin());

-- Realtime safe add
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_reviews; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
