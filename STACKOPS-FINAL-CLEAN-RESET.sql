-- STACKOPS FINAL CLEAN RESET FOR PROFILE + SELLER APPROVAL
-- Run this once in Supabase SQL Editor.
-- It fixes: applicant_email/applicant_name/note errors, profile policy warnings,
-- seller approval desk counters, and realtime application updates.

-- 1) Ensure admin emails helper exists
create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);

insert into public.admin_emails (email)
values ('kiratveersinghralhan@gmail.com'), ('qq299629@gmail.com')
on conflict (email) do nothing;

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
      and lower(u.email) in (select lower(email) from public.admin_emails)
  );
$$;

-- 2) Profiles required columns
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
  add column if not exists riot_id text,
  add column if not exists region text,
  add column if not exists main_game text default 'Valorant',
  add column if not exists bio text,
  add column if not exists gender text,
  add column if not exists avatar_url text,
  add column if not exists custom_banner_url text,
  add column if not exists updated_at timestamptz default now();

-- 3) Create profile rows for all existing auth users
insert into public.profiles (id, username, display_name, role, account_status, title, badge, selected_banner_key, xp, is_verified)
select
  u.id,
  split_part(u.email, '@', 1),
  split_part(u.email, '@', 1),
  case when lower(u.email) in (select lower(email) from public.admin_emails) then 'admin' else 'user' end,
  'approved',
  case when lower(u.email) in (select lower(email) from public.admin_emails) then 'Founder' else 'Rookie' end,
  case when lower(u.email) in (select lower(email) from public.admin_emails) then 'Origin Crown' else 'Starter Spark' end,
  case when lower(u.email) in (select lower(email) from public.admin_emails) then 'gold' else 'default' end,
  case when lower(u.email) in (select lower(email) from public.admin_emails) then 999999 else 0 end,
  lower(u.email) in (select lower(email) from public.admin_emails)
from auth.users u
on conflict (id) do update set
  username = coalesce(public.profiles.username, excluded.username),
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  role = case when excluded.role = 'admin' then 'admin' else public.profiles.role end,
  account_status = coalesce(public.profiles.account_status, 'approved');

-- 4) Auto-create future profiles
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
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'admin' else 'user' end,
    'approved',
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'Founder' else 'Rookie' end,
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'Origin Crown' else 'Starter Spark' end,
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'gold' else 'default' end,
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 999999 else 0 end,
    lower(new.email) in (select lower(email) from public.admin_emails)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5) Clean seller applications table only, because old schema caused cache errors
-- This removes only old seller applications, not users/posts/teams.
drop table if exists public.seller_applications cascade;

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  note text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id)
);

-- 6) Optional activity table for live center
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  username text,
  event_type text,
  body text,
  created_at timestamptz default now()
);

-- 7) RLS policies
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "profiles read visible" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own or admin" on public.profiles;
drop policy if exists "profiles admin all" on public.profiles;

create policy "profiles read visible"
on public.profiles for select
using (true);

create policy "profiles insert own"
on public.profiles for insert
with check (id = auth.uid() or public.is_admin());

create policy "profiles update own or admin"
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "profiles admin all"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "seller app insert own" on public.seller_applications;
drop policy if exists "seller app read own or admin" on public.seller_applications;
drop policy if exists "seller app update admin" on public.seller_applications;
drop policy if exists "seller app admin all" on public.seller_applications;

create policy "seller app insert own"
on public.seller_applications for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "seller app read own or admin"
on public.seller_applications for select
using (user_id = auth.uid() or public.is_admin());

create policy "seller app update admin"
on public.seller_applications for update
using (public.is_admin())
with check (public.is_admin());

create policy "seller app admin all"
on public.seller_applications for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "activity read all" on public.activity_events;
drop policy if exists "activity insert auth" on public.activity_events;

create policy "activity read all"
on public.activity_events for select
using (true);

create policy "activity insert auth"
on public.activity_events for insert
with check (auth.uid() is not null);

-- 8) Realtime publication. Already-member errors are harmless; this block ignores them.
do $$
begin
  begin alter publication supabase_realtime add table public.seller_applications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.activity_events; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
