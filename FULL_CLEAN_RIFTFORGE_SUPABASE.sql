-- StackOps / RiftForge full clean Supabase backend
-- WARNING: This resets StackOps tables listed below. It does NOT delete auth.users.

create extension if not exists "pgcrypto";

-- Storage bucket for payment proofs
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = true;

-- Drop old app tables safely
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.seller_payouts CASCADE;
DROP TABLE IF EXISTS public.manual_orders CASCADE;
DROP TABLE IF EXISTS public.seller_services CASCADE;
DROP TABLE IF EXISTS public.seller_applications CASCADE;
DROP TABLE IF EXISTS public.user_rewards CASCADE;
DROP TABLE IF EXISTS public.xp_history CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.is_stackops_admin();
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_stackops_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  select coalesce(auth.jwt()->>'email','') in ('kiratveersinghralhan@gmail.com','qq299629@gmail.com');
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text,
  display_name text,
  gender text,
  bio text,
  riot_tag text,
  avatar_url text,
  main_game text DEFAULT 'Valorant',
  rank text,
  equipped_banner text DEFAULT 'Starter Arena',
  role text DEFAULT 'user' CHECK (role IN ('user','seller','admin')),
  account_status text DEFAULT 'active' CHECK (account_status IN ('active','pending','approved','rejected','banned')),
  seller_status text DEFAULT 'none' CHECK (seller_status IN ('none','pending','approved','rejected')),
  is_seller boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  equipped_title text DEFAULT 'Rookie',
  equipped_badge text DEFAULT 'First Login',
  xp integer DEFAULT 0,
  daily_claim_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  plan_key text DEFAULT 'free',
  proof_url text,
  banner_url text,
  teams_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  chats_count integer DEFAULT 0,
  last_seen timestamptz DEFAULT now(),
  phone text,
  upi_id text,
  wallet_balance numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  completed_orders integer DEFAULT 0
);

CREATE TABLE public.seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_email text,
  applicant_name text,
  note text,
  proof_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.seller_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text DEFAULT 'coaching',
  price numeric NOT NULL CHECK (price >= 49 AND price <= 2999),
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  platform_fee_percent numeric DEFAULT 8,
  rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.manual_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.seller_services(id) ON DELETE SET NULL,
  service_title text DEFAULT 'StackOps order',
  order_type text DEFAULT 'service' CHECK (order_type IN ('service','plan','tip','other')),
  amount numeric NOT NULL DEFAULT 0,
  platform_fee_percent numeric DEFAULT 8,
  platform_fee numeric GENERATED ALWAYS AS (round((amount * platform_fee_percent / 100.0)::numeric, 2)) STORED,
  seller_amount numeric GENERATED ALWAYS AS (round((amount - (amount * platform_fee_percent / 100.0))::numeric, 2)) STORED,
  utr text NOT NULL,
  proof_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','refunded')),
  show_public boolean DEFAULT false,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  note text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  game text DEFAULT 'Valorant',
  rank text,
  note text,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room text DEFAULT 'global',
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.xp_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  type text DEFAULT 'earn' CHECK (type IN ('earn','spend','admin')),
  source text DEFAULT 'system',
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_key text NOT NULL,
  reward_type text NOT NULL,
  reward_name text NOT NULL,
  cost integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, reward_key)
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.seller_services(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.manual_orders(id) ON DELETE SET NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  body text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz DEFAULT now()
);

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id,email,username,display_name,role,is_seller,is_verified,seller_status,xp,equipped_title,equipped_badge,equipped_banner)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email,'@',1),
    split_part(NEW.email,'@',1),
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'admin' ELSE 'user' END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN true ELSE false END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN true ELSE false END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'approved' ELSE 'none' END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 9999999 ELSE 0 END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'Founder' ELSE 'Rookie' END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'Origin Crown' ELSE 'First Login' END,
    CASE WHEN NEW.email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'Founder Crownline' ELSE 'Starter Arena' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed profiles for existing users
