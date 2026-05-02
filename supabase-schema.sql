-- StackOps Supabase schema
-- Run this in Supabase SQL editor before going live.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text not null,
  rank text,
  main_agent text,
  region text,
  language text,
  bio text,
  created_at timestamptz default now()
);
create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  game text default 'Valorant',
  looking_for text,
  description text,
  created_at timestamptz default now()
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  created_at timestamptz default now()
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  date text,
  prize text,
  description text,
  created_at timestamptz default now()
);
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  game text,
  mode text,
  time text,
  note text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.squads enable row level security;
alter table public.posts enable row level security;
alter table public.events enable row level security;
alter table public.invites enable row level security;

-- Public read for community discovery. Tighten later if needed.
create policy "public read profiles" on public.profiles for select using (true);
create policy "public read squads" on public.squads for select using (true);
create policy "public read posts" on public.posts for select using (true);
create policy "public read events" on public.events for select using (true);

-- Signed-in users can create their own content.
create policy "authenticated insert profiles" on public.profiles for insert to authenticated with check (auth.uid() = user_id or user_id is null);
create policy "authenticated insert squads" on public.squads for insert to authenticated with check (auth.uid() = user_id or user_id is null);
create policy "authenticated insert posts" on public.posts for insert to authenticated with check (auth.uid() = user_id or user_id is null);
create policy "authenticated insert events" on public.events for insert to authenticated with check (auth.uid() = user_id or user_id is null);
create policy "authenticated insert invites" on public.invites for insert to authenticated with check (auth.uid() = user_id or user_id is null);

-- Owners can update/delete their own rows.
create policy "owner update profiles" on public.profiles for update using (auth.uid() = user_id);
create policy "owner delete profiles" on public.profiles for delete using (auth.uid() = user_id);
create policy "owner update squads" on public.squads for update using (auth.uid() = user_id);
create policy "owner delete squads" on public.squads for delete using (auth.uid() = user_id);
create policy "owner update posts" on public.posts for update using (auth.uid() = user_id);
create policy "owner delete posts" on public.posts for delete using (auth.uid() = user_id);
create policy "owner update events" on public.events for update using (auth.uid() = user_id);
create policy "owner delete events" on public.events for delete using (auth.uid() = user_id);
