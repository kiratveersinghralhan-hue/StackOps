-- STACKOPS NEXUS ULTRA PRODUCTION RESET
-- SQL REQUIRED: YES for this ZIP.
-- This resets StackOps app tables only. It keeps auth.users intact.
-- Run in Supabase SQL Editor, then run the final admin update block at bottom.

create extension if not exists "uuid-ossp";

-- Drop old app objects in dependency-safe order
drop table if exists public.matchmaking_queue cascade;
drop table if exists public.messages cascade;
drop table if exists public.order_events cascade;
drop table if exists public.orders cascade;
drop table if exists public.friend_requests cascade;
drop table if exists public.squad_members cascade;
drop table if exists public.squads cascade;
drop table if exists public.posts cascade;
drop table if exists public.services cascade;
drop table if exists public.plans cascade;
drop table if exists public.badges cascade;
drop table if exists public.profiles cascade;
drop function if exists public.is_admin(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_updated_at() cascade;

-- Helpers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  riot_id text,
  region text,
  main_game text default 'Valorant',
  rank_label text,
  playstyle text,
  role text default 'user' check (role in ('user','moderator','admin')),
  account_status text default 'pending' check (account_status in ('pending','approved','rejected','banned')),
  plan_key text default 'free',
  title text default 'Rookie',
  badge text default 'Starter',
  coins integer default 0,
  reputation integer default 0,
  is_verified boolean default false,
  is_banned boolean default false,
  featured_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and is_banned = false and account_status = 'approved'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, account_status)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1), 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Plans and rewards
create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  plan_key text unique not null,
  name text not null,
  price_inr integer not null check (price_inr >= 0),
  badge text,
  title text,
  monthly_boosts integer default 0,
  perks jsonb default '[]'::jsonb,
  active boolean default true,
  created_at timestamptz default now()
);

insert into public.plans (plan_key,name,price_inr,badge,title,monthly_boosts,perks) values
('free','Free',0,'Starter','Rookie',0,'["Basic profile","Join public squads","Use global chat"]'),
('silver','Silver',499,'Silver Badge','Rising Gamer',2,'["Silver badge","Extra squad invites","Profile accent"]'),
('gold','Gold',1499,'Gold Badge','Elite Player',6,'["Animated title","Discovery boost","Service listing access"]'),
('diamond','Diamond',4999,'Diamond Badge','Pro Grinder',15,'["Premium profile","Featured services","Priority matchmaking"]'),
('legend','Legend',10000,'Crown Badge','StackOps Legend',40,'["Crown badge","Top profile boost","VIP support","Founder wall"]');

create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  badge_key text unique not null,
  name text not null,
  icon text default '◆',
  description text,
  rarity text default 'common',
  created_at timestamptz default now()
);

insert into public.badges (badge_key,name,icon,description,rarity) values
('starter','Starter','◇','Joined StackOps Nexus','common'),
('verified','Verified','✓','Verified gamer profile','rare'),
('admin_crown','Admin Crown','👑','Founder or admin authority','mythic'),
('coach','Coach','🎯','Approved service coach','rare'),
('legend','Crown Badge','♛','Legend plan member','mythic');

-- Social and marketplace
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  content text,
  image_url text,
  created_at timestamptz default now()
);

create table public.squads (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  game text default 'Valorant',
  region text,
  rank_required text,
  description text,
  max_members integer default 5,
  is_open boolean default true,
  created_at timestamptz default now()
);

create table public.squad_members (
  id uuid primary key default uuid_generate_v4(),
  squad_id uuid references public.squads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','approved','rejected','left')),
  created_at timestamptz default now(),
  unique(squad_id,user_id)
);

create table public.friend_requests (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','rejected','blocked')),
  created_at timestamptz default now(),
  unique(sender_id,receiver_id)
);

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  game text default 'Valorant',
  category text default 'coaching' check (category in ('coaching','vod_review','verification','team_building','other')),
  price_inr integer not null default 0 check (price_inr >= 0),
  commission_percent integer default 15 check (commission_percent between 0 and 80),
  status text default 'pending' check (status in ('pending','approved','rejected','paused')),
  cover_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();

