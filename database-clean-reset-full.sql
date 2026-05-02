-- STACKOPS NEXUS WOW BACKEND RESET
-- SQL REQUIRED: YES for this ZIP.
-- WARNING: This drops StackOps public tables and recreates the backend.

create extension if not exists "uuid-ossp";

-- Drop app tables only. Do NOT drop public schema.
drop table if exists public.messages cascade;
drop table if exists public.squad_requests cascade;
drop table if exists public.friend_requests cascade;
drop table if exists public.orders cascade;
drop table if exists public.posts cascade;
drop table if exists public.services cascade;
drop table if exists public.squads cascade;
drop table if exists public.badges cascade;
drop table if exists public.plans cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  riot_id text,
  region text default 'India',
  main_game text default 'Valorant',
  role text not null default 'user' check (role in ('user','moderator','admin')),
  account_status text not null default 'approved' check (account_status in ('pending','approved','rejected','banned')),
  plan_key text default 'free',
  title text default 'Rookie',
  badge text default 'Starter',
  coins integer default 0,
  is_verified boolean default false,
  is_banned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  plan_key text unique not null,
  name text not null,
  price_inr integer not null default 0,
  title text,
  badge text,
  perks text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into public.plans (plan_key,name,price_inr,title,badge,perks,sort_order) values
('free','Free',0,'Rookie','Starter','Basic profile, squad browsing, pulse feed',1),
('spark','Spark',299,'Rising Player','Spark Badge','Profile glow, extra posts, friend boost',2),
('viper','Viper',999,'Verified Grinder','Viper Badge','Verified request, squad priority, service discounts',3),
('radiant','Radiant',2999,'Elite Operator','Radiant Badge','Animated title, leaderboard boost, creator tools',4),
('immortal','Immortal',5999,'StackOps VIP','Immortal Badge','VIP banner, premium matchmaking, admin-reviewed profile',5),
('legend','Legend',10000,'Nexus Legend','Crown Badge','Crown frame, top discovery, launch founder perks',6);

create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  badge_key text unique not null,
  name text not null,
  icon text default '✦',
  description text,
  rarity text default 'common',
  created_at timestamptz default now()
);

insert into public.badges (badge_key,name,icon,description,rarity) values
('starter','Starter','🎮','Joined StackOps Nexus','common'),
('verified','Verified','✅','Verified player or coach','rare'),
('coach','Coach','🎯','Approved coaching provider','rare'),
('admin_crown','Admin Crown','👑','Founder/admin identity badge','legendary'),
('legend','Nexus Legend','💎','Top premium member','legendary');

create table public.squads (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  game text default 'Valorant',
  region text,
  rank_required text,
  description text,
  status text default 'open' check (status in ('open','closed','archived')),
  created_at timestamptz default now()
);

create table public.squad_requests (
  id uuid primary key default uuid_generate_v4(),
  squad_id uuid references public.squads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now(),
  unique(squad_id,user_id)
);

create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  image_url text,
  like_count integer default 0,
  created_at timestamptz default now()
);

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  game text default 'Valorant',
  category text default 'Coaching',
  price_inr integer not null default 0,
  commission_percent integer not null default 15,
  status text default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_at timestamptz default now()
);

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  plan_key text references public.plans(plan_key) on delete set null,
  amount_inr integer not null default 0,
  platform_commission_inr integer default 0,
  payment_provider text,
  payment_ref text,
  status text default 'pending' check (status in ('pending','paid','cancelled','refunded','completed')),
  created_at timestamptz default now()
);

