
-- ============================================================
-- STACKOPS CLEAN LIVE SYSTEM SQL
-- Purpose: reset broken seller approval table/policies and create
-- a clean, live/dynamic seller approval + admin counter backend.
-- Safe for existing users/profiles. It only resets seller applications.
-- ============================================================

-- 1) Admin email table/function
create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);

insert into public.admin_emails(email) values
('kiratveersinghralhan@gmail.com'),
('qq299629@gmail.com')
on conflict (email) do nothing;

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
    left join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and (
        lower(u.email) in (select lower(email) from public.admin_emails)
        or p.role = 'admin'
      )
      and coalesce(p.is_banned,false) = false
  );
$$;

-- 2) Profile columns required by StackOps
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
alter table public.profiles add column if not exists riot_id text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists main_game text default 'Valorant';
alter table public.profiles add column if not exists title text default 'Rookie';
alter table public.profiles add column if not exists badge text default 'Starter Spark';
alter table public.profiles add column if not exists selected_banner_key text default 'default';
alter table public.profiles add column if not exists created_at timestamptz default now();

-- 3) Ensure profile rows exist for every auth user
insert into public.profiles (id, username, display_name, role, account_status, is_verified, title, badge, selected_banner_key, xp)
select u.id,
       split_part(u.email,'@',1),
       split_part(u.email,'@',1),
       case when lower(u.email) in (select lower(email) from public.admin_emails) then 'admin' else 'user' end,
       'approved',
       lower(u.email) in (select lower(email) from public.admin_emails),
       case when lower(u.email) in (select lower(email) from public.admin_emails) then 'Founder' else 'Rookie' end,
       case when lower(u.email) in (select lower(email) from public.admin_emails) then 'Origin Crown' else 'Starter Spark' end,
       case when lower(u.email) in (select lower(email) from public.admin_emails) then 'gold' else 'default' end,
       case when lower(u.email) in (select lower(email) from public.admin_emails) then 9999999 else 0 end
from auth.users u
on conflict (id) do update set
  role = case when lower((select email from auth.users where id=excluded.id)) in (select lower(email) from public.admin_emails) then 'admin' else public.profiles.role end,
  is_verified = public.profiles.is_verified or excluded.is_verified;

-- 4) Auto-create profiles for future users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role, account_status, is_verified, title, badge, selected_banner_key, xp)
  values (
    new.id,
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'admin' else 'user' end,
    'approved',
    lower(new.email) in (select lower(email) from public.admin_emails),
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'Founder' else 'Rookie' end,
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'Origin Crown' else 'Starter Spark' end,
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'gold' else 'default' end,
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 9999999 else 0 end
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5) Reset seller applications cleanly
-- This intentionally deletes old broken seller applications so new Apply flow is clean.
drop table if exists public.seller_applications cascade;
create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id)
);

-- 6) Activity events for live counters/arena feed
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  username text,
  event_type text,
  body text,
  created_at timestamptz default now()
);

-- 7) Make sure basic posts/payments/orders tables exist for counters
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  username text,
  content text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  amount_inr integer default 0,
  status text default 'pending',
  razorpay_payment_id text,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  item_type text,
  item_name text,
  amount_inr integer default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

-- 8) Rebuild policies cleanly for relevant tables
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.activity_events enable row level security;
alter table public.posts enable row level security;
alter table public.payments enable row level security;
alter table public.orders enable row level security;

-- Drop all old policies on these tables to avoid conflicts
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','seller_applications','activity_events','posts','payments','orders') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Profiles: public read for social cards; users update own; admin updates all
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update own or admin" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "profiles delete admin" on public.profiles for delete using (public.is_admin());

-- Seller apps: users create/read own; admin full read/update
create policy "seller apps insert own" on public.seller_applications for insert with check (user_id = auth.uid());
create policy "seller apps read own or admin" on public.seller_applications for select using (user_id = auth.uid() or public.is_admin());
create policy "seller apps update admin" on public.seller_applications for update using (public.is_admin()) with check (public.is_admin());
create policy "seller apps delete admin" on public.seller_applications for delete using (public.is_admin());

-- Activity events: everyone can read; logged users insert own/admin
create policy "activity read" on public.activity_events for select using (true);
create policy "activity insert" on public.activity_events for insert with check (actor_id = auth.uid() or public.is_admin());

-- Posts: everyone reads; users create own; owners/admin delete
create policy "posts read" on public.posts for select using (true);
create policy "posts insert own" on public.posts for insert with check (user_id = auth.uid());
create policy "posts update own or admin" on public.posts for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "posts delete own or admin" on public.posts for delete using (user_id = auth.uid() or public.is_admin());

-- Payments/orders: admin reads all; users read own
create policy "payments read own or admin" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "payments insert own" on public.payments for insert with check (user_id = auth.uid() or public.is_admin());
create policy "payments update admin" on public.payments for update using (public.is_admin()) with check (public.is_admin());

create policy "orders read own or admin" on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "orders insert own" on public.orders for insert with check (buyer_id = auth.uid() or public.is_admin());
create policy "orders update admin" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- 9) Mark your admin emails as Founder/Admin if already registered
update public.profiles p
set role='admin', account_status='approved', is_verified=true, title='Founder', badge='Origin Crown', selected_banner_key='gold', xp=9999999
from auth.users u
where p.id = u.id and lower(u.email) in (select lower(email) from public.admin_emails);

-- 10) Realtime publication, safe-ish: ignore duplicate errors if Supabase says already member.
DO $$
BEGIN
  BEGIN alter publication supabase_realtime add table public.seller_applications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.activity_events; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.posts; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