-- Payments/orders. Razorpay can update these from an Edge Function later.
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid references public.profiles(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  plan_key text references public.plans(plan_key) on delete set null,
  amount_inr integer not null check (amount_inr >= 0),
  platform_commission_inr integer default 0,
  seller_payout_inr integer default 0,
  payment_provider text default 'manual',
  provider_order_id text,
  provider_payment_id text,
  status text default 'pending' check (status in ('pending','paid','cancelled','refunded','completed','failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  note text,
  created_at timestamptz default now()
);

-- Chat and matchmaking
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  channel text default 'global',
  sender_id uuid references public.profiles(id) on delete cascade,
  sender_name text,
  content text not null,
  created_at timestamptz default now()
);

create table public.matchmaking_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  game text default 'Valorant',
  region text,
  rank_label text,
  playstyle text,
  status text default 'searching' check (status in ('searching','matched','cancelled')),
  created_at timestamptz default now(),
  unique(user_id, game, status)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.badges enable row level security;
alter table public.posts enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.friend_requests enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.messages enable row level security;
alter table public.matchmaking_queue enable row level security;

-- Profiles
create policy "profiles readable" on public.profiles for select using (account_status = 'approved' or id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update own or admin" on public.profiles for update using (id = auth.uid() or public.is_admin(auth.uid())) with check (id = auth.uid() or public.is_admin(auth.uid()));

-- Public read tables
create policy "plans public read" on public.plans for select using (active = true or public.is_admin(auth.uid()));
create policy "plans admin manage" on public.plans for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "badges public read" on public.badges for select using (true);
create policy "badges admin manage" on public.badges for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Posts
create policy "posts public read" on public.posts for select using (true);
create policy "posts own insert" on public.posts for insert with check (user_id = auth.uid());
create policy "posts own admin update" on public.posts for update using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "posts own admin delete" on public.posts for delete using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Squads
create policy "squads public read" on public.squads for select using (true);
create policy "squads own insert" on public.squads for insert with check (owner_id = auth.uid());
create policy "squads own admin manage" on public.squads for all using (owner_id = auth.uid() or public.is_admin(auth.uid())) with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy "squad members own read" on public.squad_members for select using (user_id = auth.uid() or public.is_admin(auth.uid()) or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid()));
create policy "squad members join" on public.squad_members for insert with check (user_id = auth.uid());
create policy "squad members update owner admin" on public.squad_members for update using (public.is_admin(auth.uid()) or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid())) with check (public.is_admin(auth.uid()) or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid()));

-- Friends
create policy "friends own read" on public.friend_requests for select using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin(auth.uid()));
create policy "friends send" on public.friend_requests for insert with check (sender_id = auth.uid());
create policy "friends receiver update" on public.friend_requests for update using (receiver_id = auth.uid() or public.is_admin(auth.uid())) with check (receiver_id = auth.uid() or public.is_admin(auth.uid()));

-- Services
create policy "services approved read" on public.services for select using (status = 'approved' or owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy "services owner insert" on public.services for insert with check (owner_id = auth.uid());
create policy "services owner admin update" on public.services for update using (owner_id = auth.uid() or public.is_admin(auth.uid())) with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy "services admin delete" on public.services for delete using (public.is_admin(auth.uid()));

-- Orders
create policy "orders buyer seller admin read" on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()));
create policy "orders buyer insert" on public.orders for insert with check (buyer_id = auth.uid());
create policy "orders admin update" on public.orders for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "order events related read" on public.order_events for select using (public.is_admin(auth.uid()) or exists(select 1 from public.orders o where o.id=order_id and (o.buyer_id=auth.uid() or o.seller_id=auth.uid())));
create policy "order events admin insert" on public.order_events for insert with check (public.is_admin(auth.uid()));

-- Messages
create policy "messages read" on public.messages for select using (true);
create policy "messages send approved" on public.messages for insert with check (sender_id = auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='approved' and p.is_banned=false));
create policy "messages admin delete" on public.messages for delete using (public.is_admin(auth.uid()));

-- Matchmaking
create policy "matchmaking own admin read" on public.matchmaking_queue for select using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "matchmaking own insert" on public.matchmaking_queue for insert with check (user_id = auth.uid());
create policy "matchmaking own update" on public.matchmaking_queue for update using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Storage buckets
insert into storage.buckets (id, name, public) values
('avatars','avatars',true),
('banners','banners',true),
('posts','posts',true),
('service-files','service-files',true)
on conflict (id) do nothing;

drop policy if exists "stackops public read storage" on storage.objects;
drop policy if exists "stackops users upload own storage" on storage.objects;
drop policy if exists "stackops users update own storage" on storage.objects;
drop policy if exists "stackops users delete own storage" on storage.objects;

create policy "stackops public read storage" on storage.objects for select using (bucket_id in ('avatars','banners','posts','service-files'));
create policy "stackops users upload own storage" on storage.objects for insert with check (bucket_id in ('avatars','banners','posts','service-files') and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid())));
create policy "stackops users update own storage" on storage.objects for update using (bucket_id in ('avatars','banners','posts','service-files') and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid())));
create policy "stackops users delete own storage" on storage.objects for delete using (bucket_id in ('avatars','banners','posts','service-files') and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid())));

-- Make your UID admin. This works after your auth user exists.
update public.profiles set
  role='admin',
  account_status='approved',
  title='Founder 👑',
  badge='Admin Crown',
  is_verified=true,
  is_banned=false
where id = '02cc6cac-0131-43a3-9385-5965ed5f1e85';

-- Optional verification query
select id, username, role, account_status, title, badge from public.profiles where id = '02cc6cac-0131-43a3-9385-5965ed5f1e85';
