-- StackOps Nexus Production Starter Schema
-- WARNING: This cleans old StackOps tables. Run only on a fresh/dev project or after backup.
-- After running, set one user as admin:
-- update public.profiles set role='admin', status='approved', title='ADMIN OVERLORD', badge_name='Admin Crown' where email='your@email.com';

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Clean previous app data
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.invites CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.plan_orders CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Helper
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  riot_id text,
  main_game text default 'Valorant',
  rank text,
  region text default 'India',
  player_role text,
  bio text,
  avatar_url text,
  cover_url text,
  role text not null default 'user' check (role in ('user','coach','moderator','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','banned')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  looking_for_squad boolean default false,
  plan_id uuid,
  plan_name text default 'Free',
  badge_name text default 'Recruit',
  title text default 'Recruit',
  reward_points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Plans up to INR 10000
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null check (price >= 0 and price <= 10000),
  badge_name text,
  title_reward text,
  features jsonb default '[]'::jsonb,
  monthly_boosts integer default 0,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- User plan purchase / manual verification requests
create table public.plan_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_id uuid references public.plans(id) on delete set null,
  amount integer not null,
  status text default 'pending_verification' check (status in ('pending_payment','pending_verification','verified','rejected','refunded')),
  payment_note text,
  gateway_reference text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz default now()
);

-- Badges and titles
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '◆',
  rarity text default 'Common',
  description text,
  reward_points integer default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Social posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  media_url text,
  visibility text default 'public' check (visibility in ('public','friends','private')),
  created_at timestamptz default now()
);

-- Friend/squad invites
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references public.profiles(id) on delete cascade not null,
  to_user uuid references public.profiles(id) on delete cascade not null,
  message text,
  status text default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz default now(),
  unique(from_user, to_user, status)
);

-- Service marketplace: coaching, verification, VOD review, graphics, team trials
create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  category text not null,
  price integer not null check (price >= 0),
  duration text,
  description text,
  thumbnail_url text,
  status text default 'pending' check (status in ('pending','approved','rejected','paused')),
  commission_rate numeric(5,2) default 15.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bookings/commission records
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  commission_amount integer not null default 0,
  status text default 'pending_payment' check (status in ('pending_payment','paid','completed','cancelled','refunded')),
  payment_reference text,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

-- Reports/moderation queue
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_user uuid references public.profiles(id) on delete cascade,
  reason text,
  status text default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz default now()
);

-- Seed plans
insert into public.plans (name, price, badge_name, title_reward, features, monthly_boosts, sort_order) values
('Recruit Pass', 199, 'Recruit+', 'Rising Recruit', '["Profile frame","Starter badge","Basic squad visibility"]', 1, 1),
('Elite Pass', 999, 'Elite', 'Elite Operator', '["Animated badge","Priority discover","5 service boosts","Premium profile theme"]', 5, 2),
('Immortal Club', 2999, 'Immortal', 'Immortal Flex', '["Neon profile aura","Verified priority","Tournament perks","Creator listing boost"]', 12, 3),
('Radiant Partner', 10000, 'Radiant Crown', 'Radiant Founder', '["Crown badge","Top profile placement","Concierge support","Creator launch kit","Highest marketplace visibility"]', 30, 4);

