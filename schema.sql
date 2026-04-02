create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid,
  target_type text,
  target_id text,
  reason text,
  details text,
  created_at timestamptz default now()
);

alter table public.reports enable row level security;

drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports
for insert
with check (true);
