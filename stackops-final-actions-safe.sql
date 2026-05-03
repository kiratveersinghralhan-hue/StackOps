-- StackOps Final Actions Fix Safe SQL
-- Run this once if Apply to Sell, Create Team, Posts, Chat, or Payments do not work.
-- Safe: does NOT delete data.

create extension if not exists pgcrypto;

-- Admin helper by email. Edit emails here if needed.
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
    where u.id = auth.uid()
      and lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
  );
$$;

-- Profiles safety fields
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists account_status text default 'approved';
alter table public.profiles add column if not exists is_banned boolean default false;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists is_seller boolean default false;
alter table public.profiles add column if not exists seller_status text default 'none';
alter table public.profiles add column if not exists plan_key text default 'free';
alter table public.profiles add column if not exists xp integer default 0;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists invite_count integer default 0;
alter table public.profiles add column if not exists daily_streak integer default 0;
alter table public.profiles add column if not exists last_daily_claim date;
alter table public.profiles add column if not exists title text default 'Rookie';
alter table public.profiles add column if not exists badge text default 'Starter Spark';
alter table public.profiles add column if not exists selected_banner_key text default 'default';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists custom_banner_url text;
alter table public.profiles add column if not exists riot_id text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists main_game text default 'Valorant';
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.profiles enable row level security;
drop policy if exists "profiles visible" on public.profiles;
create policy "profiles visible" on public.profiles for select using (true);
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert with check (id = auth.uid() or public.is_admin());
drop policy if exists "profiles own or admin update" on public.profiles;
create policy "profiles own or admin update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Auto-create profile for future signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role, account_status, title, badge, selected_banner_key, xp)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    'approved',
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder' else 'Rookie' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Origin Crown' else 'Starter Spark' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'gold' else 'default' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 999999 else 0 end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profile rows for existing auth users
insert into public.profiles (id, username, display_name, role, account_status, title, badge, selected_banner_key, xp)
select id,
       split_part(email, '@', 1),
       split_part(email, '@', 1),
       case when lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
       'approved',
       case when lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder' else 'Rookie' end,
       case when lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Origin Crown' else 'Starter Spark' end,
       case when lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'gold' else 'default' end,
       case when lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 999999 else 0 end
from auth.users
on conflict (id) do nothing;

-- Teams
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
alter table public.teams enable row level security;
drop policy if exists "teams public read" on public.teams;
create policy "teams public read" on public.teams for select using (true);
drop policy if exists "teams owner insert" on public.teams;
create policy "teams owner insert" on public.teams for insert with check (owner_id = auth.uid());
drop policy if exists "teams owner admin delete" on public.teams;
create policy "teams owner admin delete" on public.teams for delete using (owner_id = auth.uid() or public.is_admin());

-- Posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now()
);
alter table public.posts enable row level security;
drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts for select using (true);
drop policy if exists "posts owner insert" on public.posts;
create policy "posts owner insert" on public.posts for insert with check (user_id = auth.uid());
drop policy if exists "posts owner admin delete" on public.posts;
create policy "posts owner admin delete" on public.posts for delete using (user_id = auth.uid() or public.is_admin());

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  channel text default 'global',
  content text not null,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
drop policy if exists "messages read public" on public.messages;
create policy "messages read public" on public.messages for select using (true);
drop policy if exists "messages insert logged" on public.messages;
create policy "messages insert logged" on public.messages for insert with check (sender_id = auth.uid());

-- Seller applications
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  note text,
  created_at timestamptz default now()
);
alter table public.seller_applications enable row level security;
drop policy if exists "seller read own admin" on public.seller_applications;
create policy "seller read own admin" on public.seller_applications for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "seller insert own" on public.seller_applications;
create policy "seller insert own" on public.seller_applications for insert with check (user_id = auth.uid());
drop policy if exists "seller admin update" on public.seller_applications;
create policy "seller admin update" on public.seller_applications for update using (public.is_admin()) with check (public.is_admin());

-- Payments table for Razorpay client records
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  amount_inr integer not null default 0,
  commission_inr integer default 0,
  provider text default 'razorpay',
  provider_payment_id text,
  provider_order_id text,
  provider_signature text,
  status text default 'created',
  item_name text,
  item_type text,
  plan_key text,
  raw_response jsonb,
  verified_at timestamptz,
  created_at timestamptz default now()
);
alter table public.payments enable row level security;
drop policy if exists "payments own or admin read" on public.payments;
create policy "payments own or admin read" on public.payments for select using (buyer_id = auth.uid() or public.is_admin());
drop policy if exists "payments own insert" on public.payments;
create policy "payments own insert" on public.payments for insert with check (buyer_id = auth.uid());
drop policy if exists "payments own update" on public.payments;
create policy "payments own update" on public.payments for update using (buyer_id = auth.uid() or public.is_admin()) with check (buyer_id = auth.uid() or public.is_admin());

-- Daily / referral support
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  checkin_date date not null,
  xp_awarded integer default 0,
  created_at timestamptz default now(),
  unique(user_id, checkin_date)
);
alter table public.daily_checkins enable row level security;
drop policy if exists "daily own read" on public.daily_checkins;
create policy "daily own read" on public.daily_checkins for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "daily own insert" on public.daily_checkins;
create policy "daily own insert" on public.daily_checkins for insert with check (user_id = auth.uid());

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text,
  invited_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(referral_code, invited_user_id)
);
alter table public.referrals enable row level security;
drop policy if exists "referrals own admin" on public.referrals;
create policy "referrals own admin" on public.referrals for select using (invited_user_id = auth.uid() or public.is_admin());
drop policy if exists "referrals insert logged" on public.referrals;
create policy "referrals insert logged" on public.referrals for insert with check (invited_user_id = auth.uid());

-- Live activity
create table if not exists public.live_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  type text default 'activity',
  content text not null,
  created_at timestamptz default now()
);
alter table public.live_activity enable row level security;
drop policy if exists "live public read" on public.live_activity;
create policy "live public read" on public.live_activity for select using (true);
drop policy if exists "live logged insert" on public.live_activity;
create policy "live logged insert" on public.live_activity for insert with check (user_id = auth.uid() or user_id is null);

-- Make your current account premium/seller/admin-ready
update public.profiles
set is_seller = true,
    seller_status = 'approved',
    plan_key = 'premium',
    is_verified = true,
    account_status = 'approved',
    xp = greatest(coalesce(xp,0), 1500)
where id = 'e0437372-5544-4411-82c5-1f3337e28bcd';

-- Safe realtime add
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='posts')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='seller_applications')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='seller_applications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_applications;
  END IF;
END $$;
