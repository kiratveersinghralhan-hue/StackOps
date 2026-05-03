-- StackOps Seller Approval Desk Safe Migration
-- Run once in Supabase SQL Editor. No data delete.

-- Required profile fields
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists account_status text default 'approved';
alter table public.profiles add column if not exists is_banned boolean default false;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists is_seller boolean default false;
alter table public.profiles add column if not exists seller_status text default 'none';
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists xp integer default 0;

-- Admin emails and admin helper
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
        lower(u.email) = any(public.admin_emails())
        or p.role = 'admin'
      )
      and coalesce(p.is_banned, false) = false
  );
$$;

-- Make your admin emails admin/founder if the auth user exists
insert into public.profiles (id, username, display_name, role, account_status, is_verified, is_seller, seller_status, xp)
select id, split_part(email,'@',1), split_part(email,'@',1), 'admin', 'approved', true, true, 'approved', 999999
from auth.users
where lower(email) = any(public.admin_emails())
on conflict (id) do update
set role='admin', account_status='approved', is_verified=true, is_seller=true, seller_status='approved', xp=greatest(coalesce(public.profiles.xp,0),999999);

-- Seller applications table
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  note text,
  applicant_email text,
  applicant_name text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.seller_applications add column if not exists applicant_email text;
alter table public.seller_applications add column if not exists applicant_name text;
alter table public.seller_applications add column if not exists reviewed_at timestamptz;
alter table public.seller_applications enable row level security;

-- Seller application RLS policies
drop policy if exists "seller apps insert own" on public.seller_applications;
create policy "seller apps insert own"
on public.seller_applications for insert
with check (user_id = auth.uid());

drop policy if exists "seller apps read own or admin" on public.seller_applications;
create policy "seller apps read own or admin"
on public.seller_applications for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "seller apps update admin" on public.seller_applications;
create policy "seller apps update admin"
on public.seller_applications for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "seller apps delete admin" on public.seller_applications;
create policy "seller apps delete admin"
on public.seller_applications for delete
using (public.is_admin());

-- Profiles RLS basics
alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
on public.profiles for select
using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles for insert
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Notifications table for approval messages
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own"
on public.notifications for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications insert admin" on public.notifications;
create policy "notifications insert admin"
on public.notifications for insert
with check (public.is_admin() or user_id = auth.uid());

-- Auto-create profiles for future signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role, account_status, is_verified, is_seller, seller_status, xp)
  values (
    new.id,
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when lower(new.email) = any(public.admin_emails()) then 'admin' else 'user' end,
    'approved',
    case when lower(new.email) = any(public.admin_emails()) then true else false end,
    case when lower(new.email) = any(public.admin_emails()) then true else false end,
    case when lower(new.email) = any(public.admin_emails()) then 'approved' else 'none' end,
    case when lower(new.email) = any(public.admin_emails()) then 999999 else 0 end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Useful check after running:
-- select * from public.seller_applications order by created_at desc;