create table public.friend_requests (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now(),
  unique(sender_id,receiver_id)
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.badges enable row level security;
alter table public.squads enable row level security;
alter table public.squad_requests enable row level security;
alter table public.posts enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin' and is_banned = false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, account_status)
  values (new.id, split_part(new.email,'@',1), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'approved')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS policies
create policy "profiles read" on public.profiles for select using (account_status='approved' or id=auth.uid() or public.is_admin(auth.uid()));
create policy "profiles insert own" on public.profiles for insert with check (id=auth.uid());
create policy "profiles update own or admin" on public.profiles for update using (id=auth.uid() or public.is_admin(auth.uid())) with check (id=auth.uid() or public.is_admin(auth.uid()));

create policy "plans public read" on public.plans for select using (is_active=true or public.is_admin(auth.uid()));
create policy "plans admin manage" on public.plans for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "badges public read" on public.badges for select using (true);
create policy "badges admin manage" on public.badges for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "squads public read" on public.squads for select using (true);
create policy "squads owner create" on public.squads for insert with check (owner_id=auth.uid());
create policy "squads owner or admin update" on public.squads for update using (owner_id=auth.uid() or public.is_admin(auth.uid())) with check (owner_id=auth.uid() or public.is_admin(auth.uid()));
create policy "squads owner or admin delete" on public.squads for delete using (owner_id=auth.uid() or public.is_admin(auth.uid()));

create policy "squad requests related read" on public.squad_requests for select using (user_id=auth.uid() or public.is_admin(auth.uid()) or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid()));
create policy "squad requests create own" on public.squad_requests for insert with check (user_id=auth.uid());
create policy "squad requests update owner admin" on public.squad_requests for update using (public.is_admin(auth.uid()) or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid())) with check (public.is_admin(auth.uid()) or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid()));

create policy "posts public read" on public.posts for select using (true);
create policy "posts create own" on public.posts for insert with check (user_id=auth.uid());
create policy "posts update own admin" on public.posts for update using (user_id=auth.uid() or public.is_admin(auth.uid())) with check (user_id=auth.uid() or public.is_admin(auth.uid()));
create policy "posts delete own admin" on public.posts for delete using (user_id=auth.uid() or public.is_admin(auth.uid()));

create policy "services public approved read" on public.services for select using (status='approved' or owner_id=auth.uid() or public.is_admin(auth.uid()));
create policy "services create own" on public.services for insert with check (owner_id=auth.uid());
create policy "services update own admin" on public.services for update using (owner_id=auth.uid() or public.is_admin(auth.uid())) with check (owner_id=auth.uid() or public.is_admin(auth.uid()));
create policy "services delete admin" on public.services for delete using (public.is_admin(auth.uid()));

create policy "orders related read" on public.orders for select using (buyer_id=auth.uid() or public.is_admin(auth.uid()) or exists(select 1 from public.services s where s.id=service_id and s.owner_id=auth.uid()));
create policy "orders create buyer" on public.orders for insert with check (buyer_id=auth.uid());
create policy "orders admin update" on public.orders for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "friends read related" on public.friend_requests for select using (sender_id=auth.uid() or receiver_id=auth.uid() or public.is_admin(auth.uid()));
create policy "friends create own" on public.friend_requests for insert with check (sender_id=auth.uid());
create policy "friends update receiver admin" on public.friend_requests for update using (receiver_id=auth.uid() or public.is_admin(auth.uid())) with check (receiver_id=auth.uid() or public.is_admin(auth.uid()));

create policy "messages read related" on public.messages for select using (sender_id=auth.uid() or receiver_id=auth.uid() or public.is_admin(auth.uid()));
create policy "messages send own" on public.messages for insert with check (sender_id=auth.uid());
create policy "messages update receiver" on public.messages for update using (receiver_id=auth.uid() or public.is_admin(auth.uid())) with check (receiver_id=auth.uid() or public.is_admin(auth.uid()));

-- Storage buckets
insert into storage.buckets (id,name,public) values
('avatars','avatars',true),
('banners','banners',true),
('post-media','post-media',true),
('service-files','service-files',true)
on conflict (id) do nothing;

drop policy if exists "stackops public read storage" on storage.objects;
create policy "stackops public read storage" on storage.objects for select using (bucket_id in ('avatars','banners','post-media','service-files'));

drop policy if exists "stackops upload own storage" on storage.objects;
create policy "stackops upload own storage" on storage.objects for insert with check (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()));

drop policy if exists "stackops update own storage" on storage.objects;
create policy "stackops update own storage" on storage.objects for update using (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()));

drop policy if exists "stackops delete own storage" on storage.objects;
create policy "stackops delete own storage" on storage.objects for delete using (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()));

-- Make your provided UID admin if the profile exists already.
update public.profiles
set role='admin', account_status='approved', title='Founder Admin', badge='Admin Crown', is_verified=true, is_banned=false
where id='02cc6cac-0131-43a3-9385-5965ed5f1e85';
