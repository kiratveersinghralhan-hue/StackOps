-- STACKOPS ARENA PRO FINAL BACKEND RESET
-- SQL REQUIRED: YES
-- WARNING: This deletes existing public StackOps tables/data. Auth users remain.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Drop existing app tables safely
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.squads CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.user_banners CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Admin emails helper
CREATE OR REPLACE FUNCTION public.admin_emails()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['kiratveersinghralhan@gmail.com','qq299629@gmail.com']::text[];
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text UNIQUE,
  display_name text,
  gender text,
  bio text,
  avatar_url text,
  selected_banner_url text,
  riot_id text,
  region text,
  language text DEFAULT 'English',
  main_game text DEFAULT 'Valorant',
  role text DEFAULT 'user' CHECK (role IN ('user','seller','moderator','admin')),
  account_status text DEFAULT 'approved' CHECK (account_status IN ('approved','rejected','banned')),
  seller_status text DEFAULT 'none' CHECK (seller_status IN ('none','pending','approved','rejected','paused')),
  plan_key text DEFAULT 'free',
  title text DEFAULT 'Rookie',
  badge text DEFAULT 'Starter',
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  coins integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  is_banned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = auth.uid()
      AND lower(u.email) = ANY(public.admin_emails())
      AND COALESCE(p.is_banned,false) = false
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_banned = false
  );
$$;

