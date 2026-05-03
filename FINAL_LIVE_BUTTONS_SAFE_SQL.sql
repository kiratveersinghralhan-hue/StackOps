-- StackOps final live-safe SQL for buttons/actions/manual marketplace.
-- Run once in Supabase SQL Editor. This does not delete user data.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists is_seller boolean default false;
alter table public.profiles add column if not exists seller_status text default 'none';
alter table public.profiles add column if not exists plan_key text default 'free';
alter table public.profiles add column if not exists xp integer default 0;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists account_status text default 'approved';
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  note text,
  status text default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='seller_applications_one_per_user') then
    alter table public.seller_applications add constraint seller_applications_one_per_user unique(user_id);
  end if;
exception when others then null;
end $$;

create table if not exists public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  title text not null,
  game text default 'Valorant',
  description text,
  price_inr integer not null default 0,
  status text default 'active',
  created_at timestamptz default now()
);

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
  is_feedback_public boolean default false,
  feedback_text text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  amount_inr integer not null default 0,
  status text default 'pending',
  note text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

insert into storage.buckets(id,name,public)
values ('payment-proofs','payment-proofs',false)
on conflict(id) do nothing;

alter table public.seller_applications enable row level security;
alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;
alter table public.seller_payouts enable row level security;

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

drop policy if exists "seller apps insert own" on public.seller_applications;
create policy "seller apps insert own" on public.seller_applications for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "seller apps read own admin" on public.seller_applications;
create policy "seller apps read own admin" on public.seller_applications for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "seller apps admin update" on public.seller_applications;
create policy "seller apps admin update" on public.seller_applications for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "services public read" on public.seller_services;
create policy "services public read" on public.seller_services for select using (status='active' or seller_id=auth.uid() or public.is_admin());
drop policy if exists "services seller insert" on public.seller_services;
create policy "services seller insert" on public.seller_services for insert to authenticated with check (seller_id=auth.uid() or public.is_admin());
drop policy if exists "services seller update" on public.seller_services;
create policy "services seller update" on public.seller_services for update to authenticated using (seller_id=auth.uid() or public.is_admin()) with check (seller_id=auth.uid() or public.is_admin());
drop policy if exists "services seller delete" on public.seller_services;
create policy "services seller delete" on public.seller_services for delete to authenticated using (seller_id=auth.uid() or public.is_admin());

drop policy if exists "orders buyer insert" on public.manual_orders;
create policy "orders buyer insert" on public.manual_orders for insert to authenticated with check (buyer_id=auth.uid());
drop policy if exists "orders read own admin seller" on public.manual_orders;
create policy "orders read own admin seller" on public.manual_orders for select to authenticated using (buyer_id=auth.uid() or seller_id=auth.uid() or public.is_admin());
drop policy if exists "orders admin update" on public.manual_orders;
create policy "orders admin update" on public.manual_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payouts seller insert" on public.seller_payouts;
create policy "payouts seller insert" on public.seller_payouts for insert to authenticated with check (seller_id=auth.uid());
drop policy if exists "payouts read own admin" on public.seller_payouts;
create policy "payouts read own admin" on public.seller_payouts for select to authenticated using (seller_id=auth.uid() or public.is_admin());
drop policy if exists "payouts admin update" on public.seller_payouts;
create policy "payouts admin update" on public.seller_payouts for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payment proofs upload own" on storage.objects;
create policy "payment proofs upload own" on storage.objects for insert to authenticated with check (bucket_id='payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "payment proofs read own admin" on storage.objects;
create policy "payment proofs read own admin" on storage.objects for select to authenticated using (bucket_id='payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, username, display_name, role, account_status)
  values (
    new.id,
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    'approved'
  )
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
