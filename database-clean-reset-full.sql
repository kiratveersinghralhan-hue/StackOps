-- STACKOPS FUNLOBBY PRO - CLEAN BACKEND RESET
-- SQL REQUIRED: YES
-- WARNING: This drops all public StackOps tables/data. It does not delete auth.users.
-- IMPORTANT: Replace YOUR_ADMIN_EMAIL@example.com with your real admin email before running.

begin;

drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;

create extension if not exists "uuid-ossp";

-- Admin is EMAIL based, not UID based.
create table public.admin_emails (
  email text primary key,
  label text default 'Admin',
  created_at timestamptz default now()
);

insert into public.admin_emails(email,label)
values ('YOUR_ADMIN_EMAIL@example.com','Founder Admin')
on conflict (email) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  riot_id text,
  region text,
  main_game text default 'Valorant',
  rank text,
  playstyle text,
  role text default 'user' check (role in ('user','admin','moderator','coach')),
  account_status text default 'approved' check (account_status in ('pending','approved','rejected','banned')),
  plan_key text default 'free',
  title text default 'Rookie',
  badge text default 'Starter',
  xp integer default 0,
  coins integer default 0,
  is_verified boolean default false,
  is_banned boolean default false,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  plan_key text unique not null,
  name text not null,
  price_inr integer not null check (price_inr >= 0 and price_inr <= 10000),
  badge text,
  title text,
  perks jsonb default '[]'::jsonb,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into public.plans(plan_key,name,price_inr,badge,title,perks,sort_order) values
('free','Free',0,'Starter','Rookie','["Basic profile","Join squads","Post in feed"]',1),
('spark','Spark',299,'Spark Badge','Rising Duelist','["Profile flair","More squad requests","Starter title"]',2),
('silver','Silver',999,'Silver Badge','Squad Regular','["Animated badge","Priority squad discovery","Extra service slots"]',3),
('gold','Gold',2499,'Gold Elite','Elite Player','["Premium banner","Boosted profile","Gold badge"]',4),
('diamond','Diamond',5999,'Diamond Pro','Pro Grinder','["VIP support","Coach/service boost","Diamond title"]',5),
('legend','Legend',10000,'Crown Badge','StackOps Legend','["Crown badge","Top profile placement","Legend status","VIP support"]',6)
on conflict (plan_key) do update set name=excluded.name, price_inr=excluded.price_inr, badge=excluded.badge, title=excluded.title, perks=excluded.perks, sort_order=excluded.sort_order;

create table public.squads (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  game text default 'Valorant',
  region text,
  rank_required text,
  playstyle text,
  max_members integer default 5,
  description text,
  status text default 'open' check (status in ('open','closed','paused')),
  created_at timestamptz default now()
);

create table public.squad_invites (
  id uuid primary key default uuid_generate_v4(),
  squad_id uuid references public.squads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz default now(),
  unique(squad_id,user_id)
);

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  game text default 'Valorant',
  category text default 'coaching',
  price_inr integer not null default 0,
  commission_percent integer default 15 check (commission_percent >= 0 and commission_percent <= 70),
  status text default 'pending' check (status in ('pending','approved','rejected','paused')),
  cover_url text,
  created_at timestamptz default now()
);

create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  plan_key text references public.plans(plan_key) on delete set null,
  amount_inr integer not null default 0,
  platform_commission_inr integer default 0,
  purpose text default 'plan' check (purpose in ('plan','service','verification','boost','other')),
  provider text default 'manual' check (provider in ('manual','razorpay','stripe','cashfree','other')),
  provider_payment_id text,
  status text default 'pending' check (status in ('pending','verified','rejected','refunded','completed')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz default now()
);

create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  display_name text,
  content text not null,
  image_url text,
  clip_url text,
  created_at timestamptz default now()
);

create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  badge_key text unique not null,
  name text not null,
  icon text default '🏆',
  description text,
  created_at timestamptz default now()
);

insert into public.badges(badge_key,name,icon,description) values
('starter','Starter','🏆','First profile badge'),('verified','Verified Gamer','✅','Verified by admin'),('coach','Verified Coach','🎓','Approved coaching provider'),('legend','StackOps Legend','👑','Top premium status'),('admin_crown','Admin Crown','👑','Special admin identity')
on conflict (badge_key) do nothing;

create table public.user_badges (
  user_id uuid references public.profiles(id) on delete cascade,
  badge_id uuid references public.badges(id) on delete cascade,
  awarded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  primary key(user_id,badge_id)
);