CREATE OR REPLACE FUNCTION public.commission_rate(amount integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN amount < 500 THEN 7
    WHEN amount < 1000 THEN 10
    WHEN amount < 2000 THEN 15
    WHEN amount < 3000 THEN 20
    WHEN amount < 5000 THEN 25
    ELSE 30
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (
    id,email,username,display_name,role,account_status,title,badge,is_verified,selected_banner_url
  ) values (
    new.id,
    lower(new.email),
    split_part(new.email,'@',1),
    split_part(new.email,'@',1),
    case when lower(new.email) = any(public.admin_emails()) then 'admin' else 'user' end,
    'approved',
    case when lower(new.email) = any(public.admin_emails()) then 'Founder 👑' else 'Rookie' end,
    case when lower(new.email) = any(public.admin_emails()) then '1 of 1 Admin Crown' else 'Starter' end,
    case when lower(new.email) = any(public.admin_emails()) then true else false end,
    case when lower(new.email) = any(public.admin_emails()) then 'founder-king-banner' else 'starter-banner' end
  ) on conflict (id) do update set
    email = excluded.email,
    role = case when excluded.email = any(public.admin_emails()) then 'admin' else public.profiles.role end,
    account_status = 'approved',
    is_banned = false;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.plans (
  plan_key text PRIMARY KEY,
  name text NOT NULL,
  price_inr integer NOT NULL,
  badge text,
  title text,
  monthly_squad_invites integer DEFAULT 5,
  profile_boost integer DEFAULT 0,
  perks jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

INSERT INTO public.plans(plan_key,name,price_inr,badge,title,monthly_squad_invites,profile_boost,perks) VALUES
('free','Free',0,'Starter','Rookie',5,0,'["Guest discovery","Basic profile","Join public squads"]'),
('bronze','Bronze',199,'Bronze Card','Entry Fragger',15,5,'["Bronze banner","Extra squad requests","Basic marketplace access"]'),
('silver','Silver',499,'Silver Glow','Rising Pro',30,10,'["Silver profile glow","Priority filters","More uploads"]'),
('gold','Gold',999,'Gold Identity','Rank Demon',60,20,'["Gold title","Advanced squad finder","Marketplace discounts"]'),
('diamond','Diamond',2499,'Diamond Elite','Elite Captain',120,35,'["Premium banners","Service boost","VIP matchmaking"]'),
('legend','Legend',5999,'Legend Crown','Arena Legend',300,60,'["Exclusive card collection","Highest discovery boost","VIP support"]');

CREATE TABLE public.user_banners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  unlock_source text DEFAULT 'level',
  min_level integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_banners ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  game text DEFAULT 'Valorant',
  region text DEFAULT 'Global',
  language text DEFAULT 'English',
  rank_required text DEFAULT 'Any',
  playstyle text DEFAULT 'Competitive',
  max_members integer DEFAULT 5,
  description text,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  image_url text,
  visibility text DEFAULT 'public' CHECK (visibility IN ('public','followers','private')),
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  game text DEFAULT 'Valorant',
  category text DEFAULT 'coaching',
  price_inr integer NOT NULL DEFAULT 0,
  commission_percent integer GENERATED ALWAYS AS (public.commission_rate(price_inr)) STORED,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paused')),
  ai_verification_status text DEFAULT 'pending' CHECK (ai_verification_status IN ('pending','passed','flagged','manual_review')),
  proof_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  plan_key text REFERENCES public.plans(plan_key) ON DELETE SET NULL,
  amount_inr integer NOT NULL,
  platform_commission_inr integer DEFAULT 0,
  seller_payout_inr integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','refunded','completed','disputed')),
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text DEFAULT 'global',
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','blocked')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text DEFAULT 'system',
  title text NOT NULL,
  body text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (account_status='approved' OR id=auth.uid() OR public.is_admin());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT WITH CHECK (id=auth.uid() OR public.is_admin());
CREATE POLICY "profiles self admin update" ON public.profiles FOR UPDATE USING (id=auth.uid() OR public.is_admin()) WITH CHECK (id=auth.uid() OR public.is_admin());
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE USING (public.is_admin());

CREATE POLICY "plans public read" ON public.plans FOR SELECT USING (true);
CREATE POLICY "plans admin manage" ON public.plans FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "banners owner read" ON public.user_banners FOR SELECT USING (user_id=auth.uid() OR public.is_admin());
CREATE POLICY "banners owner insert" ON public.user_banners FOR INSERT WITH CHECK (user_id=auth.uid() OR public.is_admin());
CREATE POLICY "banners owner update" ON public.user_banners FOR UPDATE USING (user_id=auth.uid() OR public.is_admin()) WITH CHECK (user_id=auth.uid() OR public.is_admin());

CREATE POLICY "squads public read" ON public.squads FOR SELECT USING (true);
CREATE POLICY "squads owner insert" ON public.squads FOR INSERT WITH CHECK (owner_id=auth.uid());
CREATE POLICY "squads owner admin update" ON public.squads FOR UPDATE USING (owner_id=auth.uid() OR public.is_admin()) WITH CHECK (owner_id=auth.uid() OR public.is_admin());
CREATE POLICY "squads owner admin delete" ON public.squads FOR DELETE USING (owner_id=auth.uid() OR public.is_admin());

CREATE POLICY "posts public read" ON public.posts FOR SELECT USING (visibility='public' OR user_id=auth.uid() OR public.is_admin());
CREATE POLICY "posts owner insert" ON public.posts FOR INSERT WITH CHECK (user_id=auth.uid());
CREATE POLICY "posts owner admin update" ON public.posts FOR UPDATE USING (user_id=auth.uid() OR public.is_admin()) WITH CHECK (user_id=auth.uid() OR public.is_admin());
CREATE POLICY "posts owner admin delete" ON public.posts FOR DELETE USING (user_id=auth.uid() OR public.is_admin());

CREATE POLICY "services read approved owner admin" ON public.services FOR SELECT USING (status='approved' OR owner_id=auth.uid() OR public.is_admin());
CREATE POLICY "services seller apply" ON public.services FOR INSERT WITH CHECK (owner_id=auth.uid());
CREATE POLICY "services owner admin update" ON public.services FOR UPDATE USING (owner_id=auth.uid() OR public.is_admin()) WITH CHECK (owner_id=auth.uid() OR public.is_admin());
CREATE POLICY "services admin delete" ON public.services FOR DELETE USING (public.is_admin());

CREATE POLICY "orders buyer seller admin read" ON public.orders FOR SELECT USING (buyer_id=auth.uid() OR seller_id=auth.uid() OR public.is_admin());
CREATE POLICY "orders buyer insert" ON public.orders FOR INSERT WITH CHECK (buyer_id=auth.uid() OR public.is_admin());
CREATE POLICY "orders admin update" ON public.orders FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "messages channel read" ON public.messages FOR SELECT USING (receiver_id IS NULL OR user_id=auth.uid() OR receiver_id=auth.uid() OR public.is_admin());
CREATE POLICY "messages send" ON public.messages FOR INSERT WITH CHECK (user_id=auth.uid());
CREATE POLICY "messages owner admin delete" ON public.messages FOR DELETE USING (user_id=auth.uid() OR public.is_admin());

CREATE POLICY "friends own read" ON public.friend_requests FOR SELECT USING (sender_id=auth.uid() OR receiver_id=auth.uid() OR public.is_admin());
CREATE POLICY "friends send" ON public.friend_requests FOR INSERT WITH CHECK (sender_id=auth.uid());
CREATE POLICY "friends receiver update" ON public.friend_requests FOR UPDATE USING (receiver_id=auth.uid() OR public.is_admin()) WITH CHECK (receiver_id=auth.uid() OR public.is_admin());

CREATE POLICY "notifications own read" ON public.notifications FOR SELECT USING (user_id=auth.uid() OR public.is_admin());
CREATE POLICY "notifications admin insert" ON public.notifications FOR INSERT WITH CHECK (user_id=auth.uid() OR public.is_admin());
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE USING (user_id=auth.uid() OR public.is_admin()) WITH CHECK (user_id=auth.uid() OR public.is_admin());

-- Storage buckets
INSERT INTO storage.buckets (id,name,public) VALUES
('avatars','avatars',true),
('banners','banners',true),
('post-images','post-images',true),
('service-proof','service-proof',true),
('chat-files','chat-files',true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "stackops public storage read" ON storage.objects;
CREATE POLICY "stackops public storage read" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars','banners','post-images','service-proof','chat-files'));
DROP POLICY IF EXISTS "stackops user upload own folder" ON storage.objects;
CREATE POLICY "stackops user upload own folder" ON storage.objects FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin());
DROP POLICY IF EXISTS "stackops user update own folder" ON storage.objects;
CREATE POLICY "stackops user update own folder" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin());
DROP POLICY IF EXISTS "stackops user delete own folder" ON storage.objects;
CREATE POLICY "stackops user delete own folder" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin());

-- Make existing admin users admin if already signed up
UPDATE public.profiles p SET role='admin', account_status='approved', is_verified=true, is_banned=false, title='Founder 👑', badge='1 of 1 Admin Crown', selected_banner_url='founder-king-banner'
FROM auth.users u
WHERE p.id=u.id AND lower(u.email)=ANY(public.admin_emails());

-- Realtime helper note: In Supabase dashboard, enable realtime for public.messages if not already enabled.
