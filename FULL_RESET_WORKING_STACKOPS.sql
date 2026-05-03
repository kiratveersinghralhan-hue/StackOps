-- STACKOPS FULL CLEAN RESET - RUN ONCE
-- WARNING: This resets StackOps public app tables and deletes old StackOps app data.

create extension if not exists pgcrypto;

-- Drop old app tables safely
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.seller_payouts CASCADE;
DROP TABLE IF EXISTS public.seller_wallets CASCADE;
DROP TABLE IF EXISTS public.manual_orders CASCADE;
DROP TABLE IF EXISTS public.seller_services CASCADE;
DROP TABLE IF EXISTS public.seller_applications CASCADE;
DROP TABLE IF EXISTS public.verification_requests CASCADE;
DROP TABLE IF EXISTS public.daily_claims CASCADE;
DROP TABLE IF EXISTS public.xp_history CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_order_approved() CASCADE;
DROP FUNCTION IF EXISTS public.handle_payout_paid() CASCADE;

-- Admin helper
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com');
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  display_name text,
  gender text,
  bio text,
  riot_id text,
  avatar_url text,
  game text default 'Valorant',
  banner_url text,
  equipped_banner text default 'Default Arena Card',
  role text default 'user' check (role in ('user','seller','admin')),
  account_status text default 'active' check (account_status in ('active','pending','approved','rejected','banned')),
  seller_status text default 'none' check (seller_status in ('none','pending','approved','rejected')),
  plan_key text default 'free',
  equipped_title text default 'Rookie',
  equipped_badge text default 'Starter Spark',
  xp integer default 0,
  teams_count integer default 0,
  is_seller boolean default false,
  is_verified boolean default false,
  owned_rewards text[] default array['title:Rookie','badge:Starter Spark','banner:Default Arena Card'],
  referral_code text,
  referred_by uuid,
  invite_count integer default 0,
  posts_count integer default 0,
  chat_count integer default 0,
  seller_rating numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.xp_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount integer not null,
  source text not null,
  note text,
  created_at timestamptz default now()
);

create table public.daily_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  claim_date date not null,
  amount integer default 80,
  created_at timestamptz default now(),
  unique(user_id, claim_date)
);

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  applicant_email text,
  applicant_name text,
  proof_url text,
  proof_path text,
  note text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  game text default 'Valorant',
  price numeric not null check (price >= 0),
  is_active boolean default true,
  avg_rating numeric default 0,
  review_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete cascade,
  seller_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.seller_services(id) on delete set null,
  service_title text not null default 'StackOps Order',
  order_type text default 'service' check (order_type in ('service','plan','custom')),
  amount numeric not null default 0,
  commission_amount numeric default 0,
  seller_earning numeric default 0,
  utr text,
  proof_url text,
  proof_path text,
  plan_key text,
  public_feedback boolean default false,
  status text default 'pending' check (status in ('pending','approved','rejected','completed','refunded')),
  admin_note text,
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table public.seller_wallets (
  seller_id uuid primary key references auth.users(id) on delete cascade,
  total_earned numeric default 0,
  available_balance numeric default 0,
  paid_out numeric default 0,
  updated_at timestamptz default now()
);

create table public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  amount numeric not null,
  upi_id text,
  status text default 'pending' check (status in ('pending','paid','rejected')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  game text,
  description text,
  is_public boolean default true,
  created_at timestamptz default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.seller_services(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  body text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  note text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

-- Triggers
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id,email,username,display_name,role,account_status,is_seller,is_verified,seller_status,xp,equipped_title,equipped_badge,equipped_banner,owned_rewards)
  values(
    new.id,
    new.email,
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'admin' else 'user' end,
    'active',
    lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com'),
    lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com'),
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'approved' else 'none' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 9999999 else 0 end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder' else 'Rookie' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Origin Crown' else 'Starter Spark' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then 'Founder Crownline' else 'Default Arena Card' end,
    case when lower(new.email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') then array['title:Rookie','badge:Starter Spark','banner:Default Arena Card','title:Founder','badge:Origin Crown','banner:Founder Crownline'] else array['title:Rookie','badge:Starter Spark','banner:Default Arena Card'] end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_order_approved()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and coalesce(old.status,'') <> 'approved' then
    update public.profiles set
      plan_key = coalesce(new.plan_key, plan_key),
      xp = coalesce(xp,0) + case when new.order_type='plan' then 100 else 25 end,
      updated_at = now()
    where id = new.buyer_id;
    insert into public.xp_history(user_id,amount,source,note)
    values(new.buyer_id, case when new.order_type='plan' then 100 else 25 end, 'approved_order', 'Order/payment approved');
    if new.seller_id is not null and coalesce(new.seller_earning,0) > 0 then
      insert into public.seller_wallets(seller_id,total_earned,available_balance,updated_at)
      values(new.seller_id,new.seller_earning,new.seller_earning,now())
      on conflict (seller_id) do update set
        total_earned = public.seller_wallets.total_earned + excluded.total_earned,
        available_balance = public.seller_wallets.available_balance + excluded.available_balance,
        updated_at = now();
    end if;
  end if;
  return new;
end $$;
create trigger manual_order_approved after update on public.manual_orders for each row execute function public.handle_order_approved();

create or replace function public.handle_payout_paid()
returns trigger language plpgsql security definer as $$
begin
  if new.status='paid' and coalesce(old.status,'') <> 'paid' then
    update public.seller_wallets set available_balance = greatest(0, available_balance - new.amount), paid_out = paid_out + new.amount, updated_at=now()
    where seller_id = new.seller_id;
  end if;
  return new;
end $$;
create trigger seller_payout_paid after update on public.seller_payouts for each row execute function public.handle_payout_paid();

-- Seed existing admin profiles if users already exist
insert into public.profiles(id,email,username,display_name,role,account_status,is_seller,is_verified,seller_status,xp,equipped_title,equipped_badge,equipped_banner,owned_rewards,bio)
select id,email,split_part(email,'@',1),split_part(email,'@',1),'admin','active',true,true,'approved',9999999,'Founder','Origin Crown','Founder Crownline',array['title:Rookie','badge:Starter Spark','banner:Default Arena Card','title:Founder','badge:Origin Crown','banner:Founder Crownline'],'Founder of StackOps'
from auth.users
where lower(email) in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com')
on conflict (id) do update set role='admin', account_status='active', is_seller=true, is_verified=true, seller_status='approved', xp=9999999, equipped_title='Founder', equipped_badge='Origin Crown', equipped_banner='Founder Crownline', owned_rewards=array['title:Rookie','badge:Starter Spark','banner:Default Arena Card','title:Founder','badge:Origin Crown','banner:Founder Crownline'];

-- RLS
alter table public.profiles enable row level security;
alter table public.xp_history enable row level security;
alter table public.daily_claims enable row level security;
alter table public.seller_applications enable row level security;
alter table public.seller_services enable row level security;
alter table public.manual_orders enable row level security;
alter table public.seller_wallets enable row level security;
alter table public.seller_payouts enable row level security;
alter table public.posts enable row level security;
alter table public.teams enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_requests enable row level security;

-- Profiles
create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id=auth.uid() or public.is_admin());
create policy profiles_update_own_admin on public.profiles for update to authenticated using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());

-- XP / daily
create policy xp_select on public.xp_history for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy xp_insert on public.xp_history for insert to authenticated with check (user_id=auth.uid() or public.is_admin());
create policy daily_select on public.daily_claims for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy daily_insert on public.daily_claims for insert to authenticated with check (user_id=auth.uid());

-- Seller applications
create policy seller_apps_insert on public.seller_applications for insert to authenticated with check (user_id=auth.uid());
create policy seller_apps_select on public.seller_applications for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy seller_apps_update on public.seller_applications for update to authenticated using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());

