-- StackOps Seller Desk final status SQL
-- Keeps only one seller application per user and supports approve, reject, unapprove/reopen.

alter table public.profiles
  add column if not exists is_seller boolean default false,
  add column if not exists seller_status text default 'none',
  add column if not exists is_verified boolean default false,
  add column if not exists is_banned boolean default false,
  add column if not exists account_status text default 'approved';

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  note text,
  status text default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.seller_applications
  add column if not exists applicant_email text,
  add column if not exists applicant_name text,
  add column if not exists note text,
  add column if not exists status text default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now();

-- Deduplicate: keep latest row per user.
delete from public.seller_applications a
using public.seller_applications b
where a.user_id = b.user_id
  and a.created_at < b.created_at;

create unique index if not exists seller_applications_one_per_user
on public.seller_applications(user_id);

alter table public.seller_applications enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "seller apply insert own" on public.seller_applications;
create policy "seller apply insert own"
on public.seller_applications for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "seller apply read own or admin" on public.seller_applications;
create policy "seller apply read own or admin"
on public.seller_applications for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "seller apply admin update" on public.seller_applications;
create policy "seller apply admin update"
on public.seller_applications for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles readable final" on public.profiles;
create policy "profiles readable final"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles update own or admin final" on public.profiles;
create policy "profiles update own or admin final"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Realtime membership: ignore duplicate-member errors if Supabase shows them.
do $$ begin
  begin alter publication supabase_realtime add table public.seller_applications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