create table public.chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text default 'public' check (type in ('public','squad','dm','admin')),
  squad_id uuid references public.squads(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.chat_rooms(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table public.events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  game text default 'Valorant',
  starts_at timestamptz,
  status text default 'upcoming' check (status in ('upcoming','live','ended','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.admin_audit_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  notes text,
  created_at timestamptz default now()
);

-- Functions
create or replace function public.is_admin_email(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_emails a where lower(a.email)=lower(check_email));
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.admin_emails a on lower(a.email)=lower(u.email)
    where u.id = uid
      and (a.email is not null or p.role='admin')
      and coalesce(p.is_banned,false)=false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,email,username,display_name,role,account_status,title,badge,is_verified,is_banned)
  values(
    new.id,
    lower(new.email),
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when public.is_admin_email(new.email) then 'admin' else 'user' end,
    'approved',
    case when public.is_admin_email(new.email) then 'Founder 👑' else 'Rookie' end,
    case when public.is_admin_email(new.email) then 'Admin Crown' else 'Starter' end,
    case when public.is_admin_email(new.email) then true else false end,
    false
  )
  on conflict(id) do update set
    email=excluded.email,
    role=case when public.is_admin_email(new.email) then 'admin' else public.profiles.role end,
    account_status=case when public.is_admin_email(new.email) then 'approved' else public.profiles.account_status end,
    title=case when public.is_admin_email(new.email) then 'Founder 👑' else public.profiles.title end,
    badge=case when public.is_admin_email(new.email) then 'Admin Crown' else public.profiles.badge end,
    is_verified=case when public.is_admin_email(new.email) then true else public.profiles.is_verified end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- RLS
alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.squads enable row level security;
alter table public.squad_invites enable row level security;
alter table public.services enable row level security;
alter table public.payments enable row level security;
alter table public.posts enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "admin emails admin read" on public.admin_emails for select using (public.is_admin());
create policy "admin emails admin manage" on public.admin_emails for all using (public.is_admin()) with check (public.is_admin());

create policy "profiles read visible" on public.profiles for select using (account_status='approved' or id=auth.uid() or public.is_admin());
create policy "profiles insert own" on public.profiles for insert with check (id=auth.uid() or public.is_admin());
create policy "profiles update own or admin" on public.profiles for update using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
create policy "profiles delete admin" on public.profiles for delete using (public.is_admin());

create policy "plans public read" on public.plans for select using (is_active=true or public.is_admin());
create policy "plans admin manage" on public.plans for all using (public.is_admin()) with check (public.is_admin());

create policy "squads public read" on public.squads for select using (status='open' or owner_id=auth.uid() or public.is_admin());
create policy "squads create own" on public.squads for insert with check (owner_id=auth.uid());
create policy "squads owner admin update" on public.squads for update using (owner_id=auth.uid() or public.is_admin()) with check (owner_id=auth.uid() or public.is_admin());
create policy "squads owner admin delete" on public.squads for delete using (owner_id=auth.uid() or public.is_admin());

create policy "invites related read" on public.squad_invites for select using (user_id=auth.uid() or public.is_admin() or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid()));
create policy "invites create own" on public.squad_invites for insert with check (user_id=auth.uid());
create policy "invites update owner admin" on public.squad_invites for update using (public.is_admin() or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid())) with check (public.is_admin() or exists(select 1 from public.squads s where s.id=squad_id and s.owner_id=auth.uid()));

create policy "services public approved read" on public.services for select using (status='approved' or owner_id=auth.uid() or public.is_admin());
create policy "services owner create" on public.services for insert with check (owner_id=auth.uid());
create policy "services owner admin update" on public.services for update using (owner_id=auth.uid() or public.is_admin()) with check (owner_id=auth.uid() or public.is_admin());
create policy "services admin delete" on public.services for delete using (public.is_admin());

create policy "payments owner admin read" on public.payments for select using (user_id=auth.uid() or public.is_admin());
create policy "payments owner create" on public.payments for insert with check (user_id=auth.uid());
create policy "payments admin update" on public.payments for update using (public.is_admin()) with check (public.is_admin());
create policy "payments admin delete" on public.payments for delete using (public.is_admin());

create policy "posts public read" on public.posts for select using (true);
create policy "posts user create" on public.posts for insert with check (user_id=auth.uid());
create policy "posts owner admin update" on public.posts for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy "posts owner admin delete" on public.posts for delete using (user_id=auth.uid() or public.is_admin());

create policy "badges public read" on public.badges for select using (true);
create policy "badges admin manage" on public.badges for all using (public.is_admin()) with check (public.is_admin());
create policy "user badges read" on public.user_badges for select using (true);
create policy "user badges admin manage" on public.user_badges for all using (public.is_admin()) with check (public.is_admin());

create policy "rooms public read" on public.chat_rooms for select using (type='public' or public.is_admin() or created_by=auth.uid());
create policy "rooms create auth" on public.chat_rooms for insert with check (created_by=auth.uid() or public.is_admin());
create policy "rooms admin update" on public.chat_rooms for update using (public.is_admin()) with check (public.is_admin());

create policy "messages room read" on public.messages for select using (true);
create policy "messages create own" on public.messages for insert with check (sender_id=auth.uid());
create policy "messages owner admin delete" on public.messages for delete using (sender_id=auth.uid() or public.is_admin());

create policy "events public read" on public.events for select using (true);
create policy "events admin manage" on public.events for all using (public.is_admin()) with check (public.is_admin());
create policy "audit admin read" on public.admin_audit_log for select using (public.is_admin());
create policy "audit admin insert" on public.admin_audit_log for insert with check (public.is_admin());

-- Storage buckets
insert into storage.buckets(id,name,public) values
('avatars','avatars',true),('banners','banners',true),('posts','posts',true),('service-files','service-files',true),('clips','clips',true)
on conflict (id) do nothing;

drop policy if exists "stackops public storage read" on storage.objects;
create policy "stackops public storage read" on storage.objects for select using (bucket_id in ('avatars','banners','posts','service-files','clips'));

drop policy if exists "stackops upload own folder" on storage.objects;
create policy "stackops upload own folder" on storage.objects for insert with check (
  bucket_id in ('avatars','banners','posts','service-files','clips') and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

drop policy if exists "stackops update own folder" on storage.objects;
create policy "stackops update own folder" on storage.objects for update using (
  bucket_id in ('avatars','banners','posts','service-files','clips') and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

drop policy if exists "stackops delete own folder" on storage.objects;
create policy "stackops delete own folder" on storage.objects for delete using (
  bucket_id in ('avatars','banners','posts','service-files','clips') and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

commit;

-- AFTER RUNNING:
-- 1) Replace YOUR_ADMIN_EMAIL@example.com in this file before run, OR run:
-- insert into public.admin_emails(email,label) values ('yourrealemail@gmail.com','Founder Admin') on conflict(email) do nothing;
-- 2) Edit config.js ADMIN_EMAILS with the same email.
-- 3) Sign out and sign in again.