INSERT INTO public.profiles (id,email,username,display_name,role,is_seller,is_verified,seller_status,xp,equipped_title,equipped_badge,equipped_banner,account_status)
SELECT id,email,split_part(email,'@',1),split_part(email,'@',1),
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'admin' ELSE 'user' END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN true ELSE false END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN true ELSE false END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'approved' ELSE 'none' END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 9999999 ELSE 0 END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'Founder' ELSE 'Rookie' END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'Origin Crown' ELSE 'First Login' END,
  CASE WHEN email IN ('kiratveersinghralhan@gmail.com','qq299629@gmail.com') THEN 'Founder Crownline' ELSE 'Starter Arena' END,
  'active'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  role=EXCLUDED.role,
  is_seller=EXCLUDED.is_seller,
  is_verified=EXCLUDED.is_verified,
  seller_status=EXCLUDED.seller_status,
  xp=GREATEST(profiles.xp, EXCLUDED.xp),
  equipped_title=EXCLUDED.equipped_title,
  equipped_badge=EXCLUDED.equipped_badge,
  equipped_banner=EXCLUDED.equipped_banner,
  account_status='active';

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_stackops_admin());
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_stackops_admin()) WITH CHECK (auth.uid() = id OR public.is_stackops_admin());

-- Seller applications
CREATE POLICY "seller apps insert own" ON public.seller_applications FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "seller apps read" ON public.seller_applications FOR SELECT USING (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "seller apps admin update" ON public.seller_applications FOR UPDATE USING (public.is_stackops_admin()) WITH CHECK (public.is_stackops_admin());

-- Services
CREATE POLICY "services public read" ON public.seller_services FOR SELECT USING (true);
CREATE POLICY "services seller insert" ON public.seller_services FOR INSERT WITH CHECK (auth.uid() = seller_id OR public.is_stackops_admin());
CREATE POLICY "services seller update" ON public.seller_services FOR UPDATE USING (auth.uid() = seller_id OR public.is_stackops_admin()) WITH CHECK (auth.uid() = seller_id OR public.is_stackops_admin());
CREATE POLICY "services seller delete" ON public.seller_services FOR DELETE USING (auth.uid() = seller_id OR public.is_stackops_admin());

-- Manual orders
CREATE POLICY "orders buyer insert" ON public.manual_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id OR public.is_stackops_admin());
CREATE POLICY "orders read related" ON public.manual_orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_stackops_admin() OR show_public = true);
CREATE POLICY "orders admin update" ON public.manual_orders FOR UPDATE USING (public.is_stackops_admin()) WITH CHECK (public.is_stackops_admin());

-- Payouts
CREATE POLICY "payout seller insert" ON public.seller_payouts FOR INSERT WITH CHECK (auth.uid() = seller_id OR public.is_stackops_admin());
CREATE POLICY "payout read related" ON public.seller_payouts FOR SELECT USING (auth.uid() = seller_id OR public.is_stackops_admin());
CREATE POLICY "payout admin update" ON public.seller_payouts FOR UPDATE USING (public.is_stackops_admin()) WITH CHECK (public.is_stackops_admin());

-- Teams / posts / messages
CREATE POLICY "teams read all" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams insert own" ON public.teams FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "teams update own" ON public.teams FOR UPDATE USING (auth.uid() = owner_id OR public.is_stackops_admin());
CREATE POLICY "posts read all" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts insert own" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts update own" ON public.posts FOR UPDATE USING (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "posts delete own" ON public.posts FOR DELETE USING (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "messages read all" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages insert own" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rewards / XP
CREATE POLICY "xp read own" ON public.xp_history FOR SELECT USING (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "xp insert own" ON public.xp_history FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "rewards read own" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id OR public.is_stackops_admin());
CREATE POLICY "rewards insert own" ON public.user_rewards FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_stackops_admin());

-- Reviews
CREATE POLICY "reviews public approved" ON public.reviews FOR SELECT USING (status='approved' OR buyer_id=auth.uid() OR seller_id=auth.uid() OR public.is_stackops_admin());
CREATE POLICY "reviews buyer insert" ON public.reviews FOR INSERT WITH CHECK (buyer_id=auth.uid() OR public.is_stackops_admin());
CREATE POLICY "reviews admin update" ON public.reviews FOR UPDATE USING (public.is_stackops_admin()) WITH CHECK (public.is_stackops_admin());

-- Storage policies for payment proofs
DROP POLICY IF EXISTS "payment proofs public read" ON storage.objects;
DROP POLICY IF EXISTS "payment proofs auth upload" ON storage.objects;
CREATE POLICY "payment proofs public read" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');
CREATE POLICY "payment proofs auth upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

-- Realtime publication safe add
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_services; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_orders; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_applications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teams; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_services_seller ON public.seller_services(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.manual_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON public.manual_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.manual_orders(status);
CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages(room, created_at);

SELECT 'StackOps/RiftForge reset complete. Logout/login again, then test services, payments and admin.' AS status;
