-- StackOps FINAL SAFE SQL
-- Run once in Supabase SQL Editor.
-- This does NOT delete your users. It fixes seller applications, profiles, payments and policies.

create extension if not exists pgcrypto;

-- =========================
-- ADMIN EMAIL FUNCTION
-- =========================
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
    where u.id = auth.uid()
      and lower(u.email) in (
        'kiratveersinghralhan@gmail.com',
        'qq299629@gmail.com'
      )
  );
$$;

-- =========================
-- PROFILES FIX
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles
  add column if not exists role text default 'user',
  add column if not exists account_status text default 'approved',
  add column if not exists is_banned boolean default false,
  add column if not exists is_verified boolean default false,
  add column if not exists is_seller boolean default false,
  add column if not exists seller_status text default 'none',
  add column if not exists plan_key text default 'free',
  add column if not exists xp integer default 0,
  add column if not exists title text default 'Rookie',
  add column if not exists badge text default 'Starter Spark',
  add column if not exists selected_banner_key text default 'default',
  add column if not exists bio text,
  add column if not exists riot_id text,
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists total_earned_inr integer default 0,
  add column if not exists pending_payout_inr integer default 0;

insert into public.profiles (id, username, display_name, role, account_status, title, badge, selected_banner_key, xp, is_verified)
select
  u.id,
  split_part(u.email, '@', 1),
  split_part(u.email, '@', 1),
  case when lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
  'approved',
  case when lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder' else 'Rookie' end,
  case when lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Origin Crown' else 'Starter Spark' end,
  case when lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'gold' else 'default' end,
  case when lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 999999 else 0 end,
  case when lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then true else false end
from auth.users u
on conflict (id) do update
set role = case when excluded.role = 'admin' then 'admin' else public.profiles.role end,
    account_status = coalesce(public.profiles.account_status, 'approved');

-- Auto profile creation for future signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role, account_status, title, badge, selected_banner_key, xp, is_verified)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    'approved',
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder' else 'Rookie' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Origin Crown' else 'Starter Spark' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'gold' else 'default' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 999999 else 0 end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then true else false end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- SELLER APPLICATIONS FIX
-- =========================
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

alter table public.seller_applications
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists applicant_email text,
  add column if not exists applicant_name text,
  add column if not exists note text,
  add column if not exists status text default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now();

-- =========================
-- PAYMENTS FIX
-- =========================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  amount_inr integer default 0,
  commission_inr integer default 0,
  provider text default 'razorpay',
  status text default 'created',
  item_name text,
  item_type text,
  plan_key text,
  provider_payment_id text,
  provider_order_id text,
  provider_signature text,
  raw_response jsonb,
  verified_at timestamptz,
  created_at timestamptz default now()
);

alter table public.payments
  add column if not exists buyer_id uuid references auth.users(id) on delete set null,
  add column if not exists amount_inr integer default 0,
  add column if not exists commission_inr integer default 0,
  add column if not exists provider text default 'razorpay',
  add column if not exists status text default 'created',
  add column if not exists item_name text,
  add column if not exists item_type text,
  add column if not exists plan_key text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_order_id text,
  add column if not exists provider_signature text,
  add column if not exists raw_response jsonb,
  add column if not exists verified_at timestamptz,
  add column if not exists created_at timestamptz default now();

-- =========================
-- RLS POLICIES
-- =========================
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.payments enable row level security;

-- profiles policies
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- seller app policies
drop policy if exists "seller apps insert own" on public.seller_applications;
create policy "seller apps insert own"
on public.seller_applications for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "seller apps read own or admin" on public.seller_applications;
create policy "seller apps read own or admin"
on public.seller_applications for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "seller apps update admin" on public.seller_applications;
create policy "seller apps update admin"
on public.seller_applications for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- payments policies
drop policy if exists "payments insert own" on public.payments;
create policy "payments insert own"
on public.payments for insert
to authenticated
with check (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "payments read own or admin" on public.payments;
create policy "payments read own or admin"
on public.payments for select
to authenticated
using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "payments update admin" on public.payments;
create policy "payments update admin"
on public.payments for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- REALTIME SAFE ENABLE
-- =========================
do $$
begin
  begin alter publication supabase_realtime add table public.seller_applications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
