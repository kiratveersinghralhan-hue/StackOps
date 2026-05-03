
-- StackOps Retention Final Safe SQL
-- Safe to run multiple times. Does NOT delete existing data.
-- Run this after your existing StackOps SQL. It adds retention/viral features.

create extension if not exists pgcrypto;

-- Admin email helpers
create or replace function public.admin_emails()
returns text[] language sql stable as $$
  select array['kiratveersinghralhan@gmail.com','qq299629@gmail.com'];
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and lower(u.email) = any(public.admin_emails())
      and coalesce(p.is_banned,false) = false
  );
$$;

-- Profiles retention columns
alter table if exists public.profiles
  add column if not exists xp integer default 0,
  add column if not exists daily_streak integer default 0,
  add column if not exists last_daily_claim date,
  add column if not exists invite_count integer default 0,
  add column if not exists referral_code text,
  add column if not exists title text default 'Rookie',
  add column if not exists badge text default 'Starter Spark',
  add column if not exists selected_banner_key text default 'default',
  add column if not exists custom_banner_url text,
  add column if not exists account_status text default 'approved',
  add column if not exists role text default 'user',
  add column if not exists is_verified boolean default false,
  add column if not exists is_banned boolean default false;

-- Make referral codes for existing users
update public.profiles
set referral_code = lower(substr(id::text,1,8))
where referral_code is null or referral_code = '';

create unique index if not exists profiles_referral_code_unique on public.profiles(referral_code);

-- Default public identity
update public.profiles p
set title = coalesce(nullif(title,''),'Rookie'),
    badge = coalesce(nullif(badge,''),'Starter Spark'),
    selected_banner_key = case when selected_banner_key in ('gold','founder','crown') then 'default' else coalesce(nullif(selected_banner_key,''),'default') end,
    xp = coalesce(xp,0),
    account_status = coalesce(nullif(account_status,''),'approved')
where not exists (
  select 1 from auth.users u where u.id = p.id and lower(u.email)=any(public.admin_emails())
);

-- Founder identity only for your admin emails
update public.profiles p
set role='admin', account_status='approved', is_verified=true, is_banned=false,
    title='Founder', badge='Origin Crown', selected_banner_key='gold', xp=greatest(coalesce(xp,0),999999)
from auth.users u
where u.id=p.id and lower(u.email)=any(public.admin_emails());

-- Retention tables
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  xp_awarded integer default 0,
  created_at timestamptz default now(),
  unique(user_id, checkin_date)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  inviter_id uuid references auth.users(id) on delete set null,
  invited_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(invited_user_id)
);

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  xp_awarded integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.reward_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  reward_type text not null,
  reward_key text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, reward_type, reward_key)
);

alter table public.daily_checkins enable row level security;
alter table public.referrals enable row level security;
alter table public.user_activity enable row level security;
alter table public.reward_unlocks enable row level security;

-- RLS policies with drop first to avoid duplicate errors
drop policy if exists "daily own read" on public.daily_checkins;
create policy "daily own read" on public.daily_checkins for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "daily own insert" on public.daily_checkins;
create policy "daily own insert" on public.daily_checkins for insert with check (user_id = auth.uid());

drop policy if exists "referrals own read" on public.referrals;
create policy "referrals own read" on public.referrals for select using (invited_user_id = auth.uid() or inviter_id = auth.uid() or public.is_admin());
drop policy if exists "referrals insert invited" on public.referrals;
create policy "referrals insert invited" on public.referrals for insert with check (invited_user_id = auth.uid());

drop policy if exists "activity own read" on public.user_activity;
create policy "activity own read" on public.user_activity for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "activity own insert" on public.user_activity;
create policy "activity own insert" on public.user_activity for insert with check (user_id = auth.uid());

drop policy if exists "rewards own read" on public.reward_unlocks;
create policy "rewards own read" on public.reward_unlocks for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "rewards own insert" on public.reward_unlocks;
create policy "rewards own insert" on public.reward_unlocks for insert with check (user_id = auth.uid());

-- Function to count referrals and update inviter counts
create or replace function public.handle_referral_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_inviter uuid;
begin
  select id into v_inviter from public.profiles where referral_code = lower(new.referral_code) limit 1;
  if v_inviter is not null and v_inviter <> new.invited_user_id then
    new.inviter_id := v_inviter;
    update public.profiles set invite_count = coalesce(invite_count,0) + 1, xp = coalesce(xp,0) + 120 where id = v_inviter;
  end if;
  return new;
end $$;

drop trigger if exists on_referral_insert on public.referrals;
create trigger on_referral_insert before insert on public.referrals
for each row execute function public.handle_referral_insert();

-- Realtime safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