-- Services
create policy services_select on public.seller_services for select using (is_active=true or seller_id=auth.uid() or public.is_admin());
create policy services_insert on public.seller_services for insert to authenticated with check (seller_id=auth.uid() and (public.is_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_seller=true and p.seller_status='approved')));
create policy services_update on public.seller_services for update to authenticated using (seller_id=auth.uid() or public.is_admin()) with check (seller_id=auth.uid() or public.is_admin());
create policy services_delete on public.seller_services for delete to authenticated using (seller_id=auth.uid() or public.is_admin());

-- Manual orders
create policy orders_insert on public.manual_orders for insert to authenticated with check (buyer_id=auth.uid() or public.is_admin());
create policy orders_select on public.manual_orders for select to authenticated using (buyer_id=auth.uid() or seller_id=auth.uid() or public.is_admin());
create policy orders_update on public.manual_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Wallets / payouts
create policy wallets_select on public.seller_wallets for select to authenticated using (seller_id=auth.uid() or public.is_admin());
create policy wallets_insert_admin on public.seller_wallets for insert to authenticated with check (public.is_admin());
create policy wallets_update_admin on public.seller_wallets for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payouts_select on public.seller_payouts for select to authenticated using (seller_id=auth.uid() or public.is_admin());
create policy payouts_insert on public.seller_payouts for insert to authenticated with check (seller_id=auth.uid() or public.is_admin());
create policy payouts_update_admin on public.seller_payouts for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Posts / teams
create policy posts_select on public.posts for select using (true);
create policy posts_insert on public.posts for insert to authenticated with check (user_id=auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (user_id=auth.uid() or public.is_admin());
create policy teams_select on public.teams for select using (is_public=true or owner_id=auth.uid() or public.is_admin());
create policy teams_insert on public.teams for insert to authenticated with check (owner_id=auth.uid());
create policy teams_update on public.teams for update to authenticated using (owner_id=auth.uid() or public.is_admin()) with check (owner_id=auth.uid() or public.is_admin());

-- Reviews / verification
create policy reviews_select on public.reviews for select using (status='approved' or user_id=auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated with check (user_id=auth.uid());
create policy reviews_update_admin on public.reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy verification_select on public.verification_requests for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy verification_insert on public.verification_requests for insert to authenticated with check (user_id=auth.uid());
create policy verification_update_admin on public.verification_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for payment proofs
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs', true) on conflict (id) do update set public=true;
drop policy if exists payment_proofs_read on storage.objects;
drop policy if exists payment_proofs_upload on storage.objects;
drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_read on storage.objects for select using (bucket_id='payment-proofs');
create policy payment_proofs_upload on storage.objects for insert to authenticated with check (bucket_id='payment-proofs');
create policy payment_proofs_update on storage.objects for update to authenticated using (bucket_id='payment-proofs' and (owner=auth.uid() or public.is_admin())) with check (bucket_id='payment-proofs');

-- Indexes
create index if not exists idx_profiles_xp on public.profiles(xp desc);
create index if not exists idx_services_seller on public.seller_services(seller_id);
create index if not exists idx_orders_buyer on public.manual_orders(buyer_id);
create index if not exists idx_orders_seller on public.manual_orders(seller_id);
create index if not exists idx_orders_status on public.manual_orders(status);

-- Realtime safe add
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_applications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_services; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;

select 'StackOps reset complete. Logout/login, then test: service creation, UPI payment proof, admin approval, XP rewards.' as status;
