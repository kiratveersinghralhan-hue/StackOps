-- StackOps Trust Verification + Seller Proof System
-- SQL REQUIRED: YES
-- Safe migration: keeps your users/profiles/posts; cleans duplicate seller applications only.

-- Required extension
create extension if not exists pgcrypto;

-- Admin helper, email based + profile role based
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
        lower(u.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
        or coalesce(p.role,'user') = 'admin'
      )
  );
$$;

-- Profiles fields used by UI
alter table public.profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists profile_pic_url text,
  add column if not exists bio text,
  add column if not exists main_game text default 'Valorant',
  add column if not exists riot_id text,
  add column if not exists role text default 'user',
  add column if not exists account_status text default 'approved',
  add column if not exists is_banned boolean default false,
  add column if not exists is_verified boolean default false,
  add column if not exists is_seller boolean default false,
  add column if not exists seller_status text default 'none',
  add column if not exists xp integer default 0,
  add column if not exists created_at timestamptz default now();

-- Seller applications final schema
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  service_category text,
  note text,
  proof_url text,
  proof_file_name text,
  proof_note text,
  proof_uploaded boolean default false,
  status text default 'pending',
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.seller_applications
  add column if not exists applicant_email text,
  add column if not exists applicant_name text,
  add column if not exists service_category text,
  add column if not exists note text,
  add column if not exists proof_url text,
  add column if not exists proof_file_name text,
  add column if not exists proof_note text,
  add column if not exists proof_uploaded boolean default false,
  add column if not exists status text default 'pending',
  add column if not exists admin_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now();

-- Keep only latest seller application per user, then enforce one active record per user
with ranked as (
  select id, user_id, row_number() over(partition by user_id order by created_at desc nulls last, id desc) rn
  from public.seller_applications
  where user_id is not null
)
delete from public.seller_applications s
using ranked r
where s.id = r.id and r.rn > 1;

drop index if exists seller_applications_user_unique;
create unique index seller_applications_user_unique on public.seller_applications(user_id) where user_id is not null;

-- Verification requests table
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  status text default 'pending',
  posts_count integer default 0,
  messages_count integer default 0,
  teams_count integer default 0,
  account_age_hours integer default 0,
  requirements_snapshot jsonb default '{}'::jsonb,
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Tables used for counts if missing
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  username text,
  content text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade,
  sender_name text,
  channel text default 'global',
  content text,
  created_at timestamptz default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text,
  game text,
  region text,
  rank_required text,
  description text,
  created_at timestamptz default now()
);

-- Storage bucket for seller proof uploads
insert into storage.buckets (id, name, public)
values ('seller-proofs','seller-proofs', true)
on conflict (id) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.seller_applications enable row level security;
alter table public.verification_requests enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;
alter table public.teams enable row level security;

-- Drop old conflicting policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('profiles','seller_applications','verification_requests','posts','messages','teams') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Profiles
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update own or admin" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Seller applications
create policy "seller apply own" on public.seller_applications for insert to authenticated with check (user_id = auth.uid());
create policy "seller read own or admin" on public.seller_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "seller update own rejected or admin" on public.seller_applications for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- Verification requests
create policy "verification insert own" on public.verification_requests for insert to authenticated with check (user_id = auth.uid());
create policy "verification read own or admin" on public.verification_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "verification update own or admin" on public.verification_requests for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- Activity tables
create policy "posts read" on public.posts for select using (true);
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts delete own or admin" on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "messages read" on public.messages for select using (true);
create policy "messages insert own" on public.messages for insert to authenticated with check (sender_id = auth.uid());

create policy "teams read" on public.teams for select using (true);
create policy "teams insert own" on public.teams for insert to authenticated with check (owner_id = auth.uid());
create policy "teams delete own or admin" on public.teams for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- Storage policies for seller proof files
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'seller proofs%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

create policy "seller proofs public read" on storage.objects for select using (bucket_id = 'seller-proofs');
create policy "seller proofs upload own" on storage.objects for insert to authenticated with check (bucket_id = 'seller-proofs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "seller proofs update own or admin" on storage.objects for update to authenticated using (bucket_id = 'seller-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())) with check (bucket_id = 'seller-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));
create policy "seller proofs delete own or admin" on storage.objects for delete to authenticated using (bucket_id = 'seller-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

-- Auto profile for future users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role, account_status, seller_status, plan_key, xp)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    'approved',
    'none',
    'free',
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Ensure existing auth users have profiles
insert into public.profiles (id, username, display_name, role, account_status, seller_status, plan_key, xp)
select id, split_part(email,'@',1), split_part(email,'@',1),
       case when lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
       'approved','none','free',0
from auth.users
on conflict (id) do nothing;

-- Realtime safe add
DO $$
BEGIN
  BEGIN alter publication supabase_realtime add table public.seller_applications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.verification_requests; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.messages; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN alter publication supabase_realtime add table public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
