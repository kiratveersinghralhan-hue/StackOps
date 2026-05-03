-- StackOps FULL CLEAN RESET / FINAL LIVE SCHEMA
-- Run once in Supabase SQL Editor. This resets StackOps app tables, not auth.users.
-- Admin emails: kiratveersinghralhan@gmail.com, qq299629@gmail.com

create extension if not exists pgcrypto;

-- 1) Drop old broken StackOps tables that caused schema/RLS conflicts.
drop table if exists public.seller_payouts cascade;
drop table if exists public.manual_orders cascade;
drop table if exists public.seller_services cascade;
drop table if exists public.seller_applications cascade;
drop table if exists public.messages cascade;
drop table if exists public.posts cascade;
drop table if exists public.teams cascade;

-- 2) Admin helper.
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

-- 3) Profiles table, kept compatible with existing users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  role text default 'user',
  account_status text default 'active',
  is_verified boolean default false,
  is_seller boolean default false,
  seller_status text default 'none',
  plan_key text default 'free',
  xp integer default 0,
  title text default 'Rookie',
  badge text default 'Starter',
  banner text default 'Starter Arena Card',
  last_daily_claim date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists account_status text default 'active';
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists is_seller boolean default false;
alter table public.profiles add column if not exists seller_status text default 'none';
alter table public.profiles add column if not exists plan_key text default 'free';
alter table public.profiles add column if not exists xp integer default 0;
alter table public.profiles add column if not exists title text default 'Rookie';
alter table public.profiles add column if not exists badge text default 'Starter';
alter table public.profiles add column if not exists banner text default 'Starter Arena Card';
alter table public.profiles add column if not exists last_daily_claim date;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Create profiles for all existing auth users.
insert into public.profiles (id,email,username,display_name)
select u.id, u.email, split_part(u.email,'@',1), split_part(u.email,'@',1)
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  username = coalesce(public.profiles.username, excluded.username),
  display_name = coalesce(public.profiles.display_name, excluded.display_name);

-- Make your admin accounts founder, max XP, verified, seller approved.
update public.profiles p
set role='admin', is_verified=true, is_seller=true, seller_status='approved',
    account_status='active', plan_key='founder', xp=9999999,
    title='Founder', badge='Origin Crown', banner='Founder Crownline'
from auth.users u
where p.id=u.id and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com');

-- Auto-profile creation for future users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id,email,username,display_name,role,is_verified,is_seller,seller_status,plan_key,xp,title,badge,banner)
  values (
    new.id,
    new.email,
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com'),
    lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com'),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'approved' else 'none' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'founder' else 'free' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 9999999 else 0 end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder' else 'Rookie' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Origin Crown' else 'Starter' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder Crownline' else 'Starter Arena Card' end
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4) Seller applications.
create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  applicant_email text not null,
  applicant_name text not null,
  note text,
  proof_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id)
);

-- 5) Seller services.
create table public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  game text,
  description text,
  price integer not null check (price >= 0),
  status text not null default 'active' check (status in ('active','paused','deleted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6) Manual UPI orders with screenshot proof stored as text data URL to avoid storage bucket permission issues.
create table public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete set null,
  service_id uuid references public.seller_services(id) on delete set null,
  order_type text not null default 'service' check (order_type in ('service','plan','other')),
  service_title text not null default 'StackOps Payment',
  amount integer not null check (amount >= 0),
  commission_percent integer not null default 15,
  commission_amount integer not null default 0,
  seller_earning integer not null default 0,
  utr text not null,
  proof_data text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed','refunded')),
  show_public boolean default false,
  seller_paid boolean default false,
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- 7) Seller payouts.
create table public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  note text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- 8) Community posts, teams, chat.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  game text,
  description text,
  is_public boolean default true,
  created_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room text not null default 'global',
  body text not null,
  created_at timestamptz default now()
);

-- 9) Enable RLS.
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;
alter table public.seller_payouts enable row level security;
alter table public.posts enable row level security;
alter table public.teams enable row level security;
alter table public.messages enable row level security;

-- Drop any policies from previous attempts.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('profiles','seller_applications','seller_services','manual_orders','seller_payouts','posts','teams','messages') loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 10) Profiles policies.
create policy profiles_public_read on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid() or public.is_admin());
create policy profiles_update_own_or_admin on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete_admin on public.profiles for delete to authenticated using (public.is_admin());

-- Seller applications policies.
create policy seller_apps_insert_own on public.seller_applications for insert to authenticated with check (user_id = auth.uid());
create policy seller_apps_read_own_or_admin on public.seller_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy seller_apps_update_admin on public.seller_applications for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy seller_apps_delete_admin on public.seller_applications for delete to authenticated using (public.is_admin());

-- Services policies.
create policy services_public_read on public.seller_services for select using (status='active' or seller_id=auth.uid() or public.is_admin());
create policy services_insert_approved_seller on public.seller_services for insert to authenticated with check (seller_id=auth.uid() and (public.is_admin() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_seller=true and p.seller_status='approved')));
create policy services_update_own_or_admin on public.seller_services for update to authenticated using (seller_id=auth.uid() or public.is_admin()) with check (seller_id=auth.uid() or public.is_admin());
create policy services_delete_own_or_admin on public.seller_services for delete to authenticated using (seller_id=auth.uid() or public.is_admin());

-- Manual orders policies.
create policy orders_insert_buyer on public.manual_orders for insert to authenticated with check (buyer_id = auth.uid());
create policy orders_read_related_or_admin on public.manual_orders for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy orders_update_admin on public.manual_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_delete_admin on public.manual_orders for delete to authenticated using (public.is_admin());

-- Payout policies.
create policy payouts_insert_seller on public.seller_payouts for insert to authenticated with check (seller_id = auth.uid());
create policy payouts_read_own_or_admin on public.seller_payouts for select to authenticated using (seller_id = auth.uid() or public.is_admin());
create policy payouts_update_admin on public.seller_payouts for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Posts policies.
create policy posts_read_all on public.posts for select using (true);
create policy posts_insert_auth on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_delete_own_or_admin on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Teams policies.
create policy teams_read_public on public.teams for select using (is_public=true or owner_id=auth.uid() or public.is_admin());
create policy teams_insert_auth on public.teams for insert to authenticated with check (owner_id=auth.uid());
create policy teams_update_own_or_admin on public.teams for update to authenticated using (owner_id=auth.uid() or public.is_admin()) with check (owner_id=auth.uid() or public.is_admin());
create policy teams_delete_own_or_admin on public.teams for delete to authenticated using (owner_id=auth.uid() or public.is_admin());

-- Messages policies.
create policy messages_read_all on public.messages for select using (true);
create policy messages_insert_auth on public.messages for insert to authenticated with check (user_id=auth.uid());
create policy messages_delete_admin on public.messages for delete to authenticated using (public.is_admin());

-- 11) Realtime publication, safe if already added.
do $$
begin
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_applications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.seller_services; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.manual_orders; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- 12) Useful indexes.
create index if not exists idx_services_seller on public.seller_services(seller_id);
create index if not exists idx_orders_buyer on public.manual_orders(buyer_id);
create index if not exists idx_orders_seller on public.manual_orders(seller_id);
create index if not exists idx_orders_status on public.manual_orders(status);
create index if not exists idx_profiles_xp on public.profiles(xp desc);

select 'StackOps clean reset complete. Login again and test services/payments/admin.' as status;
