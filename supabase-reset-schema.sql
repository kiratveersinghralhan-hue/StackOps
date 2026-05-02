-- STACKOPS NEXUS PRODUCTION RESET SQL
-- WARNING: deletes/recreates public tables. Auth users remain.

create extension if not exists "uuid-ossp";

drop table if exists public.orders cascade;
drop table if exists public.friend_requests cascade;
drop table if exists public.squads cascade;
drop table if exists public.posts cascade;
drop table if exists public.services cascade;
drop table if exists public.badges cascade;
drop table if exists public.plans cascade;
drop table if exists public.profiles cascade;
drop function if exists public.is_admin(uuid) cascade;
drop function if exists public.handle_new_user() cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  riot_id text,
  rank text,
  region text default 'India',
  main_game text default 'Valorant',
  player_role text,
  role text default 'user' check (role in ('user','admin','moderator')),
  account_status text default 'pending' check (account_status in ('pending','approved','rejected','banned')),
  plan_key text default 'free',
  title text default 'Rookie',
  badge text default 'Starter',
  coins integer default 0,
  is_verified boolean default false,
  is_banned boolean default false,
  looking_for_squad boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin' and is_banned = false);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, account_status)
  values (new.id, split_part(new.email,'@',1), split_part(new.email,'@',1), 'pending')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  plan_key text unique not null,
  name text not null,
  price_inr integer not null,
  badge text,
  title text,
  perks jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);
insert into public.plans (plan_key,name,price_inr,badge,title,perks) values
('free','Free',0,'Starter','Rookie','["Basic profile","Join squads"]'),
('silver','Silver',499,'Silver Badge','Rising Gamer','["Badge","More invites"]'),
('gold','Gold',1499,'Gold Badge','Elite Player','["Animated title","Priority discover"]'),
('diamond','Diamond',4999,'Diamond Badge','Pro Grinder','["Premium aura","Boosted services"]'),
('legend','Legend',10000,'Crown Badge','StackOps Legend','["Crown badge","Top placement","VIP support"]');

create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  icon text default '◆',
  rarity text default 'Rare',
  description text,
  sort_order integer default 0
);
insert into public.badges (name,icon,rarity,description,sort_order) values
('Admin Crown','♛','Mythic','Special crown for admins and founders.',1),
('Verified Coach','◆','Epic','Approved coaching provider.',2),
('Squad Hunter','⚡','Rare','Active teammate finder.',3),
('Founder','✦','Legendary','Early supporter identity.',4),
('Radiant Crown','☄','Mythic','₹10,000 premium badge.',5);

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  game text default 'Valorant',
  category text default 'coaching',
  price_inr integer not null default 0,
  commission_percent integer default 15,
  status text default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_at timestamptz default now()
);

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  plan_key text,
  amount_inr integer not null,
  platform_commission_inr integer default 0,
  status text default 'pending' check (status in ('pending','paid','cancelled','refunded','completed')),
  created_at timestamptz default now()
);

create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  body text,
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
  created_at timestamptz default now()
);

create table public.friend_requests (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.badges enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.posts enable row level security;
alter table public.squads enable row level security;
alter table public.friend_requests enable row level security;

create policy "profiles read" on public.profiles for select using (account_status='approved' or id=auth.uid() or public.is_admin(auth.uid()));
create policy "profiles insert own" on public.profiles for insert with check (id=auth.uid());
create policy "profiles update own admin" on public.profiles for update using (id=auth.uid() or public.is_admin(auth.uid())) with check (id=auth.uid() or public.is_admin(auth.uid()));

create policy "plans read" on public.plans for select using (true);
create policy "plans admin" on public.plans for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "badges read" on public.badges for select using (true);
create policy "badges admin" on public.badges for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "services read" on public.services for select using (status='approved' or owner_id=auth.uid() or public.is_admin(auth.uid()));
create policy "services create" on public.services for insert with check (owner_id=auth.uid());
create policy "services update" on public.services for update using (owner_id=auth.uid() or public.is_admin(auth.uid())) with check (owner_id=auth.uid() or public.is_admin(auth.uid()));

create policy "orders read" on public.orders for select using (buyer_id=auth.uid() or public.is_admin(auth.uid()));
create policy "orders create" on public.orders for insert with check (buyer_id=auth.uid());
create policy "orders update admin" on public.orders for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "posts read" on public.posts for select using (true);
create policy "posts create" on public.posts for insert with check (user_id=auth.uid());
create policy "posts manage" on public.posts for all using (user_id=auth.uid() or public.is_admin(auth.uid())) with check (user_id=auth.uid() or public.is_admin(auth.uid()));

create policy "squads read" on public.squads for select using (true);
create policy "squads create" on public.squads for insert with check (owner_id=auth.uid());
create policy "squads manage" on public.squads for all using (owner_id=auth.uid() or public.is_admin(auth.uid())) with check (owner_id=auth.uid() or public.is_admin(auth.uid()));

create policy "friends read" on public.friend_requests for select using (sender_id=auth.uid() or receiver_id=auth.uid() or public.is_admin(auth.uid()));
create policy "friends create" on public.friend_requests for insert with check (sender_id=auth.uid());
create policy "friends update" on public.friend_requests for update using (receiver_id=auth.uid() or public.is_admin(auth.uid())) with check (receiver_id=auth.uid() or public.is_admin(auth.uid()));

insert into storage.buckets (id,name,public) values
('avatars','avatars',true),('banners','banners',true),('posts','posts',true),('service-files','service-files',true)
on conflict (id) do nothing;

drop policy if exists "public read storage" on storage.objects;
create policy "public read storage" on storage.objects for select using (bucket_id in ('avatars','banners','posts','service-files'));
drop policy if exists "users upload own storage" on storage.objects;
create policy "users upload own storage" on storage.objects for insert with check (auth.uid()::text=(storage.foldername(name))[1] or public.is_admin(auth.uid()));
drop policy if exists "users update own storage" on storage.objects;
create policy "users update own storage" on storage.objects for update using (auth.uid()::text=(storage.foldername(name))[1] or public.is_admin(auth.uid()));
drop policy if exists "users delete own storage" on storage.objects;
create policy "users delete own storage" on storage.objects for delete using (auth.uid()::text=(storage.foldername(name))[1] or public.is_admin(auth.uid()));

-- Make yourself admin after running reset:
-- update public.profiles set role='admin', account_status='approved', title='Founder 👑', badge='Admin Crown', is_verified=true where id='02cc6cac-0131-43a3-9385-5965ed5f1e85';
