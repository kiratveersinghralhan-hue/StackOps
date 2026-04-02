create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text unique,
  display_name text,
  current_rank text,
  peak_rank text,
  preferred_role text,
  region text,
  mic_preference text,
  language_list text[],
  verification_status text default 'self-reported',
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  rank_target text,
  region text,
  looking_for text,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  host_id uuid,
  title text not null,
  region text,
  start_at timestamptz,
  max_teams integer default 16,
  status text default 'open',
  description text,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  title text not null,
  body text,
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid,
  target_type text,
  target_id text,
  reason text,
  details text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.tournaments enable row level security;
alter table public.posts enable row level security;
alter table public.reports enable row level security;