insert into public.badges (name, icon, rarity, description, reward_points, sort_order) values
('Admin Crown','♛','Mythic','Only platform owners/admins get this special crown banner.',10000,1),
('Verified Coach','◆','Epic','Approved teacher, coach or service provider.',1500,2),
('Radiant Crown','☄','Mythic','Reward for Radiant Partner plan.',5000,3),
('Founder','✦','Legendary','Early supporter or launch partner.',2500,4),
('Squad Hunter','⚡','Rare','Active player who helps squads form.',600,5),
('Recruit','●','Common','Default new player badge.',0,6);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']),
('covers', 'covers', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
('post-media', 'post-media', true, 52428800, array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']),
('service-media', 'service-media', true, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- RLS
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_orders enable row level security;
alter table public.badges enable row level security;
alter table public.posts enable row level security;
alter table public.invites enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.reports enable row level security;

-- Profiles policies
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (status <> 'banned' or auth.uid() = id or public.is_admin(auth.uid()));
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Public read tables
drop policy if exists "plans public read" on public.plans;
create policy "plans public read" on public.plans for select using (is_active = true or public.is_admin(auth.uid()));
drop policy if exists "badges public read" on public.badges;
create policy "badges public read" on public.badges for select using (true);
drop policy if exists "admins manage plans" on public.plans;
create policy "admins manage plans" on public.plans for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "admins manage badges" on public.badges;
create policy "admins manage badges" on public.badges for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Orders
drop policy if exists "users create own orders" on public.plan_orders;
create policy "users create own orders" on public.plan_orders for insert with check (auth.uid() = user_id);
drop policy if exists "users read own orders" on public.plan_orders;
create policy "users read own orders" on public.plan_orders for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "admins manage orders" on public.plan_orders;
create policy "admins manage orders" on public.plan_orders for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Posts
drop policy if exists "public posts read" on public.posts;
create policy "public posts read" on public.posts for select using (visibility = 'public' or auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "users create posts" on public.posts;
create policy "users create posts" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "users update own posts" on public.posts;
create policy "users update own posts" on public.posts for update using (auth.uid() = user_id or public.is_admin(auth.uid())) with check (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Invites
drop policy if exists "invite participants read" on public.invites;
create policy "invite participants read" on public.invites for select using (auth.uid() = from_user or auth.uid() = to_user or public.is_admin(auth.uid()));
drop policy if exists "users send invites" on public.invites;
create policy "users send invites" on public.invites for insert with check (auth.uid() = from_user);
drop policy if exists "participants update invites" on public.invites;
create policy "participants update invites" on public.invites for update using (auth.uid() = from_user or auth.uid() = to_user or public.is_admin(auth.uid()));

-- Services and bookings
drop policy if exists "approved services public read" on public.services;
create policy "approved services public read" on public.services for select using (status='approved' or auth.uid()=provider_id or public.is_admin(auth.uid()));
drop policy if exists "providers create services" on public.services;
create policy "providers create services" on public.services for insert with check (auth.uid()=provider_id);
drop policy if exists "providers update own pending services" on public.services;
create policy "providers update own pending services" on public.services for update using (auth.uid()=provider_id or public.is_admin(auth.uid())) with check (auth.uid()=provider_id or public.is_admin(auth.uid()));
drop policy if exists "admins manage services" on public.services;
create policy "admins manage services" on public.services for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "buyers create bookings" on public.bookings;
create policy "buyers create bookings" on public.bookings for insert with check (auth.uid()=buyer_id);
drop policy if exists "booking parties read" on public.bookings;
create policy "booking parties read" on public.bookings for select using (auth.uid()=buyer_id or public.is_admin(auth.uid()) or exists(select 1 from public.services s where s.id=service_id and s.provider_id=auth.uid()));
drop policy if exists "admins manage bookings" on public.bookings;
create policy "admins manage bookings" on public.bookings for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Reports
drop policy if exists "users create reports" on public.reports;
create policy "users create reports" on public.reports for insert with check (auth.uid()=reporter_id);
drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports for select using (public.is_admin(auth.uid()));
drop policy if exists "admins manage reports" on public.reports;
create policy "admins manage reports" on public.reports for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Storage RLS policies
-- Note: Supabase Storage policies live on storage.objects.
drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects for select using (bucket_id in ('avatars','covers','post-media','service-media'));
drop policy if exists "users upload own avatar folder" on storage.objects;
create policy "users upload own avatar folder" on storage.objects for insert with check (bucket_id in ('avatars','covers','post-media','service-media') and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "users update own storage" on storage.objects;
create policy "users update own storage" on storage.objects for update using (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()));
drop policy if exists "users delete own storage" on storage.objects;
create policy "users delete own storage" on storage.objects for delete using (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()));
