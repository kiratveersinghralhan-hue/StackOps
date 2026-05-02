-- StackOps GameLobby WOW clean backend reset
-- SQL REQUIRED: YES for full backend. This deletes old public schema objects.

drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

create extension if not exists pgcrypto;

create table public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);
insert into public.admin_emails(email) values
('kiratveersinghralhan@gmail.com'),
('qq299629@gmail.com')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    join public.admin_emails a on lower(a.email)=lower(u.email)
    where u.id = auth.uid()
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  gender text,
  bio text,
  riot_id text,
  region text,
  main_game text default 'Valorant',
  avatar_url text,
  selected_banner_url text default 'default-arena-banner',
  role text default 'user' check (role in ('user','seller','moderator','admin')),
  account_status text default 'approved' check (account_status in ('approved','pending','rejected','banned')),
  seller_status text default 'none' check (seller_status in ('none','pending','approved','rejected')),
  plan_key text default 'free',
  title text default 'Rookie',
  badge text default 'Starter',
  xp int default 0,
  coins int default 0,
  is_verified boolean default false,
  is_banned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.user_banners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  image_url text,
  rarity text default 'common',
  unlocked_at timestamptz default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text unique not null,
  name text not null,
  price_inr int not null,
  badge text,
  title text,
  features jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
insert into public.plans(plan_key,name,price_inr,badge,title,features) values
('free','Free',0,'Starter','Rookie','["Guest view","Basic profile","Public squads"]'),
('recruit','Recruit',199,'Recruit Badge','Recruit','["Custom username","Basic banner","Chat access"]'),
('silver','Silver',499,'Silver Ops','Operator','["Profile glow","Squad boosts","3 banner cards"]'),
('gold','Gold',999,'Gold Elite','Elite','["Priority matchmaking","Premium badges","Service discount"]'),
('radiant','Radiant',2499,'Radiant Pro','Radiant','["Creator tools","Featured posts","Premium cards"]'),
('legend','Legend',5999,'Legend Crown','Legend','["Max boost","VIP support","Elite identity"]');

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  game text default 'Valorant',
  region text,
  rank_required text,
  description text,
  status text default 'open' check (status in ('open','closed','archived')),
  created_at timestamptz default now()
);

create table public.squad_invites (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.squads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  content text,
  image_url text,
  game text default 'Valorant',
  created_at timestamptz default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  game text default 'Valorant',
  category text default 'coaching',
  price_inr int not null,
  status text default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_at timestamptz default now()
);

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  pitch text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  plan_key text,
  amount_inr int not null,
  commission_inr int default 0,
  provider text default 'razorpay',
  provider_payment_id text,
  status text default 'pending' check (status in ('pending','paid','failed','refunded','completed')),
  created_at timestamptz default now()
);

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
insert into public.chat_channels(slug,name) values
('global','Global'),('valorant','Valorant'),('lol','League'),('market','Marketplace') on conflict do nothing;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  channel text default 'global',
  content text not null,
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text,
  content text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function public.commission_for(amount int)
returns int language sql immutable as $$
  select round(amount * case
    when amount < 500 then 0.07
    when amount < 1000 then 0.10
    when amount < 2000 then 0.15
    when amount < 3000 then 0.20
    when amount < 5000 then 0.25
    else 0.30 end)::int;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username,display_name,role,account_status,title,badge,is_verified,selected_banner_url)
  values(
    new.id,
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when exists(select 1 from public.admin_emails where lower(email)=lower(new.email)) then 'admin' else 'user' end,
    'approved',
    case when exists(select 1 from public.admin_emails where lower(email)=lower(new.email)) then 'Founder 👑' else 'Rookie' end,
    case when exists(select 1 from public.admin_emails where lower(email)=lower(new.email)) then '1 of 1 Admin Crown' else 'Starter' end,
    exists(select 1 from public.admin_emails where lower(email)=lower(new.email)),
    case when exists(select 1 from public.admin_emails where lower(email)=lower(new.email)) then 'founder-king-banner' else 'default-arena-banner' end
  ) on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- make already signed-up admin emails admin
update public.profiles p set role='admin',account_status='approved',is_verified=true,is_banned=false,title='Founder 👑',badge='Admin Crown',selected_banner_url='founder-king-banner'
from auth.users u where p.id=u.id and lower(u.email) in (select lower(email) from public.admin_emails);

alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.user_banners enable row level security;
alter table public.plans enable row level security;
alter table public.squads enable row level security;
alter table public.squad_invites enable row level security;
alter table public.posts enable row level security;
alter table public.services enable row level security;
alter table public.seller_applications enable row level security;
alter table public.payments enable row level security;
alter table public.chat_channels enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "admin emails read" on public.admin_emails for select using (public.is_admin());
create policy "admin emails manage" on public.admin_emails for all using (public.is_admin()) with check (public.is_admin());

create policy "profiles read visible" on public.profiles for select using (account_status='approved' or id=auth.uid() or public.is_admin());
create policy "profiles insert own" on public.profiles for insert with check (id=auth.uid());
create policy "profiles update own or admin" on public.profiles for update using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
create policy "profiles delete admin" on public.profiles for delete using (public.is_admin());

create policy "banners own or admin" on public.user_banners for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy "plans public read" on public.plans for select using (true);
create policy "plans admin manage" on public.plans for all using (public.is_admin()) with check (public.is_admin());

create policy "squads public read" on public.squads for select using (true);
create policy "squads owner create" on public.squads for insert with check (owner_id=auth.uid());
create policy "squads owner admin update" on public.squads for update using (owner_id=auth.uid() or public.is_admin()) with check (owner_id=auth.uid() or public.is_admin());
create policy "squads owner admin delete" on public.squads for delete using (owner_id=auth.uid() or public.is_admin());

create policy "invites related read" on public.squad_invites for select using (sender_id=auth.uid() or receiver_id=auth.uid() or public.is_admin());
create policy "invites create own" on public.squad_invites for insert with check (sender_id=auth.uid());
create policy "invites update owner admin" on public.squad_invites for update using (receiver_id=auth.uid() or public.is_admin()) with check (receiver_id=auth.uid() or public.is_admin());

create policy "posts public read" on public.posts for select using (true);
create policy "posts create own" on public.posts for insert with check (user_id=auth.uid());
create policy "posts owner admin update" on public.posts for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy "posts owner admin delete" on public.posts for delete using (user_id=auth.uid() or public.is_admin());

create policy "services approved read" on public.services for select using (status='approved' or seller_id=auth.uid() or public.is_admin());
create policy "services approved seller create" on public.services for insert with check (seller_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and seller_status='approved'));
create policy "services owner admin update" on public.services for update using (seller_id=auth.uid() or public.is_admin()) with check (seller_id=auth.uid() or public.is_admin());
create policy "services admin delete" on public.services for delete using (public.is_admin());

create policy "seller app own admin read" on public.seller_applications for select using (user_id=auth.uid() or public.is_admin());
create policy "seller app create own" on public.seller_applications for insert with check (user_id=auth.uid());
create policy "seller app admin update" on public.seller_applications for update using (public.is_admin()) with check (public.is_admin());

create policy "payments own admin read" on public.payments for select using (buyer_id=auth.uid() or public.is_admin());
create policy "payments create own" on public.payments for insert with check (buyer_id=auth.uid());
create policy "payments admin update" on public.payments for update using (public.is_admin()) with check (public.is_admin());

create policy "channels read" on public.chat_channels for select using (true);
create policy "channels admin manage" on public.chat_channels for all using (public.is_admin()) with check (public.is_admin());
create policy "messages read" on public.messages for select using (true);
create policy "messages create auth" on public.messages for insert with check (sender_id=auth.uid() and auth.uid() is not null);
create policy "messages owner admin delete" on public.messages for delete using (sender_id=auth.uid() or public.is_admin());

create policy "notifications own read" on public.notifications for select using (user_id=auth.uid() or public.is_admin());
create policy "notifications own update" on public.notifications for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy "notifications admin create" on public.notifications for insert with check (public.is_admin());
create policy "audit admin read" on public.admin_audit_log for select using (public.is_admin());
create policy "audit admin insert" on public.admin_audit_log for insert with check (public.is_admin());

insert into storage.buckets(id,name,public) values
('avatars','avatars',true),('banners','banners',true),('posts','posts',true),('service-files','service-files',true)
on conflict(id) do nothing;

create policy "storage public read" on storage.objects for select using (bucket_id in ('avatars','banners','posts','service-files'));
create policy "storage user upload" on storage.objects for insert with check (auth.uid()::text=(storage.foldername(name))[1] or public.is_admin());
create policy "storage user update" on storage.objects for update using (auth.uid()::text=(storage.foldername(name))[1] or public.is_admin());
create policy "storage user delete" on storage.objects for delete using (auth.uid()::text=(storage.foldername(name))[1] or public.is_admin());

-- Realtime publication. If a table is already added, Supabase may say already member; that is safe to ignore.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chat_channels;
alter publication supabase_realtime add table public.notifications;
