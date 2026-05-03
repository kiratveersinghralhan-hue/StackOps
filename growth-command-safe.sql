-- StackOps Growth Command Safe Migration
-- SQL REQUIRED: YES for the new live center, Discord-style servers, admin live feed, and safer post/seller flows.
-- Safe: does not delete existing data.

create extension if not exists pgcrypto;

-- Profiles: add retention/live fields if missing
alter table public.profiles add column if not exists xp integer default 0;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists invite_count integer default 0;
alter table public.profiles add column if not exists daily_streak integer default 0;
alter table public.profiles add column if not exists last_daily_claim date;
alter table public.profiles add column if not exists selected_banner_key text default 'default';
alter table public.profiles add column if not exists badge text default 'Starter Spark';
alter table public.profiles add column if not exists title text default 'Rookie';
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists is_banned boolean default false;
alter table public.profiles add column if not exists account_status text default 'approved';

create unique index if not exists profiles_referral_code_key on public.profiles(referral_code) where referral_code is not null;

-- Live public activity center
create table if not exists public.live_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  type text default 'activity',
  content text not null,
  created_at timestamptz default now()
);
alter table public.live_activity enable row level security;
drop policy if exists "live activity public read" on public.live_activity;
create policy "live activity public read" on public.live_activity for select using (true);
drop policy if exists "live activity logged insert" on public.live_activity;
create policy "live activity logged insert" on public.live_activity for insert with check (auth.uid() = user_id or user_id is null);

-- Discord-style servers
create table if not exists public.chat_servers (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  visibility text default 'public' check (visibility in ('public','private')),
  invite_code text unique,
  created_at timestamptz default now()
);
alter table public.chat_servers enable row level security;
drop policy if exists "chat servers visible" on public.chat_servers;
create policy "chat servers visible" on public.chat_servers for select using (visibility='public' or owner_id=auth.uid() or public.is_admin());
drop policy if exists "chat servers owner create" on public.chat_servers;
create policy "chat servers owner create" on public.chat_servers for insert with check (owner_id=auth.uid());
drop policy if exists "chat servers owner admin update" on public.chat_servers;
create policy "chat servers owner admin update" on public.chat_servers for update using (owner_id=auth.uid() or public.is_admin()) with check (owner_id=auth.uid() or public.is_admin());
drop policy if exists "chat servers owner admin delete" on public.chat_servers;
create policy "chat servers owner admin delete" on public.chat_servers for delete using (owner_id=auth.uid() or public.is_admin());

-- Voice rooms metadata
create table if not exists public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  server_id text references public.chat_servers(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  visibility text default 'public' check (visibility in ('public','private')),
  created_at timestamptz default now()
);
alter table public.voice_rooms enable row level security;
drop policy if exists "voice rooms visible" on public.voice_rooms;
create policy "voice rooms visible" on public.voice_rooms for select using (visibility='public' or owner_id=auth.uid() or public.is_admin());
drop policy if exists "voice rooms create" on public.voice_rooms;
create policy "voice rooms create" on public.voice_rooms for insert with check (owner_id=auth.uid());

-- Seller applications if missing
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  created_at timestamptz default now()
);
alter table public.seller_applications enable row level security;
drop policy if exists "seller own or admin read" on public.seller_applications;
create policy "seller own or admin read" on public.seller_applications for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists "seller apply own" on public.seller_applications;
create policy "seller apply own" on public.seller_applications for insert with check (user_id=auth.uid());
drop policy if exists "seller admin update" on public.seller_applications;
create policy "seller admin update" on public.seller_applications for update using (public.is_admin()) with check (public.is_admin());

-- Community post delete safety
alter table public.posts enable row level security;
drop policy if exists "posts owner admin delete" on public.posts;
create policy "posts owner admin delete" on public.posts for delete using (user_id=auth.uid() or public.is_admin());

-- Messages realtime-friendly policy safety
alter table public.messages enable row level security;
drop policy if exists "messages read public" on public.messages;
create policy "messages read public" on public.messages for select using (true);
drop policy if exists "messages insert logged" on public.messages;
create policy "messages insert logged" on public.messages for insert with check (sender_id=auth.uid());

-- Add tables to realtime publication only if not already added.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='messages')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='posts')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='seller_applications')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='seller_applications') then
    alter publication supabase_realtime add table public.seller_applications;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='live_activity')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_activity') then
    alter publication supabase_realtime add table public.live_activity;
  end if;
end $$;
