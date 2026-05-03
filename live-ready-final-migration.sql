-- StackOps Live Ready Final Migration
-- Run once in Supabase SQL editor after uploading this version.
-- Safe to run multiple times. It does NOT delete your data.

-- Extensions
create extension if not exists pgcrypto;

-- Admin email source used by the frontend and backend helpers
create or replace function public.admin_emails()
returns text[]
language sql
stable
as $$
  select array[
    'kiratveersinghralhan@gmail.com',
    'qq299629@gmail.com'
  ];
$$;

-- Clean email-based admin helper. No UUID needed.
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
      and lower(u.email) = any(public.admin_emails())
      and coalesce(p.is_banned, false) = false
  );
$$;

-- Make sure profiles has live-ready identity columns.
alter table if exists public.profiles
  add column if not exists xp integer default 0,
  add column if not exists title text default 'Rookie',
  add column if not exists badge text default 'Starter Spark',
  add column if not exists selected_banner_key text default 'default',
  add column if not exists custom_banner_url text,
  add column if not exists avatar_url text,
  add column if not exists gender text,
  add column if not exists riot_id text,
  add column if not exists main_game text default 'Valorant',
  add column if not exists account_status text default 'approved',
  add column if not exists role text default 'user',
  add column if not exists is_verified boolean default false,
  add column if not exists is_banned boolean default false,
  add column if not exists updated_at timestamptz default now();

-- Default identity for regular users.
update public.profiles
set title = coalesce(nullif(title,''), 'Rookie'),
    badge = coalesce(nullif(badge,''), 'Starter Spark'),
    selected_banner_key = coalesce(nullif(selected_banner_key,''), 'default'),
    xp = coalesce(xp, 0),
    account_status = coalesce(nullif(account_status,''), 'approved'),
    role = coalesce(nullif(role,''), 'user')
where lower(coalesce((select email from auth.users where auth.users.id = profiles.id), '')) <> all(public.admin_emails());

-- Founder/admin identity: only these emails get crown/founder assets.
update public.profiles p
set role = 'admin',
    account_status = 'approved',
    is_verified = true,
    is_banned = false,
    title = 'Founder',
    badge = 'Origin Crown',
    selected_banner_key = 'gold',
    xp = greatest(coalesce(p.xp,0), 999999)
from auth.users u
where p.id = u.id
  and lower(u.email) = any(public.admin_emails());

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('avatars','avatars',true), ('banners','banners',true), ('posts','posts',true)
on conflict (id) do update set public = excluded.public;

-- Storage policies. Drop first so duplicate policy errors never happen.
drop policy if exists "storage public read" on storage.objects;
create policy "storage public read"
on storage.objects for select
using (bucket_id in ('avatars','banners','posts'));

drop policy if exists "users upload own storage" on storage.objects;
create policy "users upload own storage"
on storage.objects for insert
with check (
  bucket_id in ('avatars','banners','posts')
  and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

drop policy if exists "users update own storage" on storage.objects;
create policy "users update own storage"
on storage.objects for update
using (
  bucket_id in ('avatars','banners','posts')
  and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

drop policy if exists "users delete own storage" on storage.objects;
create policy "users delete own storage"
on storage.objects for delete
using (
  bucket_id in ('avatars','banners','posts')
  and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

-- Optional supporting tables if missing.
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

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  channel text default 'global',
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  amount_inr integer not null,
  commission_inr integer default 0,
  provider text default 'razorpay',
  provider_payment_id text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Enable RLS on new tables
alter table public.teams enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.seller_applications enable row level security;
alter table public.payments enable row level security;

-- Simple safe policies
drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams for select using (true);
drop policy if exists "teams owner insert" on public.teams;
create policy "teams owner insert" on public.teams for insert with check (owner_id = auth.uid());
drop policy if exists "teams owner admin delete" on public.teams;
create policy "teams owner admin delete" on public.teams for delete using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);
drop policy if exists "posts owner insert" on public.posts;
create policy "posts owner insert" on public.posts for insert with check (user_id = auth.uid());
drop policy if exists "posts owner admin delete" on public.posts;
create policy "posts owner admin delete" on public.posts for delete using (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages authenticated read" on public.messages;
create policy "messages authenticated read" on public.messages for select using (auth.uid() is not null);
drop policy if exists "messages authenticated insert" on public.messages;
create policy "messages authenticated insert" on public.messages for insert with check (sender_id = auth.uid());

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "seller own insert" on public.seller_applications;
create policy "seller own insert" on public.seller_applications for insert with check (user_id = auth.uid());
drop policy if exists "seller admin read" on public.seller_applications;
create policy "seller admin read" on public.seller_applications for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "seller admin update" on public.seller_applications;
create policy "seller admin update" on public.seller_applications for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments owner admin read" on public.payments;
create policy "payments owner admin read" on public.payments for select using (buyer_id = auth.uid() or public.is_admin());
drop policy if exists "payments owner insert" on public.payments;
create policy "payments owner insert" on public.payments for insert with check (buyer_id = auth.uid());

-- Realtime publication: add only if not already added.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='messages')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
