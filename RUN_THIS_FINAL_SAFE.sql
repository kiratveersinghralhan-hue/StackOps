-- StackOps final safe SQL for seller applications, admin desk, profile access
-- Run once in Supabase SQL Editor.

-- Required extensions
create extension if not exists pgcrypto;

-- Admin email helper
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

-- Profiles safety
alter table if exists public.profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists is_seller boolean default false,
  add column if not exists seller_status text default 'none',
  add column if not exists is_verified boolean default false,
  add column if not exists plan_key text default 'free',
  add column if not exists xp integer default 0;

-- Seller application table matching the website code
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

-- Add columns if table existed already
alter table public.seller_applications
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists applicant_email text,
  add column if not exists applicant_name text,
  add column if not exists note text,
  add column if not exists status text default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now();

-- Grants
 grant usage on schema public to anon, authenticated, service_role;
 grant select, insert, update, delete on public.seller_applications to authenticated;
 grant select, insert, update on public.profiles to authenticated;
 grant all on public.seller_applications to service_role;
 grant all on public.profiles to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;

-- Drop old policies to prevent conflicts
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='seller_applications' LOOP
    EXECUTE format('drop policy if exists %I on public.seller_applications', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('drop policy if exists %I on public.profiles', r.policyname);
  END LOOP;
END $$;

-- Profiles policies
create policy "profiles public read" on public.profiles
for select to authenticated using (true);

create policy "profiles own insert" on public.profiles
for insert to authenticated with check (auth.uid() = id or public.is_admin());

create policy "profiles own update or admin" on public.profiles
for update to authenticated using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- Seller application policies
create policy "seller apps insert own" on public.seller_applications
for insert to authenticated with check (auth.uid() = user_id or public.is_admin());

create policy "seller apps read own or admin" on public.seller_applications
for select to authenticated using (auth.uid() = user_id or public.is_admin());

create policy "seller apps update admin" on public.seller_applications
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "seller apps delete admin" on public.seller_applications
for delete to authenticated using (public.is_admin());

-- Auto profile creation for future users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Make your existing admin profile safe
insert into public.profiles (id, username, display_name, is_seller, seller_status, plan_key, is_verified, xp)
select id, split_part(email,'@',1), split_part(email,'@',1), true, 'approved', 'premium', true, 1500
from auth.users
where lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
on conflict (id) do update set
  is_seller=true,
  seller_status='approved',
  plan_key='premium',
  is_verified=true,
  xp=greatest(coalesce(public.profiles.xp,0),1500);

-- Realtime: ignore duplicate errors manually if Supabase says already member.
DO $$
BEGIN
  BEGIN alter publication supabase_realtime add table public.seller_applications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
