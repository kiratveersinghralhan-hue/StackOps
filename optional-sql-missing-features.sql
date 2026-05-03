-- StackOps Optional Missing Feature Tables
-- Run only if your current database is missing these tables.
-- This file is SAFE: it uses IF NOT EXISTS and DROP POLICY IF EXISTS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  riot_id text,
  gender text,
  main_game text default 'Valorant',
  bio text,
  avatar_url text,
  custom_banner_url text,
  selected_banner_key text default 'default',
  title text default 'Rookie',
  badge text default 'Starter Spark',
  role text default 'user',
  account_status text default 'approved',
  is_verified boolean default false,
  is_banned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  game text default 'Valorant',
  region text,
  rank_required text,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade,
  sender_name text,
  channel text default 'global',
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  amount_inr integer not null,
  commission_inr integer default 0,
  provider text default 'razorpay',
  provider_payment_id text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Admin by email. Edit emails if needed.
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
      and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
      and coalesce(p.is_banned,false) = false
  );
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;
alter table public.seller_applications enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert with check (id = auth.uid() or public.is_admin());

drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams for select using (true);
drop policy if exists "teams own insert" on public.teams;
create policy "teams own insert" on public.teams for insert with check (owner_id = auth.uid());
drop policy if exists "teams own delete" on public.teams;
create policy "teams own delete" on public.teams for delete using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);
drop policy if exists "posts own insert" on public.posts;
create policy "posts own insert" on public.posts for insert with check (user_id = auth.uid());
drop policy if exists "posts own delete" on public.posts;
create policy "posts own delete" on public.posts for delete using (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select using (true);
drop policy if exists "messages own insert" on public.messages;
create policy "messages own insert" on public.messages for insert with check (sender_id = auth.uid());

drop policy if exists "seller app own read" on public.seller_applications;
create policy "seller app own read" on public.seller_applications for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "seller app own insert" on public.seller_applications;
create policy "seller app own insert" on public.seller_applications for insert with check (user_id = auth.uid());
drop policy if exists "seller app admin update" on public.seller_applications;
create policy "seller app admin update" on public.seller_applications for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments own read" on public.payments;
create policy "payments own read" on public.payments for select using (buyer_id = auth.uid() or public.is_admin());
drop policy if exists "payments own insert" on public.payments;
create policy "payments own insert" on public.payments for insert with check (buyer_id = auth.uid());

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public) values
('avatars','avatars',true),('banners','banners',true),('posts','posts',true)
on conflict (id) do nothing;

drop policy if exists "storage public read" on storage.objects;
create policy "storage public read" on storage.objects for select using (true);
drop policy if exists "storage users upload own" on storage.objects;
create policy "storage users upload own" on storage.objects for insert with check (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin());
drop policy if exists "storage users update own" on storage.objects;
create policy "storage users update own" on storage.objects for update using (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin());
drop policy if exists "storage users delete own" on storage.objects;
create policy "storage users delete own" on storage.objects for delete using (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin());

-- Realtime: run these manually only if not already added. Ignore "already member" messages.
-- alter publication supabase_realtime add table public.messages;
-- alter publication supabase_realtime add table public.notifications;
